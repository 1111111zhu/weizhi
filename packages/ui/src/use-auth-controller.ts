"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AuthAdapter, AuthUser } from "./auth-adapter";

export type AuthMode = "password" | "code" | "reset";

export type AuthValues = {
  autoLogin: boolean;
  code: string;
  confirmPassword: string;
  email: string;
  newPassword: string;
  password: string;
  rememberEmail: boolean;
};

type UseAuthControllerOptions<User extends AuthUser> = {
  adapter: AuthAdapter<User>;
  onAuthenticated: (user: User, autoLogin: boolean) => Promise<void> | void;
  storageKey: string;
};

const initialValues: AuthValues = {
  autoLogin: true,
  code: "",
  confirmPassword: "",
  email: "",
  newPassword: "",
  password: "",
  rememberEmail: true,
};
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LENGTH = 8;
const OTP_LENGTH = 6;
const SUCCESS_TRANSITION_MS = 650;

function authError(code: string) {
  return new Error(code);
}

function waitForSuccessTransition() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, SUCCESS_TRANSITION_MS);
  });
}

export function useAuthController<User extends AuthUser>({
  adapter,
  onAuthenticated,
  storageKey,
}: UseAuthControllerOptions<User>) {
  const [values, setValues] = useState(initialValues);
  const [mode, setMode] = useState<AuthMode>("password");
  const [codeSent, setCodeSent] = useState(false);
  const [resetVerified, setResetVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState<"code-sent" | "reset-success" | null>(
    null
  );
  const [isPending, setIsPending] = useState(false);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const email = window.localStorage.getItem(storageKey) ?? "";
    if (email) {
      setValues((current) => ({ ...current, email, rememberEmail: true }));
    }
  }, [storageKey]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const complete = useCallback(
    async (
      user: User,
      autoLogin: boolean,
      completedValues = values,
      showSuccess = false
    ) => {
      if (completedValues.rememberEmail) {
        window.localStorage.setItem(storageKey, completedValues.email.trim());
      } else {
        window.localStorage.removeItem(storageKey);
      }
      if (showSuccess) {
        setIsSuccessful(true);
        await waitForSuccessTransition();
      }
      await onAuthenticated(user, autoLogin);
    },
    [onAuthenticated, storageKey, values]
  );

  useEffect(() => {
    if (restored.current) {
      return;
    }
    restored.current = true;
    void adapter
      .restoreIntranetEntry()
      .then((user) => user && complete(user, false));
  }, [adapter, complete]);

  const changeMode = useCallback((nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setIsSuccessful(false);
    setCodeSent(false);
    setResetVerified(false);
    setValues((current) => ({
      ...current,
      code: "",
      newPassword: "",
      confirmPassword: "",
    }));
  }, []);
  const update = useCallback(
    <Key extends keyof AuthValues>(key: Key, value: AuthValues[Key]) => {
      setValues((current) => ({ ...current, [key]: value }));
      if (key === "email" || key === "code") {
        setResetVerified(false);
      }
    },
    []
  );
  const requestCode = useCallback(async () => {
    setIsPending(true);
    setError(null);
    try {
      if (!values.email.trim()) {
        throw authError("EMAIL_REQUIRED");
      }
      if (!EMAIL_PATTERN.test(values.email.trim())) {
        throw authError("EMAIL_INVALID");
      }
      await (mode === "reset"
        ? adapter.requestPasswordResetOtp(values.email.trim())
        : adapter.requestLoginOtp(values.email.trim()));
      setCodeSent(true);
      setCooldown(60);
      setNotice("code-sent");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError
          : new Error("Authentication request failed")
      );
    } finally {
      setIsPending(false);
    }
  }, [adapter, mode, values.email]);
  const impersonateDevelopmentAccount = useCallback(
    async (email: string) => {
      setIsPending(true);
      setIsSuccessful(false);
      setError(null);
      try {
        if (!adapter.impersonateDevelopmentAccount) {
          throw authError("IMPERSONATION_UNAVAILABLE");
        }
        const completedValues = { ...values, email };
        setValues(completedValues);
        await complete(
          await adapter.impersonateDevelopmentAccount(email),
          false,
          completedValues
        );
      } catch (caughtError) {
        setIsSuccessful(false);
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Authentication request failed")
        );
      } finally {
        setIsPending(false);
      }
    },
    [adapter, complete, values]
  );
  const verifyResetCode = useCallback(
    async (submittedCode = values.code) => {
      setIsPending(true);
      setError(null);
      try {
        if (!codeSent || submittedCode.length !== OTP_LENGTH) {
          throw authError("OTP_INVALID");
        }
        await adapter.verifyPasswordResetOtp({
          email: values.email.trim(),
          otp: submittedCode,
        });
        setResetVerified(true);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Authentication request failed")
        );
      } finally {
        setIsPending(false);
      }
    },
    [adapter, codeSent, values.code, values.email]
  );
  const submit = useCallback(
    async (submittedValues: Partial<AuthValues> = {}) => {
      const activeValues = { ...values, ...submittedValues };
      if (Object.keys(submittedValues).length > 0) {
        setValues((current) => ({ ...current, ...submittedValues }));
      }
      setIsPending(true);
      setIsSuccessful(false);
      setError(null);
      try {
        if (!activeValues.email.trim()) {
          throw authError("EMAIL_REQUIRED");
        }
        if (!EMAIL_PATTERN.test(activeValues.email.trim())) {
          throw authError("EMAIL_INVALID");
        }
        if (mode === "password" && !activeValues.password.trim()) {
          throw authError("PASSWORD_REQUIRED");
        }
        if (mode === "password") {
          return await complete(
            await adapter.login({
              email: activeValues.email.trim(),
              password: activeValues.password,
              rememberMe: activeValues.autoLogin,
            }),
            activeValues.autoLogin,
            activeValues,
            true
          );
        }
        if (!codeSent || activeValues.code.length !== OTP_LENGTH) {
          throw authError("OTP_INVALID");
        }
        if (mode === "code") {
          return await complete(
            await adapter.loginWithOtp({
              email: activeValues.email.trim(),
              otp: activeValues.code,
            }),
            false,
            activeValues,
            true
          );
        }
        if (!resetVerified) {
          throw authError("OTP_NOT_VERIFIED");
        }
        if (!activeValues.newPassword.trim()) {
          throw authError("PASSWORD_REQUIRED");
        }
        if (!activeValues.confirmPassword.trim()) {
          throw authError("CONFIRM_PASSWORD_REQUIRED");
        }
        if (activeValues.newPassword.length < MIN_PASSWORD_LENGTH) {
          throw authError("PASSWORD_TOO_SHORT");
        }
        if (activeValues.newPassword !== activeValues.confirmPassword) {
          throw authError("PASSWORD_MISMATCH");
        }
        await adapter.resetPasswordWithOtp({
          email: activeValues.email.trim(),
          otp: activeValues.code,
          password: activeValues.newPassword,
        });
        changeMode("password");
        setNotice("reset-success");
      } catch (caughtError) {
        setIsSuccessful(false);
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Authentication request failed")
        );
      } finally {
        setIsPending(false);
      }
    },
    [adapter, changeMode, codeSent, complete, mode, resetVerified, values]
  );

  return {
    changeMode,
    codeSent,
    cooldown,
    error,
    isPending,
    isSuccessful,
    impersonateDevelopmentAccount,
    mode,
    notice,
    requestCode,
    resetVerified,
    submit,
    update,
    verifyResetCode,
    values,
  };
}
