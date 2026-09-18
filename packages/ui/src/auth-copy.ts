export type AuthLocale = "en-US" | "zh-CN";

export type AuthCopy = {
  authSessionRetry: string;
  authSessionUnavailable: string;
  back: string;
  codeSent: string;
  codeVerified: string;
  confirmPassword: string;
  developmentAccountWarning: string;
  developmentAccounts: string;
  developmentAccountsEmpty: string;
  developmentAccountsLoading: string;
  emailCode: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailRequired: string;
  forgotPassword: string;
  fontSize: string;
  hidePassword: string;
  invalidEmail: string;
  needAccount: string;
  newPassword: string;
  orContinueWith: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordRequired: string;
  passwordRequirements: string;
  resetPassword: string;
  resetSuccess: string;
  resendCode: string;
  resendCountdown: string;
  sendCode: string;
  showPassword: string;
  signIn: string;
  signInFailed: string;
  signUp: string;
  signUpUnavailable: string;
  verifyCode: string;
  wecom: string;
  wecomUnavailable: string;
};

const authCopy: Record<AuthLocale, AuthCopy> = {
  "en-US": {
    authSessionRetry: "Retry",
    authSessionUnavailable:
      "The account service is unavailable. Please try again.",
    back: "Back",
    codeSent:
      "If this email is registered, a code has been sent. Check your inbox and spam folder.",
    codeVerified: "Code verified. You can now choose a new password.",
    confirmPassword: "Confirm new password",
    developmentAccountWarning: "For developer mode only.",
    developmentAccounts: "Development accounts",
    developmentAccountsEmpty: "No development accounts available.",
    developmentAccountsLoading: "Loading accounts…",
    emailCode: "Email code",
    emailLabel: "Email",
    emailPlaceholder: "",
    emailRequired: "Enter your email address.",
    forgotPassword: "Forgot password?",
    fontSize: "Text size",
    hidePassword: "Hide password",
    invalidEmail: "Enter a valid email address.",
    needAccount: "Need an account?",
    newPassword: "New password",
    orContinueWith: "Or continue with",
    passwordLabel: "Password",
    passwordPlaceholder: "",
    passwordRequired: "Enter your password.",
    passwordRequirements: "Use at least 8 characters.",
    resetPassword: "Reset password",
    resetSuccess: "Password reset. Sign in with your new password.",
    resendCode: "Resend",
    resendCountdown: "Resend ({seconds}s)",
    sendCode: "Send code",
    showPassword: "Show password",
    signIn: "Sign in",
    signInFailed: "Unable to sign in. Please try again.",
    signUp: "Sign up",
    signUpUnavailable: "Email OTP sign-up is not available yet",
    verifyCode: "Verify code",
    wecom: "WeCom",
    wecomUnavailable: "WeCom is not available yet",
  },
  "zh-CN": {
    authSessionRetry: "重试",
    authSessionUnavailable: "账号服务暂时不可用，请稍后重试。",
    back: "返回",
    codeSent: "如果该邮箱已注册，验证码已发送。请检查收件箱和垃圾邮件文件夹。",
    codeVerified: "验证码正确，现在可以设置新密码。",
    confirmPassword: "确认新密码",
    developmentAccountWarning: "仅供开发者模式使用",
    developmentAccounts: "开发者账号",
    developmentAccountsEmpty: "暂无可用开发者账号",
    developmentAccountsLoading: "正在加载账号…",
    emailCode: "验证码",
    emailLabel: "邮箱",
    emailPlaceholder: "",
    emailRequired: "请输入邮箱地址。",
    forgotPassword: "忘记密码？",
    fontSize: "字号",
    hidePassword: "隐藏密码",
    invalidEmail: "请输入有效的邮箱地址。",
    needAccount: "还没有账号？",
    newPassword: "新密码",
    orContinueWith: "其他方式",
    passwordLabel: "密码",
    passwordPlaceholder: "",
    passwordRequired: "请输入密码。",
    passwordRequirements: "密码至少 8 位",
    resetPassword: "重置密码",
    resetSuccess: "密码已重置，请使用新密码登录",
    resendCode: "重新发送",
    resendCountdown: "重发 ({seconds}s)",
    sendCode: "发送验证码",
    showPassword: "显示密码",
    signIn: "登录",
    signInFailed: "无法登录，请重试。",
    signUp: "注册",
    signUpUnavailable: "邮箱OTP注册暂未开放",
    verifyCode: "验证",
    wecom: "企业微信",
    wecomUnavailable: "企业微信暂未接入",
  },
};

export function getAuthCopy(locale: AuthLocale): AuthCopy {
  return authCopy[locale];
}
