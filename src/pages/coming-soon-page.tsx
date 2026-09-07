import { Link } from "react-router-dom";

import { useI18n } from "@/context/i18n-context";
import type { MessageKey } from "@/i18n";

export function ComingSoonPage({ title }: { title: MessageKey }) {
  const { t } = useI18n();

  return (
    <section className="mx-auto mt-6 max-w-xl rounded-lg border border-border bg-card p-6 shadow-sm">
      <p className="text-[11px] font-extrabold tracking-[0.12em] text-primary uppercase">
        {t("comingSoon")}
      </p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{t(title)}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("comingSoonLead")}</p>
      <Link
        to="/"
        className="mt-5 inline-flex rounded-md border border-border bg-secondary px-3 py-2 text-sm font-semibold text-foreground"
      >
        {t("goToCatalog")}
      </Link>
    </section>
  );
}
