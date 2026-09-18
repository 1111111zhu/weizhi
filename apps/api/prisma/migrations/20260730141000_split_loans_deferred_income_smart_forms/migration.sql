-- Replace the legacy combined loans/deferred-income SmartForm with two structured templates.
-- Existing instances keep referencing the archived combined template and its published version.

DO $$
DECLARE
  actor_id TEXT;
  loans_template_id TEXT;
  deferred_template_id TEXT;
  loans_version_id TEXT := 'sfv_audit_loans_20260730';
  deferred_version_id TEXT := 'sfv_audit_deferred_income_20260730';
  loans_definition JSONB := $loans${"title":{"zh-CN":"审计程序——贷款","en-US":"Audit Programme — Loans"},"description":{"zh-CN":"由原工作簿“Loans”工作表转换而成的中英双语智能表单。每项可执行程序均使用结构化的“是否执行、执行结果、底稿引用和备注”记录。","en-US":"Bilingual SmartForm converted from the Loans worksheet. Each executable procedure uses a structured Test required, Result, Working paper references and Comments record."},"sections":[{"id":"loans-general","title":{"zh-CN":"贷款——一般审计程序","en-US":"Loans — General audit procedures"},"description":{"zh-CN":"审计目标：1）确保所有重大贷款均已正确核算；2）确认长期贷款所需披露均已作出，且相关信息已得到适当列报和说明。","en-US":"Audit objectives: (1) Ensure that all material loans have been correctly accounted for. (2) Confirm that all necessary disclosures concerning long-term loans have been made and that the information is appropriately presented and described."},"questions":[{"id":"loans-general-1","type":"AUDIT_PROCEDURE","procedureCode":"1","prompt":{"zh-CN":"取得并检查（或编制）本年度的主表，并将其与总账核对。","en-US":"Obtain and check, or prepare, a lead schedule for the current year’s figures and reconcile this to the general ledger."},"required":true},{"id":"loans-general-2a","type":"AUDIT_PROCEDURE","procedureCode":"2a","prompt":{"zh-CN":"执行分析程序，将本期数据与以前期间的数据进行比较；","en-US":"Carry out analytical procedures by comparing the current figures with those of prior periods."},"required":true},{"id":"loans-general-2b","type":"AUDIT_PROCEDURE","procedureCode":"2b","prompt":{"zh-CN":"执行分析程序，复核并比较关键比率或其他绩效指标。","en-US":"Carry out analytical procedures by reviewing and comparing key ratios or other performance indicators."},"required":true},{"id":"loans-general-3","type":"AUDIT_PROCEDURE","procedureCode":"3","prompt":{"zh-CN":"复核超过执行重要性水平或其他异常的项目，并进行验证。","en-US":"Review for items above performance materiality or that are otherwise unusual and verify."},"required":true},{"id":"loans-general-4","type":"AUDIT_PROCEDURE","procedureCode":"4","prompt":{"zh-CN":"向贷款人取得直接函证，并确认担保等其他事项已得到妥善处理。","en-US":"Obtain direct confirmation from lenders and confirm that other matters such as security have been dealt with."},"required":true},{"id":"loans-general-5","type":"AUDIT_PROCEDURE","procedureCode":"5","prompt":{"zh-CN":"复核贷款协议，并考虑任何违反契约条款的影响。","en-US":"Review loan agreements and consider the implications of any breach of covenants."},"required":true},{"id":"loans-general-6","type":"AUDIT_PROCEDURE","procedureCode":"6","prompt":{"zh-CN":"计算贷款在非流动部分与流动部分之间的划分。","en-US":"Calculate the apportionment of the loan between non-current and current portions."},"required":true},{"id":"loans-general-7a","type":"AUDIT_PROCEDURE","procedureCode":"7a","prompt":{"zh-CN":"对于长期贷款，检查本年度贷款新增及偿还的支持性证据。","en-US":"For long-term loans, check supporting evidence for loan advances and repayments during the year."},"required":true},{"id":"loans-general-7b","type":"AUDIT_PROCEDURE","procedureCode":"7b","prompt":{"zh-CN":"对于长期贷款，检查与先前向公司注册处登记的押记相关的贷款清偿证明。","en-US":"For long-term loans, check the memorandum of satisfaction for loans relating to charges previously filed with the Company Registry."},"required":true},{"id":"loans-general-7c","type":"AUDIT_PROCEDURE","procedureCode":"7c","prompt":{"zh-CN":"对于长期贷款，确定贷款在有抵押／无抵押以及计息／不计息之间的分类。","en-US":"For long-term loans, determine the split of loans between secured/unsecured and interest-bearing/non-interest-bearing."},"required":true},{"id":"loans-general-7d","type":"AUDIT_PROCEDURE","procedureCode":"7d","prompt":{"zh-CN":"对于长期贷款，核实本期计提的利息及应计利息的充分性。","en-US":"For long-term loans, verify interest charged for the period and the adequacy of accrued interest."},"required":true},{"id":"loans-general-7e","type":"AUDIT_PROCEDURE","procedureCode":"7e","prompt":{"zh-CN":"对于长期贷款，确认自资产负债表日起一年后到期的应付贷款已按照适用的会计准则计量。","en-US":"For long-term loans, confirm that loans payable more than one year from the balance sheet date are measured in accordance with applicable accounting standards."},"required":true},{"id":"loans-general-8a","type":"AUDIT_PROCEDURE","procedureCode":"8a","prompt":{"zh-CN":"通过检查董事会会议记录，确保贷款的完整性。","en-US":"Ensure the completeness of loans by examining board minutes."},"required":true},{"id":"loans-general-8b","type":"AUDIT_PROCEDURE","procedureCode":"8b","prompt":{"zh-CN":"通过复核银行函证及其他往来函件，确保贷款的完整性。","en-US":"Ensure the completeness of loans by reviewing bank confirmations and other correspondence."},"required":true},{"id":"loans-general-8c","type":"AUDIT_PROCEDURE","procedureCode":"8c","prompt":{"zh-CN":"通过执行未记录负债的查找程序，确保贷款的完整性（详细程序请参阅贸易及其他应付款项审计程序）。","en-US":"Ensure the completeness of loans by performing a search for unrecorded liabilities (please refer to the audit programme for trade and other payables for detailed procedures)."},"required":true},{"id":"loans-general-9","type":"AUDIT_PROCEDURE","procedureCode":"9","prompt":{"zh-CN":"确保被审计单位按照适用的会计准则核算外币交易。","en-US":"Ensure the entity accounted for foreign currency transactions in accordance with applicable accounting standards."},"required":true},{"id":"loans-general-10","type":"AUDIT_PROCEDURE","procedureCode":"10","prompt":{"zh-CN":"确认所有货币性负债均已按适当的期末汇率折算。","en-US":"Confirm that all monetary liabilities have been translated at an appropriate closing rate."},"required":true}]},{"id":"loans-confirmation-additional","title":{"zh-CN":"贷款——函证补充程序","en-US":"Loans — Additional confirmation procedures"},"description":{"zh-CN":"在使用在线函证平台（例如 Confirmation.com）或电子邮件时，执行并记录以下补充程序。4.1a–4.1c 适用于在线平台；4.2a–4.2c 适用于电子邮件。","en-US":"When an online confirmation platform (for example, Confirmation.com) or email is used, perform and document the following additional procedures. Items 4.1a–4.1c apply to online platforms; items 4.2a–4.2c apply to email."},"questions":[{"id":"loans-confirmation-additional-4.1a","type":"AUDIT_PROCEDURE","procedureCode":"4.1a","prompt":{"zh-CN":"核实通过在线函证平台请求并下载的函证是否来自可信来源，例如核验其域名，并检查函证是否通过被询证方指定的在线函证平台发出及接收。","en-US":"Verify that the confirmation requested and downloaded through the online confirmation platform comes from a trusted source, including verification of its domain and whether the confirmation was requested and received through the platform designated by the confirming party."},"required":true},{"id":"loans-confirmation-additional-4.1b","type":"AUDIT_PROCEDURE","procedureCode":"4.1b","prompt":{"zh-CN":"核实回复人是否为获授权回复函证请求的人员，例如检查相关提醒邮件是否来自在线函证平台。","en-US":"Verify that the responder is authorized to reply to the confirmation request, for example by checking that the alert email comes from the online confirmation platform."},"required":true},{"id":"loans-confirmation-additional-4.1c","type":"AUDIT_PROCEDURE","procedureCode":"4.1c","prompt":{"zh-CN":"核实函证回函是否在安全环境中返回，并通过评估平台或内容是否采用适当加密技术，降低被截取／篡改的风险并确保回函来源可验证。","en-US":"Verify that the confirmation response is returned in a secure environment and assess whether appropriate encryption mitigates interception or alteration risks and provides evidence of the response origin."},"required":true},{"id":"loans-confirmation-additional-4.2a","type":"AUDIT_PROCEDURE","procedureCode":"4.2a","prompt":{"zh-CN":"核实通过电子邮件发送和接收的函证是否来自可信地址，例如核验邮件域名，并与被询证方网站、名片、目录或其他支持性证据所列的指定邮箱核对。","en-US":"Verify that confirmations sent and received by email come from a trusted address, including domain verification and comparison with the address designated on the confirming party’s website, business card, catalogue, or other supporting evidence."},"required":true},{"id":"loans-confirmation-additional-4.2b","type":"AUDIT_PROCEDURE","procedureCode":"4.2b","prompt":{"zh-CN":"核实回复人是否为获授权回复函证请求的人员，例如确认邮件来自被询证方的财务总监或函证中所列的同一被询证方。","en-US":"Verify that the responder is authorized to reply to the confirmation request, for example by confirming that the email was received from the confirming party’s financial controller or the same party identified in the confirmation."},"required":true},{"id":"loans-confirmation-additional-4.2c","type":"AUDIT_PROCEDURE","procedureCode":"4.2c","prompt":{"zh-CN":"核实电子邮件回函是否在安全环境中返回，并通过评估电子邮件或内容是否采用适当加密技术，降低被截取／篡改的风险并确保回函来源可验证。","en-US":"Verify that the email confirmation response is returned in a secure environment and assess whether appropriate encryption mitigates interception or alteration risks and provides evidence of the response origin."},"required":true}]},{"id":"loans-presentation","title":{"zh-CN":"贷款——列报与披露","en-US":"Loans — Presentation and disclosure"},"description":{"zh-CN":"评估贷款相关列报和披露是否有充分、适当的审计证据支持。","en-US":"Evaluate whether the presentation and disclosures relating to loans are supported by sufficient appropriate audit evidence."},"questions":[{"id":"loans-presentation-11","type":"AUDIT_PROCEDURE","procedureCode":"11","prompt":{"zh-CN":"确保审计档案中有充分、适当的证据支持所有已作出的披露。","en-US":"Ensure that there is sufficient appropriate evidence on the file to support all disclosures made."},"required":true}]},{"id":"loans-bespoke","title":{"zh-CN":"贷款——定制测试","en-US":"Loans — Bespoke tests"},"description":{"zh-CN":"记录并执行因本项目具体情况而需要的额外审计程序。","en-US":"Document and perform additional audit procedures required by the specific circumstances of the engagement."},"questions":[{"id":"loans-bespoke-12","type":"AUDIT_PROCEDURE","procedureCode":"12","prompt":{"zh-CN":"如有需要，设计并执行必要的额外测试，并与相关工作底稿中的审计目标相互索引。","en-US":"Draft and perform any necessary additional tests if required and cross reference with the objectives on the relevant working paper."},"required":true}]},{"id":"loans-conclusion","title":{"zh-CN":"贷款——结论程序","en-US":"Loans — Conclusion procedures"},"description":{"zh-CN":"完成贷款审计程序的收尾评估。","en-US":"Complete the closing assessment for the loans audit programme."},"questions":[{"id":"loans-conclusion-13","type":"AUDIT_PROCEDURE","procedureCode":"13","prompt":{"zh-CN":"考虑是否存在需要纳入管理层声明书或向治理层报告的事项，并作适当记录。","en-US":"Consider whether there are any points which need to be included in a letter of representation or report to those charged with governance and record as appropriate."},"required":true},{"id":"loans-conclusion-14","type":"AUDIT_PROCEDURE","procedureCode":"14","prompt":{"zh-CN":"复核本领域对内部控制的计划依赖程度，并考虑该依赖程度是否仍然适当。","en-US":"Review the planned extent of reliance on internal controls in this area and consider whether this remains appropriate."},"required":true},{"id":"loans-conclusion-15","type":"AUDIT_PROCEDURE","procedureCode":"15","prompt":{"zh-CN":"根据已取得的审计证据，评估是否应修订初始重要性水平和／或风险评估。记录任何必要调整的详情，并考虑其对剩余审计工作及截至目前已执行工作的影响。","en-US":"Assess whether the initial materiality and/or risk assessment should be revised in view of the audit evidence obtained. Record details of any necessary adjustments. Consider the impact on the remainder of the audit work and on any work undertaken to date."},"required":true}]},{"id":"loans-final-conclusion","title":{"zh-CN":"贷款——最终结论","en-US":"Loans — Final conclusion"},"description":{"zh-CN":"请依据已执行的审计工作完成最终结论；如存在例外事项，请在后续文本框中说明。","en-US":"Complete the final conclusion based on the audit work performed. Describe any exceptions in the following text field."},"questions":[{"id":"loans-final-conclusion-confirmation","type":"SINGLE_SELECT","prompt":{"zh-CN":"最终结论","en-US":"Final conclusion"},"helpText":{"zh-CN":"根据已执行的审计工作，我确认：已按照审计程序执行工作；已充分记录所执行的工作及取得的结果；已收集财务报表列报与披露所需的全部资料；已取得充分、适当的证据支持所达成的审计结论；并且在我看来，贷款已得到公允列报（如未公允列报，请在下方说明）。","en-US":"From the audit work carried out, I confirm that: the work has been performed in accordance with the audit programme; the work performed and results obtained have been adequately documented; all necessary information has been collected for presentation and disclosure in the financial statements; sufficient appropriate evidence has been obtained to support the audit conclusion reached; and, in my opinion, loans are fairly stated (if not, describe below)."},"required":true,"options":[{"id":"confirmed","label":{"zh-CN":"确认，无例外事项","en-US":"Confirmed without exception"}},{"id":"exception","label":{"zh-CN":"存在例外事项","en-US":"Exception noted"}}]},{"id":"loans-final-conclusion-details","type":"TEXT","prompt":{"zh-CN":"例外事项或补充说明（可选）","en-US":"Exception details or additional notes (optional)"},"required":false}]}]}$loans$::jsonb;
  deferred_definition JSONB := $deferred${"title":{"zh-CN":"审计程序——递延收入","en-US":"Audit Programme — Deferred Income"},"description":{"zh-CN":"由原工作簿“Deferred income”工作表转换而成的中英双语智能表单。每项可执行程序均使用结构化的“是否执行、执行结果、底稿引用和备注”记录。","en-US":"Bilingual SmartForm converted from the Deferred income worksheet. Each executable procedure uses a structured Test required, Result, Working paper references and Comments record."},"sections":[{"id":"deferred-income-general","title":{"zh-CN":"递延收入——一般审计程序","en-US":"Deferred income — General audit procedures"},"description":{"zh-CN":"审计目标：1）确保递延收入已正确核算且记录完整；2）确认递延收入所需披露均已作出，且相关信息已得到适当列报和说明。","en-US":"Audit objectives: (1) Ensure that deferred income has been correctly accounted for and is complete. (2) Confirm that all necessary disclosures concerning deferred income have been made and that the information is appropriately presented and described."},"questions":[{"id":"deferred-income-general-1","type":"AUDIT_PROCEDURE","procedureCode":"1","prompt":{"zh-CN":"取得并检查（或编制）本年度的主表，并将其与总账核对。","en-US":"Obtain and check, or prepare, a lead schedule for the current year’s figures and reconcile this to the general ledger."},"required":true},{"id":"deferred-income-general-2a","type":"AUDIT_PROCEDURE","procedureCode":"2a","prompt":{"zh-CN":"执行分析程序，将本期数据与以前期间的数据进行比较；","en-US":"Carry out analytical procedures by comparing the current figures with those of prior periods."},"required":true},{"id":"deferred-income-general-2b","type":"AUDIT_PROCEDURE","procedureCode":"2b","prompt":{"zh-CN":"执行分析程序，复核并比较关键比率或其他绩效指标。","en-US":"Carry out analytical procedures by reviewing and comparing key ratios or other performance indicators."},"required":true},{"id":"deferred-income-general-3","type":"AUDIT_PROCEDURE","procedureCode":"3","prompt":{"zh-CN":"复核超过执行重要性水平或其他异常的项目，并进行验证。","en-US":"Review for items above performance materiality or that are otherwise unusual and verify."},"required":true},{"id":"deferred-income-general-4a","type":"AUDIT_PROCEDURE","procedureCode":"4a","prompt":{"zh-CN":"复核递延收入的确认基础并核对支持性文件；","en-US":"Review the basis for deferring income and vouch to supporting documents; and"},"required":true},{"id":"deferred-income-general-4b","type":"AUDIT_PROCEDURE","procedureCode":"4b","prompt":{"zh-CN":"复核递延收入的确认基础，确保该基础有效、完整，并已按照与上年度一致的方法及适用会计准则正确应用。","en-US":"Review the basis for deferring income and ensure that it is valid and complete and has been correctly and consistently applied with the prior year and applicable accounting standards."},"required":true},{"id":"deferred-income-general-5","type":"AUDIT_PROCEDURE","procedureCode":"5","prompt":{"zh-CN":"确保被审计单位按照适用的会计准则核算外币交易。","en-US":"Ensure the entity accounted for foreign currency transactions in accordance with applicable accounting standards."},"required":true},{"id":"deferred-income-general-6","type":"AUDIT_PROCEDURE","procedureCode":"6","prompt":{"zh-CN":"确认所有货币性负债均已按适当的期末汇率折算。","en-US":"Confirm that all monetary liabilities have been translated at an appropriate closing rate."},"required":true}]},{"id":"deferred-income-presentation","title":{"zh-CN":"递延收入——列报与披露","en-US":"Deferred income — Presentation and disclosure"},"description":{"zh-CN":"评估递延收入相关列报和披露是否有充分、适当的审计证据支持。","en-US":"Evaluate whether the presentation and disclosures relating to deferred income are supported by sufficient appropriate audit evidence."},"questions":[{"id":"deferred-income-presentation-7","type":"AUDIT_PROCEDURE","procedureCode":"7","prompt":{"zh-CN":"确保审计档案中有充分、适当的证据支持所有已作出的披露。","en-US":"Ensure that there is sufficient appropriate evidence on the file to support all disclosures made."},"required":true}]},{"id":"deferred-income-bespoke","title":{"zh-CN":"递延收入——定制测试","en-US":"Deferred income — Bespoke tests"},"description":{"zh-CN":"记录并执行因本项目具体情况而需要的额外审计程序。","en-US":"Document and perform additional audit procedures required by the specific circumstances of the engagement."},"questions":[{"id":"deferred-income-bespoke-8","type":"AUDIT_PROCEDURE","procedureCode":"8","prompt":{"zh-CN":"如有需要，设计并执行必要的额外测试，并与相关工作底稿中的审计目标相互索引。","en-US":"Draft and perform any necessary additional tests if required and cross reference with the objectives on the relevant working paper."},"required":true}]},{"id":"deferred-income-conclusion","title":{"zh-CN":"递延收入——结论程序","en-US":"Deferred income — Conclusion procedures"},"description":{"zh-CN":"完成递延收入审计程序的收尾评估。","en-US":"Complete the closing assessment for the deferred income audit programme."},"questions":[{"id":"deferred-income-conclusion-9","type":"AUDIT_PROCEDURE","procedureCode":"9","prompt":{"zh-CN":"考虑是否存在需要纳入管理层声明书或向治理层报告的事项，并作适当记录。","en-US":"Consider whether there are any points which need to be included in a letter of representation or report to those charged with governance and record as appropriate."},"required":true},{"id":"deferred-income-conclusion-10","type":"AUDIT_PROCEDURE","procedureCode":"10","prompt":{"zh-CN":"复核本领域对内部控制的计划依赖程度，并考虑该依赖程度是否仍然适当。","en-US":"Review the planned extent of reliance on internal controls in this area and consider whether this remains appropriate."},"required":true},{"id":"deferred-income-conclusion-11","type":"AUDIT_PROCEDURE","procedureCode":"11","prompt":{"zh-CN":"根据已取得的审计证据，评估是否应修订初始重要性水平和／或风险评估。记录任何必要调整的详情，并考虑其对剩余审计工作及截至目前已执行工作的影响。","en-US":"Assess whether the initial materiality and/or risk assessment should be revised in view of the audit evidence obtained. Record details of any necessary adjustments. Consider the impact on the remainder of the audit work and on any work undertaken to date."},"required":true}]},{"id":"deferred-income-final-conclusion","title":{"zh-CN":"递延收入——最终结论","en-US":"Deferred income — Final conclusion"},"description":{"zh-CN":"请依据已执行的审计工作完成最终结论；如存在例外事项，请在后续文本框中说明。","en-US":"Complete the final conclusion based on the audit work performed. Describe any exceptions in the following text field."},"questions":[{"id":"deferred-income-final-conclusion-confirmation","type":"SINGLE_SELECT","prompt":{"zh-CN":"最终结论","en-US":"Final conclusion"},"helpText":{"zh-CN":"根据已执行的审计工作，我确认：已按照审计程序执行工作；已充分记录所执行的工作及取得的结果；已收集财务报表列报与披露所需的全部资料；已取得充分、适当的证据支持所达成的审计结论；并且在我看来，递延收入已得到公允列报（如未公允列报，请在下方说明）。","en-US":"From the audit work carried out, I confirm that: the work has been performed in accordance with the audit programme; the work performed and results obtained have been adequately documented; all necessary information has been collected for presentation and disclosure in the financial statements; sufficient appropriate evidence has been obtained to support the audit conclusion reached; and, in my opinion, deferred income is fairly stated (if not, describe below)."},"required":true,"options":[{"id":"confirmed","label":{"zh-CN":"确认，无例外事项","en-US":"Confirmed without exception"}},{"id":"exception","label":{"zh-CN":"存在例外事项","en-US":"Exception noted"}}]},{"id":"deferred-income-final-conclusion-details","type":"TEXT","prompt":{"zh-CN":"例外事项或补充说明（可选）","en-US":"Exception details or additional notes (optional)"},"required":false}]}]}$deferred$::jsonb;
BEGIN
  SELECT "created_by"
    INTO actor_id
    FROM "smart_form_templates"
   WHERE "code" = 'SF-AUD-LOANS-DEFERRED-INCOME'
   LIMIT 1;

  IF actor_id IS NULL THEN
    SELECT "id"
      INTO actor_id
      FROM "users"
     WHERE "global_role" = 'SUPER_ADMIN'
     ORDER BY "created_at" ASC
     LIMIT 1;
  END IF;

  IF actor_id IS NULL THEN
    RAISE NOTICE 'Skipping SmartForm template split because no super administrator exists';
    RETURN;
  END IF;

  INSERT INTO "smart_form_templates" (
    "id",
    "code",
    "name",
    "description",
    "status",
    "draft_definition_json",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at"
  )
  VALUES (
    'sft_audit_loans_20260730',
    'SF-AUD-LOANS',
    $name$Audit Programme — Loans$name$,
    $description$Bilingual loans audit programme converted from the Loans worksheet. Each executable procedure uses a structured audit-procedure response.$description$,
    'PUBLISHED',
    loans_definition,
    actor_id,
    actor_id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("code") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "status" = 'PUBLISHED',
    "draft_definition_json" = EXCLUDED."draft_definition_json",
    "updated_by" = actor_id,
    "updated_at" = CURRENT_TIMESTAMP
  RETURNING "id" INTO loans_template_id;

  INSERT INTO "smart_form_template_versions" (
    "id",
    "template_id",
    "version",
    "definition_json",
    "definition_hash",
    "published_by",
    "published_at"
  )
  VALUES (
    loans_version_id,
    loans_template_id,
    COALESCE((
      SELECT MAX("version") + 1
        FROM "smart_form_template_versions"
       WHERE "template_id" = loans_template_id
    ), 1),
    loans_definition,
    '63e73fb311cf1f4596017f456bc63db3df211ef0a44718cc3ff135d0c47ef2a9',
    actor_id,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("id") DO NOTHING;

  UPDATE "smart_form_templates"
     SET "current_published_version_id" = loans_version_id,
         "status" = 'PUBLISHED',
         "updated_by" = actor_id,
         "updated_at" = CURRENT_TIMESTAMP
   WHERE "id" = loans_template_id;

  INSERT INTO "smart_form_templates" (
    "id",
    "code",
    "name",
    "description",
    "status",
    "draft_definition_json",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at"
  )
  VALUES (
    'sft_audit_deferred_income_20260730',
    'SF-AUD-DEFERRED-INCOME',
    $name$Audit Programme — Deferred Income$name$,
    $description$Bilingual deferred-income audit programme converted from the Deferred income worksheet. Each executable procedure uses a structured audit-procedure response.$description$,
    'PUBLISHED',
    deferred_definition,
    actor_id,
    actor_id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("code") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "status" = 'PUBLISHED',
    "draft_definition_json" = EXCLUDED."draft_definition_json",
    "updated_by" = actor_id,
    "updated_at" = CURRENT_TIMESTAMP
  RETURNING "id" INTO deferred_template_id;

  INSERT INTO "smart_form_template_versions" (
    "id",
    "template_id",
    "version",
    "definition_json",
    "definition_hash",
    "published_by",
    "published_at"
  )
  VALUES (
    deferred_version_id,
    deferred_template_id,
    COALESCE((
      SELECT MAX("version") + 1
        FROM "smart_form_template_versions"
       WHERE "template_id" = deferred_template_id
    ), 1),
    deferred_definition,
    '5658e683bbbcae509562a69f1e099f5c36b9c03868f72ba41865a68cc479b43b',
    actor_id,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("id") DO NOTHING;

  UPDATE "smart_form_templates"
     SET "current_published_version_id" = deferred_version_id,
         "status" = 'PUBLISHED',
         "updated_by" = actor_id,
         "updated_at" = CURRENT_TIMESTAMP
   WHERE "id" = deferred_template_id;

  UPDATE "smart_form_templates"
     SET "status" = 'ARCHIVED',
         "updated_by" = actor_id,
         "updated_at" = CURRENT_TIMESTAMP
   WHERE "code" = 'SF-AUD-LOANS-DEFERRED-INCOME'
     AND "status" <> 'ARCHIVED';
END
$$;
-- End of migration.
