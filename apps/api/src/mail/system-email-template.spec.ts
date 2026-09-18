import { renderSystemEmail } from "./system-email-template";

describe(renderSystemEmail, () => {
  it("renders an email-safe HTML document and plain-text fallback", () => {
    const rendered = renderSystemEmail({
      locale: "zh-CN",
      preheader: "请处理审批",
      eyebrow: "待办",
      title: "ACC-2026-001 等待你审批",
      body: "申请已进入你的审批环节。",
      facts: [{ label: "申请编号", value: "ACC-2026-001" }],
      action: {
        label: "查看申请",
        url: "https://emp.example.com/zh-CN/cmp/acceptance/1",
      },
    });

    expect(rendered.html).toContain("<!doctype html>");
    expect(rendered.html).toContain("ACC-2026-001 等待你审批");
    expect(rendered.html).toContain("查看申请&nbsp;&nbsp;→");
    expect(rendered.html).toContain('src="cid:project-wing-brand"');
    expect(rendered.html).not.toContain(">PW</td>");
    expect(rendered.text).toContain("查看申请: https://emp.example.com");
  });

  it("escapes every dynamic value", () => {
    const rendered = renderSystemEmail({
      locale: "en-US",
      preheader: "<unsafe>",
      eyebrow: "Alert",
      title: "<script>alert(1)</script>",
      body: "Hello <img src=x onerror=alert(1)>",
      facts: [{ label: "File", value: "<b>audit.xlsx</b>" }],
    });

    expect(rendered.html).not.toContain("<script>alert(1)</script>");
    expect(rendered.html).not.toContain("<img src=x");
    expect(rendered.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(rendered.html).toContain("&lt;b&gt;audit.xlsx&lt;/b&gt;");
  });

  it("rejects unsafe action protocols", () => {
    expect(() =>
      renderSystemEmail({
        locale: "en-US",
        preheader: "Unsafe",
        eyebrow: "Alert",
        title: "Unsafe action",
        body: "This should fail.",
        action: { label: "Open", url: `${"java"}script:alert(1)` },
      })
    ).toThrow("System email actions must use HTTPS.");
  });

  it("allows local HTTP links only for development previews", () => {
    const rendered = renderSystemEmail({
      locale: "en-US",
      preheader: "Local preview",
      eyebrow: "Preview",
      title: "Local action",
      body: "Open the local app.",
      action: { label: "Open", url: "http://127.0.0.1:3101/en-US" },
    });

    expect(rendered.html).toContain("http://127.0.0.1:3101/en-US");
  });

  it("renders verification codes as a centered branded security card", () => {
    const rendered = renderSystemEmail({
      locale: "zh-CN",
      brandName: "Wing Zenith",
      productName: "Project Wing",
      preheader: "验证码将在 5 分钟后失效",
      eyebrow: "安全验证",
      title: "邮箱验证码",
      body: "请使用以下验证码完成操作。",
      verificationCode: "482 731",
      notice: "请勿将验证码透露给他人。",
      action: {
        label: "前往登录",
        url: "https://emp.example.com/zh-CN/login",
      },
    });

    expect(rendered.html).toContain("482 731");
    expect(rendered.html).toContain("前往登录");
    expect(rendered.html).toContain("min-width:128px");
    expect(rendered.html).toContain('aria-hidden="true"');
    expect(rendered.html).toContain("cid:project-wing-verification-shield");
    expect(rendered.html).toContain("cid:project-wing-verification-footer");
  });
});
