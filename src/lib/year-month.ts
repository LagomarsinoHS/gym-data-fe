const YEAR_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function currentYearMonthUtc(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function isValidYearMonth(value: string, { allowFuture = false } = {}) {
  const raw = String(value || "").trim();
  if (!YEAR_MONTH_RE.test(raw)) return false;
  if (!allowFuture && raw > currentYearMonthUtc()) return false;
  return true;
}

export function normalizeYearMonth(value: string, fallback = currentYearMonthUtc()) {
  const raw = String(value || "").trim();
  return isValidYearMonth(raw) ? raw : fallback;
}

export function monthShortLabels(lang: "es" | "en") {
  const locale = lang === "en" ? "en-US" : "es-ES";
  return Array.from({ length: 12 }, (_, index) => {
    const raw = new Intl.DateTimeFormat(locale, {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2020, index, 1)));
    const cleaned = raw.replace(/\.$/, "");
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  });
}

export function formatMonthLabel(yearMonth: string, lang: "es" | "en") {
  const match = String(yearMonth || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return String(yearMonth || "");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const locale = lang === "en" ? "en-US" : "es-ES";
  const raw = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function timelineMonthLabel(yearMonth: string, lang: "es" | "en") {
  const match = String(yearMonth || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return String(yearMonth || "");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const locale = lang === "en" ? "en-US" : "es-ES";
  const raw = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  const monthText = raw.replace(/\.$/, "");
  const capped = monthText ? monthText.charAt(0).toUpperCase() + monthText.slice(1) : monthText;
  return `${capped} ${year}`;
}
