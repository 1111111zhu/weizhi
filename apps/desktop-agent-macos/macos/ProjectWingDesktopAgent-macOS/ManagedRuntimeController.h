#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ManagedRuntimeController : NSObject

- (void)start;
- (void)prepareShutdown;

@end

NS_ASSUME_NONNULL_END
