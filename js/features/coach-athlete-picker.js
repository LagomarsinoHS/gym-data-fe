/**
 * Paginated coach athlete picker (Avances, Nutrición list, etc.).
 */
import { getCoachAthletes } from '../api/users.js';
import { ui } from '../utils/labels.js';

/**
 * @param {{
 *   pageSize: number,
 *   getElements: () => ({
 *     listEl: HTMLElement | null | undefined,
 *     loadingEl: HTMLElement | null | undefined,
 *     emptyEl: HTMLElement | null | undefined,
 *     loadMoreBtn: HTMLButtonElement | null | undefined,
 *     emptyTitleEl?: HTMLElement | null,
 *     emptyLeadEl?: HTMLElement | null,
 *     emptyInviteBtn?: HTMLButtonElement | null,
 *   }),
 *   renderRow: (athlete: object) => HTMLElement,
 *   emptyKeys:
 *     | ((ctx: { loadError: unknown, searchQuery: string, athletes: object[] }) => { title: string, lead?: string, invite?: boolean })
 *     | {
 *         loadFail?: string | (() => string),
 *         loadFailLead?: string | (() => string),
 *         empty?: { title: string | (() => string), lead?: string | (() => string), invite?: boolean },
 *         searchEmpty?: { title: string | (() => string), lead?: string | (() => string), invite?: boolean },
 *       },
 *   search?: { getQuery: () => string, enabled?: boolean },
 * }} config
 */
export function createCoachAthletePicker({
  pageSize,
  getElements,
  renderRow,
  emptyKeys,
  search,
}) {
  /** @type {object[]} */
  let athletes = [];
  let page = 0;
  let pages = 0;
  let loading = false;
  let loadSeq = 0;
  let loadError = null;
  let hasFetched = false;
  /** @type {Promise<void> | null} */
  let inflight = null;

  function resolveKey(key, ctx = {}) {
    if (typeof key === 'function') return key(ctx);
    if (typeof key === 'string') return ui(key);
    return '';
  }

  function resolveEmptyState() {
    const searchQuery = search?.enabled ? String(search.getQuery?.() || '').trim() : '';
    const ctx = { loadError, searchQuery, athletes };

    if (typeof emptyKeys === 'function') {
      return emptyKeys(ctx);
    }

    if (loadError && athletes.length === 0) {
      return {
        title: resolveKey(emptyKeys.loadFail ?? '', ctx),
        lead: resolveKey(emptyKeys.loadFailLead ?? '', ctx),
        invite: false,
      };
    }

    if (athletes.length === 0 && searchQuery && emptyKeys.searchEmpty) {
      return {
        title: resolveKey(emptyKeys.searchEmpty.title, ctx),
        lead: resolveKey(emptyKeys.searchEmpty.lead ?? '', ctx),
        invite: emptyKeys.searchEmpty.invite ?? false,
      };
    }

    if (emptyKeys.empty) {
      return {
        title: resolveKey(emptyKeys.empty.title, ctx),
        lead: resolveKey(emptyKeys.empty.lead ?? '', ctx),
        invite: emptyKeys.empty.invite ?? false,
      };
    }

    return { title: '', lead: '', invite: false };
  }

  function showEmpty({ title, lead = '', invite = false }) {
    const { emptyEl, emptyTitleEl, emptyLeadEl, emptyInviteBtn } = getElements();
    if (!emptyEl) return;
    emptyEl.hidden = false;
    const titleEl =
      emptyTitleEl || emptyEl.querySelector('.avances-empty-title, .nutrition-empty-title');
    const leadEl =
      emptyLeadEl || emptyEl.querySelector('.avances-empty-lead, .nutrition-empty-lead');
    if (titleEl) titleEl.textContent = title;
    if (leadEl) leadEl.textContent = lead;
    if (emptyInviteBtn) emptyInviteBtn.hidden = !invite;
  }

  function render() {
    const { listEl, loadingEl, emptyEl, loadMoreBtn } = getElements();
    if (!listEl || !loadingEl || !emptyEl) return;

    const bootLoading = loading && athletes.length === 0;
    loadingEl.hidden = !bootLoading;

    if (bootLoading) {
      emptyEl.hidden = true;
      listEl.hidden = true;
      if (loadMoreBtn) loadMoreBtn.hidden = true;
      return;
    }

    if ((loadError && athletes.length === 0) || athletes.length === 0) {
      showEmpty(resolveEmptyState());
      listEl.hidden = true;
      if (loadMoreBtn) loadMoreBtn.hidden = true;
      return;
    }

    emptyEl.hidden = true;
    listEl.hidden = false;
    listEl.replaceChildren(...athletes.map(renderRow));

    if (loadMoreBtn) {
      const hasMore = pages > 0 ? page < pages : false;
      loadMoreBtn.hidden = !hasMore;
      loadMoreBtn.disabled = loading;
    }
  }

  async function fetchPage(nextPage, { replace }) {
    const seq = ++loadSeq;
    loading = true;
    loadError = null;

    try {
      render();
      const searchQuery = search?.enabled ? String(search.getQuery?.() || '').trim() : '';
      const payload = await getCoachAthletes({
        page: nextPage,
        limit: pageSize,
        search: searchQuery || undefined,
      });
      if (seq !== loadSeq) return;

      const items = Array.isArray(payload?.data) ? payload.data : [];
      page = Number(payload?.page) || nextPage;
      pages = Number(payload?.pages) || 0;
      athletes = replace ? items : athletes.concat(items);
    } catch (err) {
      if (seq !== loadSeq) return;
      console.error(err);
      loadError = err;
      if (replace) athletes = [];
    } finally {
      if (seq === loadSeq) {
        loading = false;
        hasFetched = true;
        render();
      }
    }
  }

  async function reload() {
    athletes = [];
    page = 0;
    pages = 0;
    loadError = null;
    const request = fetchPage(1, { replace: true });
    inflight = request;
    try {
      await request;
    } finally {
      if (inflight === request) inflight = null;
    }
  }

  async function ensureLoaded() {
    if (hasFetched) {
      render();
      return;
    }
    if (inflight) {
      render();
      await inflight;
      if (hasFetched) {
        render();
        return;
      }
    }
    await reload();
  }

  return {
    reload,
    ensureLoaded,
    loadMore: async () => {
      if (loading || page >= pages) return;
      await fetchPage(page + 1, { replace: false });
    },
    render,
    reset() {
      athletes = [];
      page = 0;
      pages = 0;
      loading = false;
      loadSeq += 1;
      loadError = null;
      hasFetched = false;
      inflight = null;
    },
    getAthletes: () => athletes,
    hasFetched: () => hasFetched,
    isLoading: () => loading,
    syncLabels() {
      if (!hasFetched && !loading && athletes.length === 0 && !loadError) return;
      const { emptyEl } = getElements();
      if (emptyEl && !emptyEl.hidden) {
        showEmpty(resolveEmptyState());
      }
    },
  };
}
