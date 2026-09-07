import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  deleteAdminUser,
  grantSubscription,
  listAdminUsers,
  revokeSubscription,
} from "@/api/admin";
import { AdminUserRow, type AdminUserConfirm } from "@/components/admin/admin-user-row";
import { SearchIcon } from "@/components/coach/recommend-overlay";
import { useAuth } from "@/context/auth-context";
import { useI18n } from "@/context/i18n-context";
import { adminPlanKey } from "@/lib/admin";
import { personName } from "@/lib/user-display";
import type { AdminUser } from "@/types/admin";
import type { Role, SubscriptionPlan } from "@/types/user";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 280;

type SortValue = "lastLoginAt:desc" | "lastLoginAt:asc" | "createdAt:desc" | "createdAt:asc";

export function AdminUsersPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const seeded = (location.state as { expiringSoon?: boolean } | null)?.expiringSoon === true;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [plan, setPlan] = useState<SubscriptionPlan | "">("");
  const [sort, setSort] = useState<SortValue>("lastLoginAt:desc");
  const [expiringSoon, setExpiringSoon] = useState(seeded);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"" | "ok" | "error">("");
  const [confirm, setConfirm] = useState<AdminUserConfirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowStatus, setRowStatus] = useState<{
    id: string;
    message: string;
    kind: "ok" | "error";
  } | null>(null);
  const loadSeq = useRef(0);
  const usersLen = useRef(0);
  usersLen.current = users.length;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      const seq = ++loadSeq.current;
      const [sortBy, sortDir] = sort.split(":") as ["lastLoginAt" | "createdAt", "asc" | "desc"];
      if (!append) {
        setLoading(usersLen.current === 0);
        setError(false);
        setOpenId(null);
      }
      try {
        const data = await listAdminUsers({
          page: nextPage,
          limit: PAGE_SIZE,
          sortBy,
          sortDir,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(role ? { role } : {}),
          ...(plan ? { plan } : {}),
          ...(expiringSoon ? { expiringSoon: true } : {}),
        });
        if (seq !== loadSeq.current) return;
        const rows = data.data ?? [];
        setUsers((prev) => (append ? [...prev, ...rows] : rows));
        setPage(data.page ?? nextPage);
        setPages(data.pages ?? 0);
        setTotal(data.total ?? rows.length);
      } catch {
        if (seq !== loadSeq.current) return;
        if (!append) {
          setUsers([]);
          setTotal(0);
          setPages(0);
          setError(true);
        }
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [debouncedSearch, role, plan, sort, expiringSoon],
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  const searching = Boolean(debouncedSearch || role || plan || expiringSoon);
  const hasUsers = users.length > 0;

  async function runConfirm() {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      if (confirm.kind === "grant") {
        const updated = await grantSubscription({
          email: confirm.user.email,
          plan: confirm.plan,
          durationDays: confirm.durationDays,
        });
        patchUser(confirm.user.id, updated.subscription);
        setRowStatus({ id: confirm.user.id, message: t("adminUsersGrantOk"), kind: "ok" });
      } else if (confirm.kind === "revoke") {
        const updated = await revokeSubscription(confirm.user.email);
        patchUser(confirm.user.id, updated.subscription);
        setRowStatus({ id: confirm.user.id, message: t("adminUsersRevokeOk"), kind: "ok" });
      } else {
        await deleteAdminUser(confirm.user.id);
        setUsers((prev) => prev.filter((row) => row.id !== confirm.user.id));
        setTotal((value) => Math.max(0, value - 1));
        if (openId === confirm.user.id) setOpenId(null);
        setStatus(t("adminUsersDeleteOk"));
        setStatusKind("ok");
      }
      setConfirm(null);
    } catch {
      if (confirm.kind === "grant") {
        setRowStatus({ id: confirm.user.id, message: t("adminUsersGrantFail"), kind: "error" });
      } else if (confirm.kind === "revoke") {
        setRowStatus({ id: confirm.user.id, message: t("adminUsersRevokeFail"), kind: "error" });
      } else {
        setRowStatus({ id: confirm.user.id, message: t("adminUsersDeleteFail"), kind: "error" });
      }
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  function patchUser(id: string, subscription: AdminUser["subscription"]) {
    setUsers((prev) => prev.map((row) => (row.id === id ? { ...row, subscription } : row)));
    setOpenId(id);
  }

  return (
    <div id="admin-users-view" className="students-view">
      <div className="recommend-results students-shell admin-users-shell">
        <header className="admin-users-header">
          <h2 className="admin-users-title">{t("adminUsers")}</h2>
          <p className="admin-users-lead">{t("adminUsersLead")}</p>
        </header>

        <div className="recommend-toolbar students-toolbar admin-users-toolbar">
          <div className="search-wrapper students-search">
            <SearchIcon />
            <input
              type="text"
              className="search-box"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("adminUsersSearch")}
              autoComplete="off"
            />
            <button
              type="button"
              className={`search-clear${search ? " visible" : ""}`}
              onClick={() => setSearch("")}
            >
              ×
            </button>
          </div>
          <div className="admin-users-filters">
            <label className="admin-users-filter">
              <span className="admin-users-filter-label">{t("adminUsersFilterRole")}</span>
              <select
                className="admin-users-select"
                value={role}
                onChange={(event) => setRole(event.target.value as Role | "")}
              >
                <option value="">{t("adminUsersFilterAll")}</option>
                <option value="athlete">{t("roleAthlete")}</option>
                <option value="coach">{t("roleCoach")}</option>
                <option value="admin">{t("roleAdmin")}</option>
              </select>
            </label>
            <label className="admin-users-filter">
              <span className="admin-users-filter-label">{t("adminUsersFilterPlan")}</span>
              <select
                className="admin-users-select"
                value={plan}
                onChange={(event) => setPlan(event.target.value as SubscriptionPlan | "")}
              >
                <option value="">{t("adminUsersFilterAll")}</option>
                <option value="free">{t("adminPlanFree")}</option>
                <option value="premium">{t("adminPlanPremium")}</option>
                <option value="growth">{t("adminPlanGrowth")}</option>
                <option value="pro">{t("adminPlanPro")}</option>
              </select>
            </label>
            <label className="admin-users-filter">
              <span className="admin-users-filter-label">{t("adminUsersFilterSort")}</span>
              <select
                className="admin-users-select"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortValue)}
              >
                <option value="lastLoginAt:desc">{t("adminUsersSortLastLoginDesc")}</option>
                <option value="lastLoginAt:asc">{t("adminUsersSortLastLoginAsc")}</option>
                <option value="createdAt:desc">{t("adminUsersSortCreatedDesc")}</option>
                <option value="createdAt:asc">{t("adminUsersSortCreatedAsc")}</option>
              </select>
            </label>
            <label className="admin-users-filter admin-users-filter--check">
              <input
                type="checkbox"
                checked={expiringSoon}
                onChange={(event) => setExpiringSoon(event.target.checked)}
              />
              <span>{t("adminUsersFilterExpiring")}</span>
            </label>
          </div>
        </div>

        <p className="admin-users-meta" hidden={!hasUsers && !total}>
          {hasUsers || total ? t("adminUsersMeta", { shown: users.length, total }) : ""}
        </p>
        <p
          className={`admin-overview-status${statusKind === "error" ? " is-error" : ""}${statusKind === "ok" ? " is-ok" : ""}`}
          hidden={!status && !error}
        >
          {error ? t("adminUsersLoadFail") : status}
        </p>

        <div className="admin-overview-loading students-loading" hidden={!loading}>
          <div className="load-spinner visible" aria-hidden="true" />
          <span>{t("adminUsersLoading")}</span>
        </div>

        <div className="students-empty" hidden={loading || hasUsers || error}>
          <p className="students-empty-title admin-users-empty-title">
            {t(searching ? "adminUsersSearchEmptyTitle" : "adminUsersEmptyTitle")}
          </p>
          <p className="students-empty-lead admin-users-empty-lead">
            {t(searching ? "adminUsersSearchEmptyLead" : "adminUsersEmptyLead")}
          </p>
        </div>

        <div className="students-list" id="admin-users-list" hidden={!hasUsers}>
          {users.map((row) => (
            <AdminUserRow
              key={row.id}
              user={row}
              open={openId === row.id}
              isSelf={row.id === user?.id}
              busy={busy}
              actionStatus={rowStatus?.id === row.id ? rowStatus.message : ""}
              actionStatusKind={rowStatus?.id === row.id ? rowStatus.kind : ""}
              onToggle={() => setOpenId((current) => (current === row.id ? null : row.id))}
              onConfirm={setConfirm}
            />
          ))}
        </div>

        <button
          type="button"
          className="students-load-more"
          hidden={!hasUsers || page >= pages}
          disabled={loading}
          onClick={() => void load(page + 1, true)}
        >
          <span>{t("adminUsersLoadMore")}</span>
        </button>
      </div>

      {confirm ? (
        <AdminConfirmModal
          action={confirm}
          busy={busy}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
          onConfirm={() => void runConfirm()}
        />
      ) : null}
    </div>
  );
}

function AdminConfirmModal({
  action,
  busy,
  onClose,
  onConfirm,
}: {
  action: AdminUserConfirm;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const name = personName(action.user.profile) || action.user.email || "—";
  const deleteParts = t("adminUsersDeleteTitle").split("{name}");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || busy) return;
      event.stopImmediatePropagation();
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const title =
    action.kind === "delete" ? (
      <>
        {deleteParts[0]}
        <span className="confirm-modal-name">{name}</span>
        {deleteParts[1]}
      </>
    ) : action.kind === "grant" ? (
      t("adminUsersGrantTitle")
    ) : (
      t("adminUsersRevokeTitle")
    );

  const lead =
    action.kind === "grant"
      ? grantLead(action, t)
      : action.kind === "revoke"
        ? t("adminUsersRevokeConfirm")
        : "";

  const confirmLabel =
    action.kind === "grant"
      ? t("adminUsersGrant")
      : action.kind === "revoke"
        ? t("adminUsersRevoke")
        : t("adminUsersDelete");

  return (
    <div
      className="recommend-overlay open"
      id="admin-sub-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-sub-confirm-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="recommend-modal confirm-modal">
        <div className="recommend-modal-header">
          <h2 className="recommend-modal-title" id="admin-sub-confirm-title">
            {title}
          </h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="confirm-modal-name" hidden={action.kind === "delete"}>
          {action.kind === "delete" ? "" : name}
        </p>
        <p className="confirm-modal-lead" hidden={action.kind === "delete"}>
          {lead}
        </p>
        <div className="confirm-modal-actions">
          <button type="button" className="confirm-modal-cancel" onClick={onClose} disabled={busy}>
            {t("adminUsersConfirmCancel")}
          </button>
          <button
            type="button"
            className={action.kind === "grant" ? "confirm-modal-primary" : "confirm-modal-danger"}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function grantLead(
  action: Extract<AdminUserConfirm, { kind: "grant" }>,
  t: ReturnType<typeof useI18n>["t"],
) {
  const days = action.durationDays;
  const planLabel = t(adminPlanKey(action.plan));
  const expiryMs = action.user.subscription.expiresAt
    ? new Date(action.user.subscription.expiresAt).getTime()
    : Number.NaN;
  const plan = action.user.subscription.plan || "free";
  const isActivePaid =
    (plan === "premium" || plan === "growth" || plan === "pro") &&
    Number.isFinite(expiryMs) &&
    expiryMs > Date.now();
  if (isActivePaid) {
    return days === 1
      ? t("adminUsersGrantConfirmExtendOne", { plan: planLabel })
      : t("adminUsersGrantConfirmExtendMany", { plan: planLabel, days });
  }
  return days === 1
    ? t("adminUsersGrantConfirmOne", { plan: planLabel })
    : t("adminUsersGrantConfirmMany", { plan: planLabel, days });
}
