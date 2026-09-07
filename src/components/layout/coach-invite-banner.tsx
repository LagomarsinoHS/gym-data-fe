import { useState } from "react";

import { ApiError } from "@/api/request";
import { respondCoachInvite } from "@/api/users";
import { useAuth } from "@/context/auth-context";
import { useI18n } from "@/context/i18n-context";
import { personName } from "@/lib/user-display";

export function CoachInviteBanner() {
  const { pendingInvite, applyUser, refreshInvite } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!pendingInvite) return null;

  async function respond(action: "accept" | "reject") {
    setBusy(true);
    setError("");
    try {
      applyUser(await respondCoachInvite(action));
      await refreshInvite();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      setError(
        code === "CoachAthleteQuotaFull"
          ? t("coachInviteQuotaFull")
          : action === "accept"
            ? t("coachInviteAcceptFail")
            : t("coachInviteRejectFail"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="coach-invite-banner" id="coach-invite-banner" role="status" aria-live="polite">
      <div className="coach-invite-banner-copy">
        <p className="coach-invite-banner-label">{t("coachInviteLabel")}</p>
        <p className="coach-invite-banner-text">
          <strong className="coach-invite-name">{personName(pendingInvite.coach)}</strong>{" "}
          {t("coachInviteBannerRest")}
        </p>
      </div>
      <div className="coach-invite-banner-actions">
        <button
          type="button"
          className="coach-invite-accept"
          id="coach-invite-accept"
          disabled={busy}
          onClick={() => void respond("accept")}
        >
          <span>{t("coachInviteAccept")}</span>
        </button>
        <button
          type="button"
          className="coach-invite-reject"
          id="coach-invite-reject"
          disabled={busy}
          onClick={() => void respond("reject")}
        >
          <span>{t("coachInviteReject")}</span>
        </button>
      </div>
      <p className={`coach-invite-banner-status${error ? " is-error" : ""}`} hidden={!error}>
        {error}
      </p>
    </div>
  );
}
