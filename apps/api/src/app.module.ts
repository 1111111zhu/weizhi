import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { AuditLogsModule } from "./audit-logs/audit-logs.module";
import { AuthModule } from "./auth/auth.module";
import { SecurityModule } from "./auth/security.module";
import { CmpModule } from "./cmp/cmp.module";
import { backgroundScheduleOptions } from "./common/background-jobs";
import { DeclarationsModule } from "./declarations/declarations.module";
import { DesktopModule } from "./desktop/desktop.module";
import { DownloadsModule } from "./downloads/downloads.module";
import { FrameworkTemplatesModule } from "./framework-templates/framework-templates.module";
import { HealthController } from "./health.controller";
import { InboxModule } from "./inbox/inbox.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { UserMailModule } from "./mail/user-mail.module";
import { MembersModule } from "./members/members.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectTemplatesModule } from "./project-templates/project-templates.module";
import { ProjectsModule } from "./projects/projects.module";
import { RolesModule } from "./roles/roles.module";
import { SmartFormsModule } from "./smart-forms/smart-forms.module";
import { SystemConnectionsModule } from "./system-connections/system-connections.module";
import { TmsModule } from "./tms/tms.module";
import { UsersModule } from "./users/users.module";
import { WorkItemsModule } from "./work-items/work-items.module";
import { WorkflowModule } from "./workflow/workflow.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        ".env.local",
        ".env",
        "apps/api/.env.local",
        "apps/api/.env",
      ],
    }),
    ScheduleModule.forRootAsync({ useFactory: backgroundScheduleOptions }),
    PrismaModule,
    SecurityModule,
    AuditLogsModule,
    AuthModule,
    UsersModule,
    RolesModule,
    WorkspacesModule,
    ProjectsModule,
    DeclarationsModule,
    MembersModule,
    UserMailModule,
    InboxModule,
    KnowledgeModule,
    WorkflowModule,
    DesktopModule,
    DownloadsModule,
    FrameworkTemplatesModule,
    ProjectTemplatesModule,
    SmartFormsModule,
    SystemConnectionsModule,
    CmpModule,
    TmsModule,
    WorkItemsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {
  private readonly _moduleMarker = true;
}
