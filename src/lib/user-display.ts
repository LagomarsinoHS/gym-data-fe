import type { MessageKey } from "@/i18n";
import type { MeUser, PersonName, Role } from "@/types/user";

export function personName(person?: PersonName | null): string {
  if (!person) return "";
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
}

export function shortName(user: MeUser): string {
  const first = user.profile.firstName.trim();
  const last = user.profile.lastName.trim();
  if (last) return `${first} ${last.charAt(0)}.`.trim();
  return first || user.email;
}

export function fullName(user: MeUser): string {
  return [user.profile.firstName, user.profile.lastName].filter(Boolean).join(" ").trim();
}

export function initials(user: MeUser): string {
  const first = user.profile.firstName.trim().charAt(0);
  const last = user.profile.lastName.trim().charAt(0);
  const letters = `${first}${last}`.toUpperCase();
  return letters || user.email.charAt(0).toUpperCase();
}

export function roleLabel(role: Role, t: (key: MessageKey) => string): string {
  if (role === "coach") return t("roleCoach");
  if (role === "admin") return t("roleAdmin");
  return t("roleAthlete");
}
