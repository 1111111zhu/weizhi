import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { INBOX_CONTENT_KEYS } from "@project-wing/shared";
import type {
  InboxContentKey,
  InboxContentParameter,
} from "@project-wing/shared";

import { resolveInboxEmailContent } from "../src/inbox/inbox-email-content";
import { resolveInboxEmailPresentation } from "../src/inbox/inbox-email-presentation";
import { renderSystemEmail } from "../src/mail/system-email-template";
import type { SystemEmailTemplateInput } from "../src/mail/system-email-template";

type CatalogGroup =
  | "archive"
  | "cmp"
  | "external"
  | "project"
  | "review"
  | "security"
  | "tms";

type CatalogSpecimen = {
  fileName: string;
  group: CatalogGroup;
  input: SystemEmailTemplateInput;
  label: string;
};

const outputDirectory = path.resolve(
  process.argv[2] ?? ".artifacts/system-email-showcase"
);
const messageDirectory = path.join(outputDirectory, "catalog");

const groups: {
  description: string;
  id: CatalogGroup;
  title: string;
}[] = [
  {
    description: "登录与密码重置使用品牌验证卡。",
    id: "security",
    title: "安全验证",
  },
  {
    description: "项目邀请、底稿编制和复核完成。",
    id: "project",
    title: "项目与底稿",
  },
  {
    description: "待回复、已回复、补充追问和重开。",
    id: "review",
    title: "复核问题",
  },
  {
    description: "版本冲突、归档复核、退回、完成与期限提醒。",
    id: "archive",
    title: "归档与文件",
  },
  {
    description: "准入申请从草稿分派到最终批准的完整工作流。",
    id: "cmp",
    title: "CMP 准入审批",
  },
  {
    description: "工时退回与后续处理提醒。",
    id: "tms",
    title: "TMS",
  },
  {
    description: "通过企业邮箱发给外部被函证单位。",
    id: "external",
    title: "对外函证",
  },
];

async function main() {
  await mkdir(messageDirectory, { recursive: true });
  const brandIcon = await readFile(
    path.resolve(process.cwd(), "../emp/public/brand/icon-white-green.svg")
  );
  const footer = await readFile(
    path.resolve(
      process.cwd(),
      "src/mail/assets/project-wing-verification-footer.png"
    )
  );
  const assets = {
    brandIconSource: `data:image/svg+xml;base64,${brandIcon.toString("base64")}`,
    verificationFooterSource: `data:image/png;base64,${footer.toString("base64")}`,
    verificationShieldSource: svgDataUri(verificationShieldSvg),
  };
  const specimens = createSpecimens();
  for (const specimen of specimens) {
    const rendered = renderSystemEmail(specimen.input, assets);
    await writeFile(
      path.join(messageDirectory, specimen.fileName),
      rendered.html
    );
  }
  await writeFile(
    path.join(outputDirectory, "all-types.html"),
    renderCatalog(specimens, assets.brandIconSource)
  );
}

function createSpecimens(): CatalogSpecimen[] {
  return [
    createVerificationSpecimen("sign-in"),
    createVerificationSpecimen("password-reset"),
    ...INBOX_CONTENT_KEYS.map(createInboxSpecimen),
    createExternalConfirmationSpecimen(),
  ];
}

function createVerificationSpecimen(
  type: "password-reset" | "sign-in"
): CatalogSpecimen {
  const reset = type === "password-reset";
  return {
    fileName: `${type}.html`,
    group: "security",
    label: reset ? "密码重置验证码" : "登录验证码",
    input: {
      action: {
        label: reset ? "返回登录" : "前往登录",
        url: "https://emp.superfx.cn/zh-CN/login",
      },
      body: reset
        ? "您好，您正在重置 Project Wing 密码，请使用以下验证码完成操作。"
        : "您好，您正在进行身份验证，请使用以下验证码完成操作。",
      brandName: "Project Wing",
      eyebrow: reset ? "账户安全" : "安全验证",
      locale: "zh-CN",
      notice: reset
        ? "验证码 5 分钟内有效，请勿将验证码透露给他人。\n若非本人操作，请立即检查账户安全。"
        : "验证码 5 分钟内有效，请勿将验证码透露给他人。\n若非本人操作，请忽略此邮件。",
      preheader: reset
        ? "密码重置验证码将在 5 分钟后失效"
        : "登录验证码将在 5 分钟后失效",
      productName: "Project Wing",
      title: reset ? "密码重置验证码" : "邮箱验证码",
      tone: "security",
      verificationCode: reset ? "654321" : "482731",
    },
  };
}

function createInboxSpecimen(contentKey: InboxContentKey): CatalogSpecimen {
  const contentParams = resolveDemoParams(contentKey);
  const content = resolveInboxEmailContent(
    {
      contentKey,
      contentParams,
      fallbackBody: contentKey,
      fallbackTitle: contentKey,
    },
    "zh-CN"
  );
  const presentation = resolveInboxEmailPresentation({
    contentKey,
    contentParams,
    locale: content.locale,
  });
  return {
    fileName: `${contentKey.toLowerCase().replaceAll("_", "-")}.html`,
    group: resolveGroup(contentKey),
    label: content.title,
    input: {
      action: {
        label: presentation.actionLabel,
        url: resolveActionUrl(contentKey),
      },
      body: content.body,
      brandName: "Project Wing",
      eyebrow: presentation.eyebrow,
      facts: presentation.facts,
      locale: content.locale,
      preheader: content.body,
      productName: "Project Wing",
      title: content.title,
      tone: presentation.tone,
    },
  };
}

function resolveDemoParams(
  contentKey: InboxContentKey
): Record<string, InboxContentParameter> {
  const project = {
    projectCode: "ORC-2026-AUD",
    projectName: "Orchid Holdings 2026 audit",
  };
  const paper = {
    actor: "Jony Ma",
    paperCode: "C-01",
    paperTitle: "Cash current year lead schedule.xlsx",
  };
  const acceptance = {
    acceptanceType: "ENGAGEMENT",
    requestNo: "ACC-2026-004",
    subject: "Orchid Holdings 2026 audit",
  };
  if (contentKey === "PROJECT_INVITATION") {
    return { actor: "Jony Ma", ...project, role: "REVIEWER" };
  }
  if (contentKey.startsWith("WORKING_PAPER_")) {
    return paper;
  }
  if (contentKey.startsWith("REVIEW_QUESTION_")) {
    return {
      ...paper,
      question:
        "Please attach the signed bank confirmation and explain the reconciling items.",
    };
  }
  if (contentKey === "ATTACHMENT_CONFLICT") {
    return {
      candidateVersionId: "candidate-20260825-1635",
      fileName: "Cash current year lead schedule.xlsx",
    };
  }
  if (contentKey === "PROJECT_ARCHIVE_COMPLETED") {
    return { ...project, packageFileName: "ORC-2026-AUD-final-archive.zip" };
  }
  if (contentKey === "PROJECT_ARCHIVE_DEADLINE_REMINDER") {
    return { days: 5, deadline: "2026-08-30", ...project };
  }
  if (contentKey.startsWith("PROJECT_ARCHIVE_")) {
    return project;
  }
  if (contentKey === "TMS_TIMESHEET_RETURNED") {
    return {
      half: "FIRST_HALF",
      month: 8,
      reason: "Please correct the project allocation and resubmit.",
      year: 2026,
    };
  }
  if (contentKey === "CMP_ENGAGEMENT_APPROVED") {
    return { engagementCode: "ORC-2026-AUD" };
  }
  if (contentKey === "CMP_ACCEPTANCE_SUBMITTED") {
    return acceptance;
  }
  const actorAcceptance = { actor: "Jony Ma", ...acceptance };
  if (contentKey === "CMP_ACCEPTANCE_APPROVAL_REQUESTED") {
    return { ...actorAcceptance, step: "PIC" };
  }
  if (contentKey === "CMP_ACCEPTANCE_DRAFT_COMPLETED") {
    return { ...actorAcceptance, nextReviewer: "MIC" };
  }
  if (contentKey === "CMP_ACCEPTANCE_STEP_ADVANCED") {
    return { ...actorAcceptance, completedStep: "MIC", nextStep: "PIC" };
  }
  if (contentKey === "CMP_ACCEPTANCE_NEXT_APPROVER") {
    return { ...actorAcceptance, completedStep: "MIC" };
  }
  if (contentKey === "CMP_ACCEPTANCE_RETURNED") {
    return {
      ...actorAcceptance,
      reason: "Please revise the client information and resubmit.",
    };
  }
  return actorAcceptance;
}

function createExternalConfirmationSpecimen(): CatalogSpecimen {
  return {
    fileName: "external-confirmation.html",
    group: "external",
    label: "银行函证请求 · English",
    input: {
      body: "Dear Sir or Madam,\n\nPlease complete the attached bank confirmation for Harbour Retail Limited and return it using the instructions in the document. Your response will be provided directly to our audit team.",
      brandName: "Wing Zenith",
      eyebrow: "Audit confirmation",
      facts: [
        { label: "Client", value: "Harbour Retail Limited" },
        { label: "Reference", value: "C-01-F001" },
        { label: "Prepared by", value: "Leo Li · Audit team" },
      ],
      footerNote:
        "This message was sent by an authorized project team member through the Project Wing Confirmation Centre.",
      locale: "en-US",
      notice:
        "The requested document is attached. Verify the sender address before opening attachments.",
      preheader: "Bank confirmation request for Harbour Retail Limited",
      productName: "Audit Confirmation Centre",
      title: "Request for confirmation of information",
      tone: "neutral",
    },
  };
}

function resolveGroup(contentKey: InboxContentKey): CatalogGroup {
  if (contentKey.startsWith("CMP_")) {
    return "cmp";
  }
  if (contentKey.startsWith("TMS_")) {
    return "tms";
  }
  if (contentKey.startsWith("REVIEW_QUESTION_")) {
    return "review";
  }
  if (
    contentKey.startsWith("PROJECT_ARCHIVE_") ||
    contentKey === "ATTACHMENT_CONFLICT"
  ) {
    return "archive";
  }
  return "project";
}

function resolveActionUrl(contentKey: InboxContentKey) {
  if (contentKey.startsWith("CMP_")) {
    return "https://cmp.superfx.cn/zh-CN/acceptance?tab=approvals&requestId=acceptance-1";
  }
  if (contentKey.startsWith("TMS_")) {
    return "https://tms.superfx.cn/zh-CN/timesheet";
  }
  return "https://emp.superfx.cn/zh-CN/engagement/project-orchid-2026";
}

function renderCatalog(specimens: CatalogSpecimen[], brandIcon: string) {
  const navigation = groups
    .map(
      ({ id, title }) =>
        `<a class="nav-chip" href="#${id}">${title}<span>${specimens.filter((item) => item.group === id).length}</span></a>`
    )
    .join("");
  const content = groups
    .map(({ description, id, title }) => {
      const cards = specimens
        .filter((item) => item.group === id)
        .map(
          (item) => `<article class="specimen">
            <div class="specimen-heading"><strong>${escapeHtml(item.label)}</strong><code>${escapeHtml(item.fileName.replace(".html", ""))}</code></div>
            <iframe title="${escapeHtml(item.label)}" src="./catalog/${item.fileName}"></iframe>
            <a class="open" href="./catalog/${item.fileName}" target="_blank">单独打开 →</a>
          </article>`
        )
        .join("");
      return `<section class="group" id="${id}">
        <div class="group-heading"><div><h2>${title}</h2><p>${description}</p></div><span>${specimens.filter((item) => item.group === id).length} 种</span></div>
        <div class="grid">${cards}</div>
      </section>`;
    })
    .join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project Wing · 全部邮件类型</title><style>
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f5f5f5;color:#242424;font-family:'Segoe UI','Microsoft YaHei',sans-serif}.topbar{position:sticky;top:0;z-index:2;border-bottom:1px solid #e0e0e0;background:rgba(255,255,255,.96);box-shadow:0 1px 2px rgba(0,0,0,.04)}.topbar-inner{max-width:1480px;min-height:56px;margin:auto;padding:0 24px;display:flex;align-items:center;gap:12px}.brand{width:32px;height:32px}.brand-name{font-size:14px;font-weight:600}.status{margin-left:auto;padding:3px 8px;border:1px solid #9fd5b5;border-radius:999px;background:#e9f5ee;color:#0e6f3a;font-size:12px;font-weight:600}header{max-width:1480px;margin:auto;padding:32px 24px 20px}h1{margin:0;font-size:28px;line-height:36px;font-weight:600}header p,.group-heading p{margin:8px 0 0;color:#616161;font-size:14px;line-height:22px}.toc{max-width:1480px;margin:auto;padding:0 24px 24px;display:flex;flex-wrap:wrap;gap:8px}.nav-chip{display:flex;gap:8px;padding:7px 10px;border:1px solid #d1d1d1;border-radius:999px;background:#fff;color:#424242;font-size:13px;text-decoration:none}.nav-chip:hover{border-color:#107c41;background:#e9f5ee}.nav-chip span{color:#107c41;font-weight:700}main{max-width:1480px;margin:auto;padding:0 24px 64px}.group{scroll-margin-top:76px;margin-top:12px;padding-top:16px}.group-heading{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px}.group-heading h2{margin:0;font-size:20px;font-weight:600}.group-heading>span{padding:4px 8px;border-radius:4px;background:#e9f5ee;color:#0e6f3a;font-size:12px;font-weight:600}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.specimen{min-width:0;padding:12px;border:1px solid #e0e0e0;border-radius:8px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.05)}.specimen-heading{min-height:48px;padding:6px 8px 10px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.specimen-heading strong{font-size:13px;line-height:20px}.specimen-heading code{max-width:46%;overflow:hidden;color:#707070;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.specimen iframe{width:100%;height:680px;border:1px solid #e0e0e0;border-radius:4px;background:#f5f5f5}.open{display:inline-block;margin-top:8px;padding:7px 10px;border-radius:4px;color:#0e6f3a;font-size:13px;font-weight:600;text-decoration:none}.open:hover{background:#e9f5ee}@media(max-width:980px){.grid{grid-template-columns:1fr}.status{display:none}}
  </style></head><body><div class="topbar"><div class="topbar-inner"><img class="brand" src="${brandIcon}" alt="Project Wing"><span class="brand-name">Project Wing · 全部邮件类型</span><span class="status">${specimens.length} 个真实样板</span></div></div><header><h1>邮件类型目录</h1><p>使用生产模板、真实内容键和统一示例数据渲染。可以单独打开任意邮件检查完整尺寸。</p></header><nav class="toc">${navigation}</nav><main>${content}</main></body></html>`;
}

function svgDataUri(value: string) {
  return `data:image/svg+xml;base64,${Buffer.from(value).toString("base64")}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const verificationShieldSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 26"><path fill="#15966f" d="M12 1.4 21 5v7.1c0 6.2-3.7 10.4-9 12.5-5.3-2.1-9-6.3-9-12.5V5l9-3.6Z"/><rect width="8" height="7" x="8" y="11" rx="1.5" fill="#fff"/><path fill="none" stroke="#fff" stroke-linecap="round" stroke-width="1.8" d="M9.5 11V9.5a2.5 2.5 0 0 1 5 0V11"/><circle cx="12" cy="14.2" r="1" fill="#15966f"/></svg>`;

void main();
