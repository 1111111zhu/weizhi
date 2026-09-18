#import "ManagedRuntimeController.h"

static const NSInteger kHealthReadyStatusCode = 200;
static const NSInteger kShutdownAcceptedStatusCode = 202;
static const NSTimeInterval kHealthRequestTimeout = 0.75;
static const NSTimeInterval kShutdownRequestTimeout = 1.5;
static const NSTimeInterval kShutdownExitTimeout = 2.0;
static const int64_t kHealthCheckDelayNanoseconds = 5 * NSEC_PER_SEC;
static const int64_t kManagerRestartDelayNanoseconds = 2 * NSEC_PER_SEC;

@interface ManagedRuntimeController ()

@property(nonatomic, strong) NSTask *managerTask;
@property(nonatomic, copy) NSString *managerPath;
@property(nonatomic, copy) NSString *managerProcessPattern;
@property(nonatomic, copy) NSString *runtimePath;
@property(nonatomic, copy) NSString *runtimeProcessPattern;
@property(nonatomic, copy) NSString *runtimeRoot;
@property(nonatomic, copy) NSString *stateRoot;
@property(nonatomic, assign) BOOL healthCheckScheduled;
@property(nonatomic, assign) BOOL shuttingDown;

@end


@implementation ManagedRuntimeController

- (instancetype)init
{
  self = [super init];
  if (self) [self configurePaths];
  return self;
}

- (void)start
{
  [self startManagedRuntime];
}

- (void)configurePaths
{
  NSString *resourceRoot = NSBundle.mainBundle.resourcePath;
  self.runtimeRoot = [resourceRoot stringByAppendingPathComponent:@"DesktopRuntime"];
  NSString *managedRoot = [self.runtimeRoot stringByAppendingPathComponent:@"managed"];
  NSString *thinManagerPath = [managedRoot stringByAppendingPathComponent:@"manager/ProjectWing.AgentManager"];
  BOOL hasThinRuntime = [[NSFileManager defaultManager] isExecutableFileAtPath:thinManagerPath];
  self.managerPath = hasThinRuntime
      ? thinManagerPath
      : [managedRoot stringByAppendingPathComponent:@"ProjectWing.AgentManager"];
  self.runtimePath = hasThinRuntime
      ? [managedRoot stringByAppendingPathComponent:@"runtime/ProjectWing.DesktopAgent.Runtime"]
      : [managedRoot stringByAppendingPathComponent:@"ProjectWing.DesktopAgent.Runtime"];
  self.managerProcessPattern = [self processPatternForRoot:managedRoot executable:@"ProjectWing.AgentManager"];
  self.runtimeProcessPattern = [self processPatternForRoot:managedRoot executable:@"ProjectWing.DesktopAgent.Runtime"];
  self.stateRoot = [self resolveStateRoot];
}

- (NSString *)processPatternForRoot:(NSString *)root executable:(NSString *)executable
{
  NSString *escapedRoot = [NSRegularExpression escapedPatternForString:root];
  NSString *escapedExecutable = [NSRegularExpression escapedPatternForString:executable];
  return [NSString stringWithFormat:@"^%@(/[^/]*)*/%@( |$)", escapedRoot, escapedExecutable];
}

- (NSString *)resolveStateRoot
{
  NSURL *supportUrl = [[NSFileManager defaultManager] URLForDirectory:NSApplicationSupportDirectory
                                                             inDomain:NSUserDomainMask
                                                    appropriateForURL:nil
                                                               create:YES
                                                                error:nil];
  return [[supportUrl path] stringByAppendingPathComponent:@"ProjectWing/AgentState"];
}

- (NSString *)shutdownFlagPath
{
  return [self.stateRoot stringByAppendingPathComponent:@"shutdown.flag"];
}

- (void)startManagedRuntime
{
  if (self.shuttingDown || self.managerTask.running) return;
  if ([self isManagedRuntimeHealthy]) {
    [self scheduleManagedRuntimeHealthCheck];
    return;
  }
  if (![[NSFileManager defaultManager] isExecutableFileAtPath:self.managerPath]) return;
  [self prepareStateRootForLaunch];
  NSTask *task = [self createManagerTask];
  self.managerTask = task;
  if (![task launchAndReturnError:nil]) {
    self.managerTask = nil;
    [self scheduleManagedRuntimeRestart];
  }
}

- (void)prepareStateRootForLaunch
{
  [[NSFileManager defaultManager] createDirectoryAtPath:self.stateRoot
                            withIntermediateDirectories:YES
                                             attributes:nil
                                                  error:nil];
  [[NSFileManager defaultManager] removeItemAtPath:[self shutdownFlagPath] error:nil];
}

- (NSTask *)createManagerTask
{
  NSString *version = [NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
  NSTask *task = [NSTask new];
  task.executableURL = [NSURL fileURLWithPath:self.managerPath];
  task.arguments = @[
    @"run", @"--app-directory", self.runtimeRoot, @"--agent-version", version,
    @"--state-root", self.stateRoot, @"--manager-path", self.managerPath,
    @"--runtime-path", self.runtimePath, @"--runtime-port", @"17862",
    @"--worker-port", @"17863"
  ];
  task.standardOutput = [NSFileHandle fileHandleWithNullDevice];
  task.standardError = [NSFileHandle fileHandleWithNullDevice];
  __weak ManagedRuntimeController *weakSelf = self;
  task.terminationHandler = ^(NSTask *terminatedTask) {
    dispatch_async(dispatch_get_main_queue(), ^{
      ManagedRuntimeController *strongSelf = weakSelf;
      if (!strongSelf || strongSelf.managerTask != terminatedTask) return;
      strongSelf.managerTask = nil;
      [strongSelf scheduleManagedRuntimeRestart];
    });
  };
  return task;
}

- (void)scheduleManagedRuntimeRestart
{
  if (self.shuttingDown) return;
  __weak ManagedRuntimeController *weakSelf = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, kManagerRestartDelayNanoseconds),
                 dispatch_get_main_queue(), ^{
    ManagedRuntimeController *strongSelf = weakSelf;
    if (strongSelf && !strongSelf.shuttingDown && !strongSelf.managerTask.running) {
      [strongSelf startManagedRuntime];
    }
  });
}

- (void)scheduleManagedRuntimeHealthCheck
{
  if (self.shuttingDown || self.healthCheckScheduled) return;
  self.healthCheckScheduled = YES;
  __weak ManagedRuntimeController *weakSelf = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, kHealthCheckDelayNanoseconds),
                 dispatch_get_main_queue(), ^{
    ManagedRuntimeController *strongSelf = weakSelf;
    if (!strongSelf) return;
    strongSelf.healthCheckScheduled = NO;
    if (strongSelf.shuttingDown || strongSelf.managerTask.running) return;
    [strongSelf startManagedRuntime];
  });
}

- (BOOL)isManagedRuntimeHealthy
{
  NSMutableURLRequest *request = [NSMutableURLRequest
      requestWithURL:[NSURL URLWithString:@"http://127.0.0.1:17862/health"]];
  request.timeoutInterval = kHealthRequestTimeout;
  return [self statusCodeForRequest:request waitTimeout:kHealthRequestTimeout] ==
      kHealthReadyStatusCode;
}

- (void)prepareShutdown
{
  if (self.shuttingDown) return;
  self.shuttingDown = YES;
  BOOL accepted = [self requestManagedRuntimeShutdown];
  NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:kShutdownExitTimeout];
  while (accepted && [self isManagedRuntimeHealthy] && deadline.timeIntervalSinceNow > 0) {
    [[NSRunLoop currentRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.05]];
  }
  if (!accepted || [self isManagedRuntimeHealthy]) {
    [self writeShutdownFlag];
    [self terminateManagedRuntimeFallback];
  }
}

- (BOOL)requestManagedRuntimeShutdown
{
  NSMutableURLRequest *request = [NSMutableURLRequest
      requestWithURL:[NSURL URLWithString:@"http://127.0.0.1:17862/control/shutdown"]];
  request.HTTPMethod = @"POST";
  request.timeoutInterval = kShutdownRequestTimeout;
  return [self statusCodeForRequest:request waitTimeout:kShutdownExitTimeout] ==
      kShutdownAcceptedStatusCode;
}

- (NSInteger)statusCodeForRequest:(NSMutableURLRequest *)request
                      waitTimeout:(NSTimeInterval)waitTimeout
{
  dispatch_semaphore_t completion = dispatch_semaphore_create(0);
  __block NSInteger statusCode = 0;
  NSURLSessionDataTask *task = [[NSURLSession sharedSession]
      dataTaskWithRequest:request
        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
          (void)data;
          if (!error && [response isKindOfClass:[NSHTTPURLResponse class]]) {
            statusCode = ((NSHTTPURLResponse *)response).statusCode;
          }
          dispatch_semaphore_signal(completion);
        }];
  [task resume];
  int64_t timeout = (int64_t)(waitTimeout * NSEC_PER_SEC);
  if (dispatch_semaphore_wait(completion, dispatch_time(DISPATCH_TIME_NOW, timeout)) != 0) {
    [task cancel];
  }
  return statusCode;
}

- (void)writeShutdownFlag
{
  [[NSFileManager defaultManager] createDirectoryAtPath:self.stateRoot
                            withIntermediateDirectories:YES
                                             attributes:nil
                                                  error:nil];
  NSString *timestamp = [[NSDate date] descriptionWithLocale:@{NSLocaleIdentifier : @"en_US_POSIX"}];
  [timestamp writeToFile:[self shutdownFlagPath]
              atomically:YES
                encoding:NSUTF8StringEncoding
                   error:nil];
}

- (void)terminateManagedRuntimeFallback
{
  if (self.managerTask.running) [self.managerTask terminate];
  [self terminateProcessMatchingPattern:self.managerProcessPattern];
  [self terminateProcessMatchingPattern:self.runtimeProcessPattern];
}

- (void)terminateProcessMatchingPattern:(NSString *)pattern
{
  NSTask *task = [NSTask new];
  task.executableURL = [NSURL fileURLWithPath:@"/usr/bin/pkill"];
  task.arguments = @[@"-f", pattern];
  task.standardOutput = [NSFileHandle fileHandleWithNullDevice];
  task.standardError = [NSFileHandle fileHandleWithNullDevice];
  [task launchAndReturnError:nil];
}

@end
