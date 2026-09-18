import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { InboxModule } from "../inbox/inbox.module";
import { SystemEmailModule } from "../mail/system-email.module";
import { StorageModule } from "../storage/storage.module";
import { WorkflowModule } from "../workflow/workflow.module";
import { CmpAmlController } from "./aml/cmp-aml.controller";
import { CmpAmlConfigurationController } from "./aml/cmp-aml-configuration.controller";
import { CmpAmlConfigurationService } from "./aml/cmp-aml-configuration.service";
import { CmpAmlService } from "./aml/cmp-aml.service";
import { DiditAmlClient } from "./aml/didit-aml.client";
import { CmpBillingController } from "./billing/cmp-billing.controller";
import { CmpBillingService } from "./billing/cmp-billing.service";
import { CmpClientMasterController } from "./client-master/cmp-client-master.controller";
import { CmpClientMasterService } from "./client-master/cmp-client-master.service";
import { CmpClientSearchDocumentsController } from "./client-search-documents/cmp-client-search-documents.controller";
import { CmpClientSearchDocumentsService } from "./client-search-documents/cmp-client-search-documents.service";
import { CmpBudgetExchangeRatesService } from "./cmp-budget-exchange-rates.service";
import { CmpController } from "./cmp.controller";
import { CmpService } from "./cmp.service";
import { CmpEntityGraphController } from "./entity-graph/cmp-entity-graph.controller";
import { CmpEntityGraphService } from "./entity-graph/cmp-entity-graph.service";
import { CmpEntityMapController } from "./entity-graph/cmp-entity-map.controller";

@Module({
  imports: [
    AuditLogsModule,
    InboxModule,
    StorageModule,
    SystemEmailModule,
    WorkflowModule,
  ],
  controllers: [
    CmpController,
    CmpAmlController,
    CmpAmlConfigurationController,
    CmpClientMasterController,
    CmpEntityGraphController,
    CmpEntityMapController,
    CmpClientSearchDocumentsController,
    CmpBillingController,
  ],
  providers: [
    CmpService,
    CmpAmlService,
    CmpAmlConfigurationService,
    DiditAmlClient,
    CmpBudgetExchangeRatesService,
    CmpClientMasterService,
    CmpEntityGraphService,
    CmpClientSearchDocumentsService,
    CmpBillingService,
  ],
})
export class CmpModule {
  private readonly _moduleMarker = true;
}
