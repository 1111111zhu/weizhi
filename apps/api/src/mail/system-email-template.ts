export type SystemEmailLocale = "en-US" | "zh-CN";

export type SystemEmailTone =
  | "action"
  | "neutral"
  | "security"
  | "success"
  | "warning";

export type SystemEmailFact = {
  label: string;
  value: string;
};

export type SystemEmailTemplateInput = {
  locale: SystemEmailLocale;
  brandName?: string;
  productName?: string;
  preheader: string;
  eyebrow: string;
  title: string;
  body: string;
  tone?: SystemEmailTone;
  facts?: SystemEmailFact[];
  verificationCode?: string;
  action?: {
    label: string;
    url: string;
  };
  notice?: string;
  footerNote?: string;
};

export type RenderedSystemEmail = {
  html: string;
  text: string;
};

export type SystemEmailRenderOptions = {
  brandIconSource?: string;
  verificationFooterSource?: string;
  verificationShieldSource?: string;
};

type EmailTonePalette = {
  accent: string;
  soft: string;
  softDark: string;
};

type SafeEmailAction = {
  label: string;
  url: string;
} | null;

const emailColors = {
  canvas: "#f5f5f5",
  card: "#ffffff",
  cardDark: "#292929",
  canvasDark: "#1f1f1f",
  ink: "#242424",
  inkDark: "#ffffff",
  muted: "#616161",
  mutedDark: "#d1d1d1",
  border: "#e0e0e0",
  borderDark: "#525252",
  brand: "#107c41",
  brandStrong: "#0e6f3a",
  brandSoft: "#e9f5ee",
  brandSoftDark: "#123d29",
  warning: "#8a5d00",
  warningSoft: "#fff4ce",
  warningSoftDark: "#4a3b16",
  security: "#107c41",
  securitySoft: "#e9f5ee",
  securitySoftDark: "#123d29",
} as const;

const toneStyles: Record<SystemEmailTone, EmailTonePalette> = {
  action: {
    accent: emailColors.brandStrong,
    soft: emailColors.brandSoft,
    softDark: emailColors.brandSoftDark,
  },
  neutral: {
    accent: emailColors.muted,
    soft: "#f5f5f5",
    softDark: "#383838",
  },
  security: {
    accent: emailColors.security,
    soft: emailColors.securitySoft,
    softDark: emailColors.securitySoftDark,
  },
  success: {
    accent: emailColors.brand,
    soft: emailColors.brandSoft,
    softDark: emailColors.brandSoftDark,
  },
  warning: {
    accent: emailColors.warning,
    soft: emailColors.warningSoft,
    softDark: emailColors.warningSoftDark,
  },
};

export function renderSystemEmail(
  input: SystemEmailTemplateInput,
  options: SystemEmailRenderOptions = {}
): RenderedSystemEmail {
  const tone = input.tone ?? "neutral";
  const palette = toneStyles[tone];
  const brandName = input.brandName?.trim() || "Project Wing";
  const productName = input.productName?.trim() || "Project Wing";
  const brandIconSource =
    options.brandIconSource?.trim() || "cid:project-wing-brand";
  const verificationFooterSource =
    options.verificationFooterSource?.trim() ||
    "cid:project-wing-verification-footer";
  const verificationShieldSource =
    options.verificationShieldSource?.trim() ||
    "cid:project-wing-verification-shield";
  const direction = input.locale === "zh-CN" ? "zh-CN" : "en-US";
  const safeAction = input.action
    ? {
        label: input.action.label,
        url: normalizeActionUrl(input.action.url),
      }
    : null;
  const facts = (input.facts ?? []).filter(
    (fact) =>
      typeof fact.label === "string" &&
      typeof fact.value === "string" &&
      fact.label.trim() &&
      fact.value.trim()
  );
  const isVerification = Boolean(input.verificationCode);
  const emailContent = isVerification
    ? renderVerificationEmailContent(
        input,
        brandName,
        productName,
        brandIconSource,
        verificationShieldSource,
        verificationFooterSource,
        safeAction,
        palette
      )
    : renderStandardEmailContent(input, facts, safeAction, palette);

  const html = `<!doctype html>
<html lang="${direction}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escapeHtml(input.title)}</title>
    <style>
      :root { color-scheme: light dark; supported-color-schemes: light dark; }
      body { margin: 0 !important; padding: 0 !important; }
      table { border-collapse: collapse; border-spacing: 0; }
      img { border: 0; display: block; }
      a { text-decoration: none; }
      @media (max-width: 640px) {
        .email-shell { width: 100% !important; }
        .email-pad { padding-left: 24px !important; padding-right: 24px !important; }
        .email-title { font-size: 22px !important; line-height: 28px !important; }
        .email-action { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      }
      @media (prefers-color-scheme: dark) {
        .email-canvas { background: ${emailColors.canvasDark} !important; }
        .email-card { background: ${emailColors.cardDark} !important; border-color: ${emailColors.borderDark} !important; }
        .email-ink { color: ${emailColors.inkDark} !important; }
        .email-muted { color: ${emailColors.mutedDark} !important; }
        .email-border { border-color: ${emailColors.borderDark} !important; }
        .email-tone { background: ${palette.softDark} !important; }
        .email-fact { background: #333333 !important; border-color: ${emailColors.borderDark} !important; }
        .email-code { background: ${emailColors.brandSoftDark} !important; border-color: #35684a !important; color: #7dd3a1 !important; }
        .email-footer-link { color: #54b882 !important; }
      }
    </style>
    <!--[if mso]>
      <style>table, td, a, p, h1 { font-family: 'Segoe UI', Arial, sans-serif !important; }</style>
    <![endif]-->
  </head>
  <body class="email-canvas" style="margin:0;padding:0;background:${emailColors.canvas};font-family:'Segoe UI','Microsoft YaHei','PingFang SC',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" class="email-canvas" style="width:100%;background:${emailColors.canvas};">
      <tr>
        <td align="center" style="padding:32px 16px 40px;">
          <table role="presentation" width="${isVerification ? 480 : 600}" class="email-shell" style="width:${isVerification ? 480 : 600}px;max-width:${isVerification ? 480 : 600}px;">
            ${
              isVerification
                ? ""
                : `<tr>
              <td style="padding:0 2px 16px;">
                ${renderBrandLockup(brandName, productName, brandIconSource)}
              </td>
            </tr>`
            }
            <tr>
              <td class="email-card${isVerification ? " email-verification-card" : ""}" style="background:${emailColors.card};border:1px solid ${isVerification ? "#e9efec" : emailColors.border};border-radius:${isVerification ? 12 : 8}px;overflow:hidden;box-shadow:${isVerification ? "0 10px 30px rgba(31,41,55,.09)" : "0 2px 8px rgba(0,0,0,.08)"};">
                <table role="presentation" width="100%" style="width:100%;">
                  ${emailContent}
                </table>
              </td>
            </tr>
            ${
              isVerification
                ? ""
                : `<tr>
              <td align="center" style="padding:16px 24px 0;">
                <p class="email-muted" style="margin:0;color:${emailColors.muted};font-size:11px;line-height:18px;">${escapeHtml(defaultLegal(input.locale, brandName))}</p>
              </td>
            </tr>`
            }
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    html,
    text: renderPlainText({ ...input, action: safeAction ?? undefined }, facts),
  };
}

function renderStandardEmailContent(
  input: SystemEmailTemplateInput,
  facts: SystemEmailFact[],
  action: SafeEmailAction,
  palette: EmailTonePalette
) {
  return `<tr>
    <td style="height:4px;background:${palette.accent};font-size:0;line-height:0;">&nbsp;</td>
  </tr>
  <tr>
    <td class="email-pad" style="padding:32px 40px 8px;">
      <table role="presentation">
        <tr>
          <td width="8" style="width:8px;height:8px;background:${palette.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
          <td style="padding-left:9px;">
            <p style="margin:0;color:${palette.accent};font-size:12px;line-height:16px;font-weight:600;letter-spacing:.02em;">${escapeHtml(input.eyebrow)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td class="email-pad" style="padding:10px 40px 0;">
      <h1 class="email-title email-ink" style="margin:0;color:${emailColors.ink};font-size:24px;line-height:32px;font-weight:600;letter-spacing:-.01em;">${escapeHtml(input.title)}</h1>
    </td>
  </tr>
  <tr>
    <td class="email-pad" style="padding:16px 40px 0;">
      <div class="email-muted" style="color:${emailColors.muted};font-size:15px;line-height:24px;">${renderTextBlock(input.body)}</div>
    </td>
  </tr>
  ${facts.length ? renderFacts(facts) : ""}
  ${input.notice ? renderNotice(input.notice, palette) : ""}
  ${action ? renderAction(action.label, action.url, palette.accent) : ""}
  <tr>
    <td class="email-pad" style="padding:28px 40px 32px;">
      <table role="presentation" width="100%" style="width:100%;border-top:1px solid ${emailColors.border};" class="email-border">
        <tr>
          <td style="padding-top:16px;">
            <p class="email-muted" style="margin:0;color:${emailColors.muted};font-size:12px;line-height:18px;">${escapeHtml(input.footerNote ?? defaultFooter(input.locale))}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderVerificationEmailContent(
  input: SystemEmailTemplateInput,
  brandName: string,
  productName: string,
  brandIconSource: string,
  verificationShieldSource: string,
  verificationFooterSource: string,
  action: SafeEmailAction,
  palette: EmailTonePalette
) {
  return `<tr>
    <td align="center" class="email-pad" style="padding:30px 40px 0;">
      ${renderBrandLockup(brandName, productName, brandIconSource, true)}
    </td>
  </tr>
  <tr>
    <td align="center" class="email-pad" style="padding:22px 40px 0;">
      <table role="presentation" align="center" width="254" style="width:254px;max-width:100%;">
        <tr>
          <td width="106" style="width:106px;">
            <table role="presentation" width="100%" style="width:100%;"><tr><td class="email-border" height="1" style="height:1px;background:${emailColors.border};font-size:0;line-height:1px;">&nbsp;</td></tr></table>
          </td>
          <td width="42" align="center" style="width:42px;">
            <img src="${escapeHtml(verificationShieldSource)}" width="22" height="24" alt="" style="display:block;width:22px;height:24px;border:0;">
          </td>
          <td width="106" style="width:106px;">
            <table role="presentation" width="100%" style="width:100%;"><tr><td class="email-border" height="1" style="height:1px;background:${emailColors.border};font-size:0;line-height:1px;">&nbsp;</td></tr></table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" class="email-pad" style="padding:20px 48px 0;">
      <h1 class="email-title email-ink" style="margin:0;color:${emailColors.ink};font-size:25px;line-height:33px;font-weight:600;letter-spacing:-.01em;">${escapeHtml(input.title)}</h1>
    </td>
  </tr>
  <tr>
    <td align="center" class="email-pad" style="padding:12px 58px 0;">
      <div class="email-muted" style="color:${emailColors.muted};font-size:14px;line-height:22px;">${renderTextBlock(input.body)}</div>
    </td>
  </tr>
  ${renderVerificationCode(input.verificationCode ?? "")}
  ${input.notice ? renderVerificationNotice(input.notice) : ""}
  ${action ? renderCenteredAction(action.label, action.url, palette.accent) : ""}
  ${renderDecorativeFooter(verificationFooterSource)}`;
}

function renderBrandLockup(
  brandName: string,
  productName: string,
  brandIconSource: string,
  centered = false
) {
  const productLabel = productName === brandName ? "" : productName;
  const iconSize = centered ? 40 : 30;
  return `<table role="presentation"${centered ? ' align="center"' : ""}>
    <tr>
      <td width="${iconSize}" height="${iconSize}" style="width:${iconSize}px;height:${iconSize}px;background:#ffffff;${centered ? "" : `border:1px solid ${emailColors.border};`}border-radius:4px;vertical-align:middle;">
        <img src="${escapeHtml(brandIconSource)}" width="${iconSize}" height="${iconSize}" alt="" style="display:block;width:${iconSize}px;height:${iconSize}px;border:0;border-radius:3px;">
      </td>
      <td style="padding-left:11px;vertical-align:middle;">
        <p class="email-ink" style="margin:0;color:${centered ? "#153f3b" : emailColors.ink};font-size:${centered ? 20 : 14}px;line-height:${centered ? 26 : 18}px;font-weight:600;letter-spacing:${centered ? "-.02em" : "0"};">${escapeHtml(brandName)}</p>
        ${productLabel ? `<p class="email-muted" style="margin:2px 0 0;color:${emailColors.muted};font-size:11px;line-height:14px;">${escapeHtml(productLabel)}</p>` : ""}
      </td>
    </tr>
  </table>`;
}

function renderVerificationCode(code: string) {
  return `<tr>
    <td align="center" class="email-pad" style="padding:26px 54px 0;">
      <div class="email-code" style="background:${emailColors.brandSoft};border:1px solid #b7dfc6;border-radius:6px;padding:20px;color:${emailColors.brandStrong};font-family:Consolas,'Courier New',monospace;font-size:38px;line-height:44px;font-weight:600;letter-spacing:.18em;text-align:center;">${escapeHtml(code)}</div>
    </td>
  </tr>`;
}

function renderVerificationNotice(notice: string) {
  return `<tr>
    <td align="center" class="email-pad" style="padding:18px 58px 0;">
      <p class="email-muted" style="margin:0;color:${emailColors.muted};font-size:12px;line-height:20px;">${renderTextBlock(notice)}</p>
    </td>
  </tr>`;
}

function renderCenteredAction(label: string, url: string, accent: string) {
  return `<tr>
    <td align="center" class="email-pad" style="padding:22px 40px 0;">
      <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center" style="border-radius:4px;background:${accent};">
            <a class="email-action" href="${escapeHtml(url)}" target="_blank" style="display:inline-block;min-width:128px;padding:10px 20px;color:#ffffff;font-size:14px;line-height:20px;font-weight:600;border-radius:4px;text-align:center;">${escapeHtml(label)}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderDecorativeFooter(source: string) {
  return `<tr>
    <td aria-hidden="true" class="email-verification-footer" style="padding:8px 0 0;background:transparent;">
      <img src="${escapeHtml(source)}" width="478" alt="" style="display:block;width:100%;height:auto;border:0;">
    </td>
  </tr>`;
}

function renderFacts(facts: SystemEmailFact[]) {
  const rows = facts
    .map(
      (fact, index) => `<tr>
        <td class="email-muted" style="padding:${index === 0 ? 0 : 12}px 0 0;color:${emailColors.muted};font-size:12px;line-height:18px;vertical-align:top;width:34%;">${escapeHtml(fact.label)}</td>
        <td class="email-ink" style="padding:${index === 0 ? 0 : 12}px 0 0 18px;color:${emailColors.ink};font-size:14px;line-height:20px;font-weight:600;vertical-align:top;">${escapeHtml(fact.value)}</td>
      </tr>`
    )
    .join("");
  return `<tr>
    <td class="email-pad" style="padding:24px 40px 0;">
      <table role="presentation" width="100%" class="email-fact" style="width:100%;background:#fafafa;border:1px solid ${emailColors.border};border-radius:4px;">
        <tr><td style="padding:18px 20px;"><table role="presentation" width="100%" style="width:100%;">${rows}</table></td></tr>
      </table>
    </td>
  </tr>`;
}

function renderNotice(
  notice: string,
  palette: { accent: string; soft: string }
) {
  return `<tr>
    <td class="email-pad" style="padding:20px 40px 0;">
      <table role="presentation" width="100%" class="email-tone" style="width:100%;background:${palette.soft};border-radius:4px;">
        <tr>
          <td style="padding:12px 14px;border-left:3px solid ${palette.accent};border-radius:4px;">
            <p class="email-ink" style="margin:0;color:${emailColors.ink};font-size:13px;line-height:20px;">${escapeHtml(notice)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderAction(label: string, url: string, accent: string) {
  return `<tr>
    <td class="email-pad" style="padding:24px 40px 0;">
      <table role="presentation" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center" style="border-radius:4px;background:${accent};">
            <a class="email-action" href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:10px 18px;color:#ffffff;font-size:14px;line-height:20px;font-weight:600;border-radius:4px;">${escapeHtml(label)}&nbsp;&nbsp;→</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderTextBlock(value: string) {
  return escapeHtml(value).replaceAll(/\r?\n/g, "<br>");
}

function renderPlainText(
  input: SystemEmailTemplateInput,
  facts: SystemEmailFact[]
) {
  return [
    `${input.brandName?.trim() || "Project Wing"} · ${input.eyebrow}`,
    "",
    input.title,
    "",
    input.body,
    input.verificationCode ? `\n${input.verificationCode}` : null,
    facts.length
      ? `\n${facts.map((fact) => `${fact.label}: ${fact.value}`).join("\n")}`
      : null,
    input.notice ? `\n${input.notice}` : null,
    input.action ? `\n${input.action.label}: ${input.action.url}` : null,
    "",
    input.footerNote ?? defaultFooter(input.locale),
  ]
    .filter((part): part is string => part !== null)
    .join("\n");
}

function normalizeActionUrl(value: string) {
  const parsed = new URL(value);
  const isLocalHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new Error("System email actions must use HTTPS.");
  }
  return parsed.toString();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function defaultFooter(locale: SystemEmailLocale) {
  return locale === "zh-CN"
    ? "这是一封由系统自动生成的邮件，请勿直接回复。"
    : "This is an automated message. Please do not reply directly.";
}

function defaultLegal(locale: SystemEmailLocale, brandName: string) {
  return locale === "zh-CN"
    ? `由 ${brandName} 安全发送 · 邮件不包含跟踪像素`
    : `Sent securely by ${brandName} · No tracking pixels`;
}
