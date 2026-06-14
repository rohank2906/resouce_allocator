export type PasswordStatus =
  | "INITIAL_PASSWORD"
  | "TEMPORARY_PASSWORD"
  | "RESET_REQUIRED"
  | "PASSWORD_UPDATED";

export const passwordStatusLabel: Record<PasswordStatus, string> = {
  INITIAL_PASSWORD: "Initial Password",
  TEMPORARY_PASSWORD: "Temporary Password",
  RESET_REQUIRED: "Reset Required",
  PASSWORD_UPDATED: "Password Updated"
};

export interface PasswordStatusInput {
  mustChangePassword: boolean;
  passwordChangedAt: Date | string | null | undefined;
  passwordResetAt: Date | string | null | undefined;
  lastLogin: Date | string | null | undefined;
}

function toMillis(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

export function derivePasswordStatus(input: PasswordStatusInput): PasswordStatus {
  if (!input.mustChangePassword) {
    return input.passwordChangedAt ? "PASSWORD_UPDATED" : "INITIAL_PASSWORD";
  }

  const resetAt = toMillis(input.passwordResetAt);
  if (resetAt === null) {
    return "INITIAL_PASSWORD";
  }

  const lastLogin = toMillis(input.lastLogin);
  if (lastLogin !== null && lastLogin >= resetAt) {
    return "RESET_REQUIRED";
  }
  return "TEMPORARY_PASSWORD";
}
