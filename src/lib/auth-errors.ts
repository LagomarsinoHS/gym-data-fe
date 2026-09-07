import { ApiError } from "@/api/request";
import type { MessageKey } from "@/i18n";

export function authErrorMessage(
  err: unknown,
  mode: "login" | "register",
  t: (key: MessageKey) => string,
): string {
  const status = err instanceof ApiError ? err.status : undefined;

  if (mode === "login" && (status === 401 || status === 403)) {
    return t("invalidCredentials");
  }
  if (mode === "register" && status === 409) {
    return t("emailTaken");
  }

  return t(mode === "login" ? "loginFail" : "registerFail");
}
