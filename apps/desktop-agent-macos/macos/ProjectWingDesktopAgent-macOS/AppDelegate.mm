#import "AppDelegate.h"
#import "ManagedRuntimeController.h"

#import <React/RCTBundleURLProvider.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

@interface AppDelegate ()

@property(nonatomic, strong) NSStatusItem *statusItem;
@property(nonatomic, strong) NSPopover *popover;
@property(nonatomic, strong) ManagedRuntimeController *runtimeController;

@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification
{
  self.moduleName = @"ProjectWingDesktopAgent";
  self.initialProps = @{};
  self.dependencyProvider = [RCTAppDependencyProvider new];
  [super applicationDidFinishLaunching:notification];
  self.runtimeController = [ManagedRuntimeController new];
  [self.runtimeController start];
  [self configureStatusItem];
}

- (void)configureStatusItem
{
  NSViewController *contentController = self.window.contentViewController;
  [self.window setContentViewController:nil];
  [self.window orderOut:nil];

  self.popover = [NSPopover new];
  self.popover.behavior = NSPopoverBehaviorTransient;
  self.popover.contentSize = NSMakeSize(400, 540);
  self.popover.contentViewController = contentController;
  self.popover.animates = YES;

  self.statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSSquareStatusItemLength];
  NSStatusBarButton *button = self.statusItem.button;
  button.image = [NSImage imageWithSystemSymbolName:@"bolt.horizontal.circle.fill"
                           accessibilityDescription:@"Project Wing Desktop Agent"];
  [button.image setTemplate:YES];
  button.target = self;
  button.action = @selector(handleStatusItem:);
  [button sendActionOn:NSEventMaskLeftMouseUp | NSEventMaskRightMouseUp];
}

- (void)handleStatusItem:(id)sender
{
  NSEvent *event = NSApp.currentEvent;
  if (event.type == NSEventTypeRightMouseUp) {
    [self showContextMenu:event];
    return;
  }
  if (self.popover.shown) {
    [self.popover performClose:sender];
    return;
  }
  NSStatusBarButton *button = self.statusItem.button;
  [self.popover showRelativeToRect:button.bounds ofView:button preferredEdge:NSRectEdgeMinY];
}

- (void)showContextMenu:(NSEvent *)event
{
  NSMenu *menu = [NSMenu new];
  NSMenuItem *quitItem = [[NSMenuItem alloc] initWithTitle:@"Quit Project Wing Desktop Agent"
                                                   action:@selector(terminate:)
                                            keyEquivalent:@""];
  quitItem.target = NSApp;
  [menu addItem:quitItem];
  [NSMenu popUpContextMenu:menu withEvent:event forView:self.statusItem.button];
}

- (void)applicationWillTerminate:(NSNotification *)notification
{
  (void)notification;
  [[NSStatusBar systemStatusBar] removeStatusItem:self.statusItem];
  [self.runtimeController prepareShutdown];
}

- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication *)sender
{
  (void)sender;
  [self.runtimeController prepareShutdown];
  return NSTerminateNow;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

- (BOOL)concurrentRootEnabled
{
#ifdef RN_FABRIC_ENABLED
  return true;
#else
  return false;
#endif
}

@end
