export type AuthUser = { id: string };

export type AuthAdapter<User extends AuthUser> = {
  impersonateDevelopmentAccount?: (email: string) => Promise<User>;
  login: (input: {
    email: string;
    password: string;
    rememberMe: boolean;
  }) => Promise<User>;
  loginWithOtp: (input: { email: string; otp: string }) => Promise<User>;
  requestLoginOtp: (email: string) => Promise<void>;
  requestPasswordResetOtp: (email: string) => Promise<void>;
  resetPasswordWithOtp: (input: {
    email: string;
    otp: string;
    password: string;
  }) => Promise<void>;
  restoreIntranetEntry: () => Promise<User | null>;
  verifyPasswordResetOtp: (input: {
    email: string;
    otp: string;
  }) => Promise<void>;
};
