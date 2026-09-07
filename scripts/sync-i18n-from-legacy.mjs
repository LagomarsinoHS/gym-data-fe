/**
 * One-shot: flatten js/i18n into src/i18n/es.ts + en.ts.
 * Functions become {param} templates. React-only keys stay in extras.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { UI_LABELS } = await import(pathToFileURL(resolve(root, "js/i18n/index.js")).href);

function paramNames(fn) {
  const src = fn.toString();
  const match = src.match(/^(?:async\s*)?(?:function[\s\w]*\(([^)]*)\)|\(?([^)=]*)\)?\s*=>)/);
  const raw = match?.[1] ?? match?.[2] ?? "";
  return raw
    .split(",")
    .map((part) => part.trim().split(/[\s=]/)[0])
    .filter(Boolean);
}

function toTemplate(value) {
  if (typeof value === "string") return value;
  if (typeof value !== "function") return String(value);
  const names = paramNames(value);
  const args = names.map((name) => `__${name}__`);
  let result = String(value(...args));
  for (const name of names) {
    result = result.replaceAll(`__${name}__`, `{${name}}`);
  }
  return result;
}

function flatten(dict) {
  return Object.fromEntries(
    Object.entries(dict).map(([key, value]) => [key, toTemplate(value)]),
  );
}

const extras = {
  es: {
    comingSoonLead: "Esta vista se está migrando al nuevo frontend.",
    catalogPlaceholderTitle: "Catálogo",
    catalogPlaceholderLead:
      "El catálogo (filtros, grid y modal) se porta en la próxima entrega. El shell, el login y la sesión ya corren en React.",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    exercisesCount: "{n} ejercicios",
    retry: "Reintentar",
    cancel: "Cancelar",
    save: "Guardar",
    confirm: "Confirmar",
    loadMore: "Cargar más",
    errorGeneric: "Algo salió mal.",
    noResults: "No hay resultados.",
    searchPeople: "Buscar…",
    calories: "Calorías",
    protein: "Proteína",
    carbs: "Carbos",
    fat: "Grasas",
    addSessionPrompt: "Nombre de la sesión",
    renameSession: "Renombrar",
    renameSessionPrompt: "Nuevo nombre",
    createSession: "Crear sesión",
    trainingSessionsEmpty: "Aún no hay sesiones.",
    trainingSessionsHeading: "Sesiones",
    addToSession: "Agregar a {name}",
    inSession: "En {name}",
    sessionSaveFail: "No se pudieron guardar las sesiones.",
    inviteAthlete: "Invitar alumno",
    inviteSend: "Enviar invitación",
    searchStudents: "Buscar alumnos…",
    noStudents: "Todavía no tenés alumnos.",
    athletePlanSaved: "Plan guardado.",
    applyTemplate: "Aplicar a alumno",
    applyTemplateDone: "Plantilla aplicada.",
    noTemplates: "Todavía no hay plantillas.",
    templateDefault: "Plantilla {n}",
    nutritionProfile: "Perfil",
    nutritionPlan: "Pauta",
    nutritionSave: "Guardar perfil",
    nutritionEmptyAthlete: "Elegí un alumno.",
    nutritionArchive: "Archivar",
    nutritionNoPlans: "Sin pautas todavía.",
    pickAthlete: "Elegí un alumno",
    inviteStatusPending: "Pendiente",
    inviteStatusAccepted: "Aceptada",
    inviteStatusRejected: "Rechazada",
    inviteStatusCancelled: "Cancelada",
    coachPanelAthletes: "Alumnos",
    coachPanelInvites: "Invitaciones",
    leaveCoach: "Dejar coach",
    leaveCoachConfirm: "¿Dejar a tu coach? Vas a perder el plan asignado.",
    deactivateAccount: "Desactivar cuenta",
    deactivateConfirm: "Escribí tu email para confirmar.",
    deactivateEmail: "Email de confirmación",
    currentPassword: "Contraseña actual",
    newPassword: "Nueva contraseña",
    confirmPassword: "Confirmar contraseña",
    goal: "Objetivo",
    height: "Altura (cm)",
    birthDate: "Nacimiento",
    sex: "Sexo",
    weight: "Peso",
    plan: "Plan",
    sexMale: "Masculino",
    sexFemale: "Femenino",
    sexOther: "Otro",
    sexPreferNot: "Prefiero no decir",
    goalStrength: "Fuerza",
    goalHypertrophy: "Hipertrofia",
    goalFatLoss: "Pérdida de grasa",
    goalGeneral: "General",
    noCoach: "Sin coach",
    soon: "Pronto",
    editProfile: "Editar",
    saveProfile: "Guardar perfil",
    profileSaveFail: "No se pudo guardar el perfil.",
    adminUsersTotal: "Usuarios",
    adminPaidExpiring: "Planes por vencer",
    adminGrant: "Otorgar",
    adminRevoke: "Revocar",
    adminDelete: "Eliminar",
    adminSearch: "Buscar usuarios…",
    days: "Días",
    grantFail: "No se pudo otorgar el plan.",
    revokeFail: "No se pudo revocar el plan.",
    deleteFail: "No se pudo eliminar el usuario.",
    planFree: "Free",
    planPremium: "Premium",
    planGrowth: "Growth",
    planPro: "Pro",
    lastLogin: "Último login",
    createdAt: "Alta",
  },
  en: {
    comingSoonLead: "This view is being migrated to the new frontend.",
    catalogPlaceholderTitle: "Catalog",
    catalogPlaceholderLead:
      "The catalog (filters, grid and modal) lands in the next pass. Shell, login and session already run on React.",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    exercisesCount: "{n} exercises",
    retry: "Retry",
    cancel: "Cancel",
    save: "Save",
    confirm: "Confirm",
    loadMore: "Load more",
    errorGeneric: "Something went wrong.",
    noResults: "No results.",
    searchPeople: "Search…",
    calories: "Calories",
    protein: "Protein",
    carbs: "Carbs",
    fat: "Fat",
    addSessionPrompt: "Session name",
    renameSession: "Rename",
    renameSessionPrompt: "New name",
    createSession: "Create session",
    trainingSessionsEmpty: "No sessions yet.",
    trainingSessionsHeading: "Sessions",
    addToSession: "Add to {name}",
    inSession: "In {name}",
    sessionSaveFail: "Could not save sessions.",
    inviteAthlete: "Invite athlete",
    inviteSend: "Send invite",
    searchStudents: "Search athletes…",
    noStudents: "You don't have athletes yet.",
    athletePlanSaved: "Plan saved.",
    applyTemplate: "Apply to athlete",
    applyTemplateDone: "Template applied.",
    noTemplates: "No templates yet.",
    templateDefault: "Template {n}",
    nutritionProfile: "Profile",
    nutritionPlan: "Plan",
    nutritionSave: "Save profile",
    nutritionEmptyAthlete: "Pick an athlete.",
    nutritionArchive: "Archive",
    nutritionNoPlans: "No plans yet.",
    pickAthlete: "Pick an athlete",
    inviteStatusPending: "Pending",
    inviteStatusAccepted: "Accepted",
    inviteStatusRejected: "Declined",
    inviteStatusCancelled: "Cancelled",
    coachPanelAthletes: "Athletes",
    coachPanelInvites: "Invites",
    leaveCoach: "Leave coach",
    leaveCoachConfirm: "Leave your coach? You will lose the assigned plan.",
    deactivateAccount: "Deactivate account",
    deactivateConfirm: "Type your email to confirm.",
    deactivateEmail: "Confirmation email",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    goal: "Goal",
    height: "Height (cm)",
    birthDate: "Birth date",
    sex: "Sex",
    weight: "Weight",
    plan: "Plan",
    sexMale: "Male",
    sexFemale: "Female",
    sexOther: "Other",
    sexPreferNot: "Prefer not to say",
    goalStrength: "Strength",
    goalHypertrophy: "Hypertrophy",
    goalFatLoss: "Fat loss",
    goalGeneral: "General",
    noCoach: "No coach",
    soon: "Soon",
    editProfile: "Edit",
    saveProfile: "Save profile",
    profileSaveFail: "Could not save profile.",
    adminUsersTotal: "Users",
    adminPaidExpiring: "Plans expiring soon",
    adminGrant: "Grant",
    adminRevoke: "Revoke",
    adminDelete: "Delete",
    adminSearch: "Search users…",
    days: "Days",
    grantFail: "Could not grant the plan.",
    revokeFail: "Could not revoke the plan.",
    deleteFail: "Could not delete the user.",
    planFree: "Free",
    planPremium: "Premium",
    planGrowth: "Growth",
    planPro: "Pro",
    lastLogin: "Last login",
    createdAt: "Created",
  },
};

const aliases = { es: {}, en: {} };

function quote(value) {
  return JSON.stringify(value);
}

function emit(lang, dict, extra, aliasMap) {
  const lines = [
    "/** Generated from js/i18n via scripts/sync-i18n-from-legacy.mjs — do not add keys by hand. */",
    `export const ${lang} = {`,
  ];
  for (const [key, value] of Object.entries(dict)) {
    lines.push(`  ${key}: ${quote(value)},`);
  }
  lines.push("");
  lines.push("  // React-only extras (not in js/i18n)");
  for (const [key, value] of Object.entries(extra)) {
    if (key in dict) continue;
    lines.push(`  ${key}: ${quote(value)},`);
  }
  lines.push("");
  lines.push("  // Aliases so existing React t() calls keep working");
  for (const [alias, source] of Object.entries(aliasMap)) {
    if (alias in dict || alias in extra) continue;
    const value = dict[source] ?? extra[source];
    if (value == null) continue;
    lines.push(`  ${alias}: ${quote(value)},`);
  }
  lines.push("} as const;");
  lines.push("");
  return `${lines.join("\n")}`;
}

const esLegacy = flatten(UI_LABELS.es);
const enLegacy = flatten(UI_LABELS.en);

const esKeys = new Set(Object.keys(esLegacy));
const enKeys = new Set(Object.keys(enLegacy));
const missingEn = [...esKeys].filter((key) => !enKeys.has(key));
const missingEs = [...enKeys].filter((key) => !esKeys.has(key));
if (missingEn.length || missingEs.length) {
  throw new Error(
    `Legacy key mismatch es≠en: missingEn=${missingEn} missingEs=${missingEs}`,
  );
}

writeFileSync(resolve(root, "src/i18n/es.ts"), emit("es", esLegacy, extras.es, aliases.es));
writeFileSync(resolve(root, "src/i18n/en.ts"), emit("en", enLegacy, extras.en, aliases.en));

console.log(`legacy keys: ${esKeys.size}`);
console.log(`es extras added: ${Object.keys(extras.es).filter((k) => !esKeys.has(k)).length}`);
console.log(`aliases added: ${Object.keys(aliases.es).filter((k) => !esKeys.has(k) && !(k in extras.es)).length}`);
