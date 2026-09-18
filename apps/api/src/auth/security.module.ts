import { Global, Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { SystemEmailModule } from "../mail/system-email.module";
import { AuthEmailOtpService } from "./auth-email-otp.service";
import { AuthGuard } from "./auth.guard";
import { BETTER_AUTH_SESSION_READER } from "./better-auth-session-reader";
import { BetterAuthService } from "./better-auth.service";
import { GlobalRolesGuard } from "./global-roles.guard";

@Global()
@Module({
  imports: [AuditLogsModule, SystemEmailModule],
  providers: [
    AuthEmailOtpService,
    BetterAuthService,
    {
      provide: BETTER_AUTH_SESSION_READER,
      useExisting: BetterAuthService,
    },
    AuthGuard,
    GlobalRolesGuard,
  ],
  exports: [
    BetterAuthService,
    BETTER_AUTH_SESSION_READER,
    AuthGuard,
    GlobalRolesGuard,
  ],
})
export class SecurityModule {
  private readonly _moduleMarker = true;
}
