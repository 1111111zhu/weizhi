"use client";

import {
  CaseSensitive,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Languages,
  MoonStar,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ActionSwapButton } from "./action-swap";
import type { ActionSwapItem } from "./action-swap";
import type { AuthAdapter, AuthUser } from "./auth-adapter";
import { getAuthCopy } from "./auth-copy";
import type { AuthCopy, AuthLocale } from "./auth-copy";
import { DevelopmentAccountSelector } from "./development-account-selector";
import type { DevelopmentAccount } from "./development-account-selector";
import { MotionButton } from "./motion-button";
import type { MotionButtonProps } from "./motion-button";
import { MotionInput } from "./motion-input";
import { OtpInput } from "./otp-input";
import { ProjectWingTopBarBrand } from "./project-wing-top-bar";
import { TiltCard } from "./tilt-card";
import { useAuthController } from "./use-auth-controller";

export type { AuthCopy } from "./auth-copy";
export type { DevelopmentAccount } from "./development-account-selector";

const EMPTY_DEVELOPMENT_ACCOUNTS: readonly DevelopmentAccount[] = [];

export type AuthPageControls = {
  fontSize: "sm" | "md" | "lg";
  isDark: boolean;
  onToggleFontSize: () => void;
  onToggleLocale: () => void;
  onToggleTheme: () => void;
};

type AuthProps<User extends AuthUser> = {
  adapter: AuthAdapter<User>;
  brandHideText?: boolean;
  brandLines?: readonly [string, string, string];
  controls: AuthPageControls;
  developmentAccounts?: readonly DevelopmentAccount[];
  developmentAccountsLoading?: boolean;
  locale: AuthLocale;
  onAuthenticated: (user: User, autoLogin: boolean) => Promise<void> | void;
  storageKey: string;
};

export function Auth<User extends AuthUser>({
  adapter,
  brandHideText = false,
  brandLines,
  controls,
  developmentAccounts = EMPTY_DEVELOPMENT_ACCOUNTS,
  developmentAccountsLoading = false,
  locale = "en-US",
  onAuthenticated,
  storageKey,
}: AuthProps<User>) {
  const [showPassword, setShowPassword] = useState(false);
  const handleToggleFontSize = controls.onToggleFontSize;
  const handleToggleLocale = controls.onToggleLocale;
  const handleToggleTheme = controls.onToggleTheme;
  const auth = useAuthController({ adapter, onAuthenticated, storageKey });
  const copy = getAuthCopy(locale);
  const error = getAuthErrorState(auth.error, copy);
  const isResettingPassword = auth.mode === "reset";
  const showDevelopmentAccountSelector =
    Boolean(adapter.impersonateDevelopmentAccount) &&
    developmentAccounts.length > 0;
  const showResend = auth.codeSent && !auth.resetVerified;
  const submitActions: ActionSwapItem[] = [
    { id: "sign-in", label: copy.signIn },
    { id: "send-code", label: copy.sendCode },
    { id: "verify-code", label: copy.verifyCode },
    { id: "reset-password", label: copy.resetPassword },
    {
      id: "success",
      ariaLabel: copy.signIn,
      label: <Check aria-hidden="true" />,
    },
  ];

  useEffect(() => {
    if (auth.notice === "code-sent") {
      toast.success(copy.codeSent);
    }
    if (auth.notice === "reset-success") {
      toast.success(copy.resetSuccess);
    }
  }, [auth.notice, copy.codeSent, copy.resetSuccess]);

  useEffect(() => {
    if (error.field === null && error.message) {
      toast.error(error.message, { duration: 5000, id: "auth-error" });
    }
  }, [error.field, error.message]);

  return (
    <main className="pw-auth" aria-busy={auth.isPending}>
      <div className="pw-auth-controls">
        <Button
          aria-label={`${copy.fontSize}: ${controls.fontSize}`}
          className="pw-auth-control"
          onClick={handleToggleFontSize}
          size="icon"
          variant="ghost"
        >
          <CaseSensitive aria-hidden="true" />
        </Button>
        <Button
          aria-label="Switch language"
          className="pw-auth-control pw-auth-locale-control"
          onClick={handleToggleLocale}
          size="sm"
          variant="ghost"
        >
          <Languages aria-hidden="true" />
        </Button>
        <Button
          aria-label={controls.isDark ? "Light mode" : "Dark mode"}
          className="pw-auth-control"
          onClick={handleToggleTheme}
          size="icon"
          variant="ghost"
        >
          {controls.isDark ? (
            <Sun aria-hidden="true" />
          ) : (
            <MoonStar aria-hidden="true" />
          )}
        </Button>
      </div>
      <aside className="pw-auth-aside" aria-hidden="true">
        <div className="pw-auth-hero-image">
          <img
            alt=""
            decoding="async"
            fetchPriority="high"
            height={1402}
            loading="eager"
            src="/brand/emp-login-hong-kong.webp"
            width={1122}
          />
        </div>
      </aside>
      <section className="pw-auth-stage">
        <TiltCard className="pw-auth-form">
          <header className="pw-auth-header">
            <div className="pw-auth-brand">
              <ProjectWingTopBarBrand
                hideText={brandHideText}
                lines={brandLines}
                markVariant={controls.isDark ? "on-dark" : "on-light"}
              />
            </div>
          </header>
          <form
            className="pw-auth-fields"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (isResettingPassword && !auth.resetVerified) {
                void auth.verifyResetCode();
                return;
              }
              if (auth.mode === "code" && !auth.codeSent) {
                void auth.requestCode();
                return;
              }
              void auth.submit();
            }}
          >
            <MotionInput
              autoComplete="email"
              disabled={auth.isPending}
              error={error.field === "email" ? error.message : false}
              id="pw-auth-email"
              label={copy.emailLabel}
              name="email"
              placeholder={copy.emailPlaceholder}
              required
              type="email"
              value={auth.values.email}
              rightIcon={
                showDevelopmentAccountSelector ? (
                  <DevelopmentAccountSelector
                    accounts={developmentAccounts}
                    disabled={auth.isPending}
                    emptyLabel={copy.developmentAccountsEmpty}
                    label={copy.developmentAccounts}
                    loading={developmentAccountsLoading}
                    loadingLabel={copy.developmentAccountsLoading}
                    onSelect={(account) => {
                      auth.update("email", account.email);
                      auth.update("password", account.password);
                      toast.warning(copy.developmentAccountWarning);
                      void auth.impersonateDevelopmentAccount(account.email);
                    }}
                  />
                ) : undefined
              }
              onChange={(value) => auth.update("email", value)}
            />
            {auth.mode === "code" || isResettingPassword ? (
              <OtpInput
                aria-label={copy.emailCode}
                autoFocus={auth.mode === "code" && auth.codeSent}
                disabled={auth.isPending || !auth.codeSent}
                errorMessage={error.field === "otp" ? error.message : undefined}
                id="pw-auth-otp"
                label={copy.emailCode}
                status={
                  auth.isSuccessful ||
                  (isResettingPassword && auth.resetVerified)
                    ? "success"
                    : error.field === "otp"
                      ? "error"
                      : "idle"
                }
                value={auth.values.code}
                onChange={(value) => auth.update("code", value)}
                onComplete={(value) => {
                  if (auth.mode === "code" && auth.codeSent) {
                    void auth.submit({ code: value });
                    return;
                  }
                  if (
                    isResettingPassword &&
                    auth.codeSent &&
                    !auth.resetVerified
                  ) {
                    void auth.verifyResetCode(value);
                  }
                }}
              />
            ) : (
              <MotionInput
                autoComplete="current-password"
                disabled={auth.isPending}
                error={error.field === "password" ? error.message : false}
                id="pw-auth-password"
                label={copy.passwordLabel}
                labelAction={
                  <Button
                    className="pw-auth-forgot h-auto px-0"
                    onClick={() => auth.changeMode("reset")}
                    size="sm"
                    variant="ghost"
                  >
                    {copy.forgotPassword}
                  </Button>
                }
                name="password"
                placeholder={copy.passwordPlaceholder}
                required
                rightIcon={
                  <Button
                    aria-label={
                      showPassword ? copy.hidePassword : copy.showPassword
                    }
                    className="pw-auth-password-toggle hover:bg-transparent"
                    onClick={() => setShowPassword((current) => !current)}
                    size="icon"
                    variant="ghost"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" data-icon="inline-end" />
                    ) : (
                      <Eye aria-hidden="true" data-icon="inline-end" />
                    )}
                  </Button>
                }
                type={showPassword ? "text" : "password"}
                value={auth.values.password}
                onChange={(value) => auth.update("password", value)}
              />
            )}
            {isResettingPassword && auth.resetVerified ? (
              <>
                <p className="pw-auth-hint">{copy.codeVerified}</p>
                <MotionInput
                  autoComplete="new-password"
                  disabled={auth.isPending}
                  error={error.field === "newPassword" ? error.message : false}
                  id="pw-auth-new-password"
                  label={copy.newPassword}
                  minLength={8}
                  name="new-password"
                  required
                  rightIcon={
                    <Button
                      aria-label={
                        showPassword ? copy.hidePassword : copy.showPassword
                      }
                      className="pw-auth-password-toggle hover:bg-transparent"
                      onClick={() => setShowPassword((current) => !current)}
                      size="icon"
                      variant="ghost"
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  }
                  type={showPassword ? "text" : "password"}
                  value={auth.values.newPassword}
                  onChange={(value) => auth.update("newPassword", value)}
                />
                <MotionInput
                  autoComplete="new-password"
                  disabled={auth.isPending}
                  error={
                    error.field === "confirmPassword" ? error.message : false
                  }
                  id="pw-auth-confirm-password"
                  label={copy.confirmPassword}
                  minLength={8}
                  name="confirm-password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={auth.values.confirmPassword}
                  onChange={(value) => auth.update("confirmPassword", value)}
                />
                <p className="pw-auth-hint">{copy.passwordRequirements}</p>
              </>
            ) : null}
            {isResettingPassword ? (
              <ActionSwapButton
                className="pw-auth-submit"
                cycle={false}
                disabled={
                  auth.isPending ||
                  (auth.codeSent &&
                    !auth.resetVerified &&
                    auth.values.code.length !== 6)
                }
                items={submitActions}
                onClick={
                  auth.codeSent ? undefined : () => void auth.requestCode()
                }
                type={auth.codeSent ? "submit" : "button"}
                value={
                  auth.resetVerified
                    ? "reset-password"
                    : auth.codeSent
                      ? "verify-code"
                      : "send-code"
                }
              />
            ) : (
              <ActionSwapButton
                className="pw-auth-submit"
                cycle={false}
                data-state={auth.isSuccessful ? "success" : "idle"}
                disabled={auth.isPending || auth.isSuccessful}
                items={submitActions}
                type="submit"
                value={
                  auth.isSuccessful
                    ? "success"
                    : auth.mode === "code" && !auth.codeSent
                      ? "send-code"
                      : "sign-in"
                }
              />
            )}
          </form>
          {showResend ? (
            <Button
              className="pw-auth-resend"
              disabled={auth.isPending || auth.cooldown > 0}
              onClick={() => void auth.requestCode()}
              variant="outline"
            >
              {auth.cooldown > 0
                ? formatCountdown(copy.resendCountdown, auth.cooldown)
                : copy.resendCode}
            </Button>
          ) : null}
          <>
            <div className="pw-auth-divider">
              <span>{copy.orContinueWith}</span>
            </div>
            <div className="pw-auth-providers">
              <Button
                className="pw-auth-provider"
                disabled={auth.isPending}
                onClick={() => {
                  if (auth.mode !== "password") {
                    auth.changeMode("password");
                    return;
                  }
                  const hasEmail = Boolean(auth.values.email.trim());
                  auth.changeMode("code");
                  focusAuthField(hasEmail ? "pw-auth-otp" : "pw-auth-email");
                }}
                variant="outline"
              >
                {auth.mode === "password" ? (
                  <img
                    alt=""
                    aria-hidden="true"
                    className="pw-auth-provider-logo"
                    src="/brands/tencent-enterprise-mail.ico"
                  />
                ) : (
                  <KeyRound aria-hidden="true" data-icon="inline-start" />
                )}
                {auth.mode === "password" ? copy.emailCode : copy.passwordLabel}
              </Button>
              <Button
                className="pw-auth-provider"
                onClick={() => toast.warning(copy.wecomUnavailable)}
                variant="outline"
              >
                <img
                  alt=""
                  aria-hidden="true"
                  className="pw-auth-wecom-logo"
                  src="/brands/wecom.svg"
                />
                {copy.wecom}
              </Button>
            </div>
            <p className="pw-auth-signup">
              <span>{copy.needAccount}</span>
              <Button
                onClick={() => toast.warning(copy.signUpUnavailable)}
                variant="ghost"
              >
                {copy.signUp}
              </Button>
            </p>
          </>
        </TiltCard>
      </section>
      <img
        alt=""
        className="pw-auth-watermark"
        src={
          controls.isDark
            ? "/brand/icon-black-green.svg"
            : "/brand/icon-white-green.svg"
        }
      />
    </main>
  );
}

function formatCountdown(template: string, seconds: number) {
  return template.replace("{seconds}", String(seconds));
}

function focusAuthField(id: string) {
  const focus = () => document.querySelector<HTMLElement>(`#${id}`)?.focus();
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(focus);
    return;
  }
  window.setTimeout(focus, 0);
}

type AuthErrorField =
  | "confirmPassword"
  | "email"
  | "newPassword"
  | "otp"
  | "password"
  | null;

function getAuthErrorState(error: Error | null, copy: AuthCopy) {
  if (!error) {
    return { field: null as AuthErrorField, message: "" };
  }
  const errorCode = getAuthErrorCode(error);
  if (errorCode === "EMAIL_REQUIRED") {
    return { field: "email" as const, message: copy.emailRequired };
  }
  if (errorCode === "EMAIL_INVALID") {
    return { field: "email" as const, message: copy.invalidEmail };
  }
  if (errorCode === "PASSWORD_REQUIRED") {
    return {
      field: "password" as const,
      message: copy.passwordRequired,
    };
  }
  if (errorCode === "CONFIRM_PASSWORD_REQUIRED") {
    return {
      field: "confirmPassword" as const,
      message: copy.confirmPassword,
    };
  }
  if (errorCode === "PASSWORD_TOO_SHORT") {
    return {
      field: "newPassword" as const,
      message: copy.passwordRequirements,
    };
  }
  if (errorCode === "PASSWORD_MISMATCH") {
    return {
      field: "confirmPassword" as const,
      message: copy.confirmPassword,
    };
  }
  if (errorCode === "OTP_INVALID" || errorCode === "OTP_NOT_VERIFIED") {
    return { field: "otp" as const, message: copy.signInFailed };
  }
  return { field: null as AuthErrorField, message: copy.signInFailed };
}

function getAuthErrorCode(error: Error) {
  const { code } = error as Error & { code?: unknown };
  return typeof code === "string" ? code : error.message;
}

function Button({ className, type = "button", ...props }: MotionButtonProps) {
  return (
    <MotionButton
      {...props}
      data-slot="button"
      data-variant={props.variant ?? "primary"}
      type={type}
      className={`pw-auth-button ${className ?? ""}`}
    />
  );
}
