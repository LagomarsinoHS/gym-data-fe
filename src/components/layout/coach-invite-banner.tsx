import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "@/api/request";
import { respondCoachInvite } from "@/api/users";
import { useAuth } from "@/context/auth-context";
import { useI18n } from "@/context/i18n-context";
import { personName } from "@/lib/user-display";

export function CoachInviteBanner() {
  const { pendingInvite, applyUser, refreshInvite } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quotaFlash, setQuotaFlash] = useState(false);
  const quotaTimer = useRef(0);

  useEffect(() => {
    return () => window.clearTimeout(quotaTimer.current);
  }, []);

  if (!pendingInvite && !quotaFlash) return null;

  async function respond(action: "accept" | "reject") {
    setBusy(true);
    setError("");
    try {
      applyUser(await respondCoachInvite(action));
      await refreshInvite();
      if (action === "accept") navigate("/plan-coach");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      if (code === "CoachAthleteQuotaFull" || code === "COACH_ATHLETE_QUOTA_FULL") {
        setError(t("coachInviteQuotaFull"));
        setQuotaFlash(true);
        window.clearTimeout(quotaTimer.current);
        quotaTimer.current = window.setTimeout(() => {
          setQuotaFlash(false);
          setError("");
        }, 4000);
      } else {
        setError(action === "accept" ? t("coachInviteAcceptFail") : t("coachInviteRejectFail"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="coach-invite-banner" id="coach-invite-banner" role="status" aria-live="polite">
      <div className="coach-invite-banner-copy" hidden={quotaFlash}>
        <p className="coach-invite-banner-label">{t("coachInviteLabel")}</p>
        <p className="coach-invite-banner-text">
          <strong className="coach-invite-name">
            {pendingInvite ? personName(pendingInvite.coach) : ""}
          </strong>{" "}
          {t("coachInviteBannerRest")}
        </p>
      </div>
      <div className="coach-invite-banner-actions" hidden={quotaFlash}>
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
