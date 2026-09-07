const HINTS_KEY = "steelPulse.featureHints";

export function templateEditorPath(sessionId: string) {
  return `/plantillas/${sessionId}`;
}

export function athleteEditorPath(athleteId: string, sessionId: string) {
  return `/alumnos/${athleteId}/sesion/${sessionId}`;
}

export function hasSeenFeatureHint(id: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(HINTS_KEY) || "{}") as Record<string, unknown>;
    return Boolean(parsed[id]);
  } catch {
    return false;
  }
}

export function markFeatureHintSeen(id: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(HINTS_KEY) || "{}") as Record<string, unknown>;
    parsed[id] = true;
    localStorage.setItem(HINTS_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}
