import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderSystemEmail } from "../src/mail/system-email-template";
import type { SystemEmailTemplateInput } from "../src/mail/system-email-template";

const outputDirectory = path.resolve(
  process.argv[2] ?? ".artifacts/system-email-showcase"
);

const specimens: {
  fileName: string;
  label: string;
  input: SystemEmailTemplateInput;
}[] = [
  {
    fileName: "inbox-action-zh.html",
    label: "Inbox 待办通知 · 中文",
    input: {
      locale: "zh-CN",
      preheader: "ACC-2026-004 等待你进行 PIC 审批",
      eyebrow: "待办 · CMP",
      title: "ACC-2026-004 等待你进行 PIC 审批",
      body: "Jony Ma 提交了项目准入：Orchid Holdings 2026 audit。请检查项目资料并完成当前审批。",
      tone: "action",
      facts: [
        { label: "申请编号", value: "ACC-2026-004" },
        { label: "当前步骤", value: "PIC 审批" },
        { label: "提交人", value: "Jony Ma" },
      ],
      action: {
        label: "查看并处理",
        url: "https://emp.superfx.cn/zh-CN/cmp/acceptance/ACC-2026-004",
      },
      notice:
        "该操作涉及项目承接决策，请仅在 Project Wing 的受信任页面中处理。",
    },
  },
  {
    fileName: "otp-security-zh.html",
    label: "登录验证码 · 中文",
    input: {
      locale: "zh-CN",
      brandName: "Project Wing",
      productName: "Project Wing",
      preheader: "您的登录验证码将在 5 分钟后失效",
      eyebrow: "安全验证",
      title: "邮箱验证码",
      body: "您好，您正在进行身份验证，请使用以下验证码完成操作。",
      tone: "security",
      verificationCode: "482731",
      notice:
        "验证码 5 分钟内有效，请勿将验证码透露给他人。\n若非本人操作，请忽略此邮件。",
      action: {
        label: "前往登录",
        url: "https://emp.superfx.cn/zh-CN/login",
      },
    },
  },
  {
    fileName: "archive-success-en.html",
    label: "Archive completion · English",
    input: {
      locale: "en-US",
      preheader: "HBR-2026-ACC was archived successfully",
      eyebrow: "Completed · EMP",
      title: "Project archived successfully",
      body: "Harbour accounting support has completed final archive processing. The immutable archive package is now available to authorized project members.",
      tone: "success",
      facts: [
        {
          label: "Project",
          value: "HBR-2026-ACC · Harbour accounting support",
        },
        { label: "Archive package", value: "HBR-2026-ACC-final-archive.zip" },
        { label: "Completed", value: "25 Aug 2026 · 17:00 (UTC+8)" },
      ],
      action: {
        label: "Open project",
        url: "https://emp.superfx.cn/en-US/engagement/HBR-2026-ACC",
      },
    },
  },
  {
    fileName: "confirmation-external-en.html",
    label: "External confirmation · English",
    input: {
      locale: "en-US",
      brandName: "Wing Zenith",
      productName: "Audit Confirmation Centre",
      preheader: "Bank confirmation request for Harbour Retail Limited",
      eyebrow: "Audit confirmation",
      title: "Request for confirmation of information",
      body: "Dear Sir or Madam,\n\nPlease complete the attached bank confirmation for Harbour Retail Limited and return it using the instructions in the document. Your response will be provided directly to our audit team.",
      tone: "neutral",
      facts: [
        { label: "Client", value: "Harbour Retail Limited" },
        { label: "Reference", value: "C-01-F001" },
        { label: "Prepared by", value: "Leo Li · Audit team" },
      ],
      notice:
        "The requested document is attached to this email. Please verify the sender address before opening attachments.",
      footerNote:
        "This message was sent by an authorized project team member through the Project Wing Confirmation Centre.",
    },
  },
];

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const brandIcon = await readFile(
    path.resolve(process.cwd(), "../emp/public/brand/icon-white-green.svg")
  );
  const brandIconSource = `data:image/svg+xml;base64,${brandIcon.toString("base64")}`;
  const verificationFooter = await readFile(
    path.resolve(
      process.cwd(),
      "src/mail/assets/project-wing-verification-footer.png"
    )
  );
  const verificationShieldSource = svgDataUri(verificationShieldSvg);
  const verificationFooterSource = `data:image/png;base64,${verificationFooter.toString("base64")}`;

  for (const specimen of specimens) {
    const rendered = renderSystemEmail(specimen.input, {
      brandIconSource,
      verificationFooterSource,
      verificationShieldSource,
    });
    await writeFile(
      path.resolve(outputDirectory, specimen.fileName),
      rendered.html
    );
  }

  const cards = specimens
    .map(
      (specimen) => `<section>
      <div class="label">${escapeHtml(specimen.label)}</div>
      <iframe title="${escapeHtml(specimen.label)}" src="./${specimen.fileName}"></iframe>
      <a href="./${specimen.fileName}" target="_blank">Open full preview →</a>
    </section>`
    )
    .join("");

  await writeFile(
    path.resolve(outputDirectory, "index.html"),
    `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Project Wing email system proposal</title>
      <style>
        * { box-sizing: border-box; }
        :root { color-scheme: light; }
        body { margin: 0; background: #f5f5f5; color: #242424; font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif; }
        .topbar { min-height: 56px; background: #fff; border-bottom: 1px solid #e0e0e0; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
        .topbar-inner { max-width: 1480px; min-height: 56px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; gap: 12px; }
        .brand-mark { width: 32px; height: 32px; border: 1px solid #e0e0e0; border-radius: 4px; background: #fff; object-fit: cover; }
        .brand-name { font-size: 14px; font-weight: 600; }
        .badge { margin-left: auto; padding: 3px 8px; border: 1px solid #9fd5b5; border-radius: 999px; background: #e9f5ee; color: #0e6f3a; font-size: 12px; font-weight: 600; }
        header { max-width: 1480px; margin: 0 auto; padding: 32px 24px 20px; }
        h1 { margin: 0; font-size: 28px; line-height: 36px; font-weight: 600; letter-spacing: -.015em; }
        p { max-width: 820px; margin: 8px 0 0; color: #616161; font-size: 14px; line-height: 22px; }
        main { max-width: 1480px; margin: 0 auto; padding: 0 24px 48px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        section { min-width: 0; padding: 12px; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
        .label { min-height: 40px; padding: 7px 8px 11px; color: #424242; font-size: 13px; font-weight: 600; }
        iframe { width: 100%; height: 720px; border: 1px solid #e0e0e0; border-radius: 4px; background: #f5f5f5; }
        a { display: inline-block; margin: 10px 0 0; padding: 7px 10px; border-radius: 4px; color: #0e6f3a; font-size: 13px; font-weight: 600; text-decoration: none; }
        a:hover { background: #e9f5ee; }
        @media (max-width: 980px) { main { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <div class="topbar">
        <div class="topbar-inner">
          <img class="brand-mark" src="${brandIconSource}" alt="Project Wing">
          <span class="brand-name">Project Wing · Email system</span>
          <span class="badge">Fluent green · Proposed</span>
        </div>
      </div>
      <header>
        <h1>HTML 邮件视觉提案</h1>
        <p>采用 Fluent 2 的信息层级、组件比例和中性色体系，并以 Project Wing 绿色作为品牌色。邮件保持无追踪像素，同时提供纯文本回退。</p>
      </header>
      <main>${cards}</main>
    </body>
  </html>`
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function svgDataUri(value: string) {
  return `data:image/svg+xml;base64,${Buffer.from(value).toString("base64")}`;
}

const verificationShieldSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 26"><path fill="#15966f" d="M12 1.4 21 5v7.1c0 6.2-3.7 10.4-9 12.5-5.3-2.1-9-6.3-9-12.5V5l9-3.6Z"/><rect width="8" height="7" x="8" y="11" rx="1.5" fill="#fff"/><path fill="none" stroke="#fff" stroke-linecap="round" stroke-width="1.8" d="M9.5 11V9.5a2.5 2.5 0 0 1 5 0V11"/><circle cx="12" cy="14.2" r="1" fill="#15966f"/></svg>`;

void main();
