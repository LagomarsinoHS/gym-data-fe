import { useLocation, useNavigate } from "react-router-dom";

import { useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";

export function AssignBanner() {
  const { assignTarget } = useCatalog();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!assignTarget || pathname !== "/") return null;

  return (
    <div className="session-assign-banner">
      <div className="session-assign-banner-copy">
        <p className="session-assign-banner-label">{t("sessionAssignLabel")}</p>
        <p className="session-assign-banner-text">
          {assignTarget.kind === "template"
            ? assignTarget.sessionName
            : t("sessionAssignTo", {
                sessionName: assignTarget.sessionName,
                athleteName: assignTarget.athleteName,
              })}
        </p>
      </div>
      <button
        type="button"
        className="recommend-again-btn"
        onClick={() => {
          navigate(assignTarget.returnTo);
        }}
      >
        {t("sessionAssignDone")}
      </button>
    </div>
  );
}
