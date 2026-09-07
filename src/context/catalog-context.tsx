import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import { getExercise, getExercises, getLabels, getRandomExercise } from "@/api/exercises";
import { useAuth } from "@/context/auth-context";
import { getStoredActiveSessionId, setStoredActiveSessionId } from "@/lib/prefs";
import { athleteSessions } from "@/lib/training-sessions";
import { readExerciseFromUrl } from "@/lib/url";
import type { CatalogFilters, Exercise, ExerciseLabels, FilterKey } from "@/types/exercise";
import type { TrainingSession } from "@/types/user";

export type SessionAssignTarget = {
  kind: "athlete" | "template";
  athleteId: string;
  sessionId: string;
  sessionName: string;
  athleteName: string;
  returnTo: string;
  sessions: TrainingSession[];
};

const PAGE_SIZE = 12;

const EMPTY_FILTERS: CatalogFilters = {
  category: null,
  equipment: null,
  target: null,
};

type CatalogContextValue = {
  labels: ExerciseLabels;
  labelsReady: boolean;
  filters: CatalogFilters;
  search: string;
  setSearch: (value: string) => void;
  toggleFilter: (key: FilterKey, value: string) => void;
  clearFilters: () => void;
  clearFilter: (key: FilterKey, value: string) => void;
  exercises: Exercise[];
  total: number;
  loading: boolean;
  ready: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  openId: string | null;
  openExercise: (id: string) => void;
  closeExercise: () => void;
  wodLoading: boolean;
  playWod: () => Promise<void>;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  assignTarget: SessionAssignTarget | null;
  setAssignTarget: (target: SessionAssignTarget | null) => void;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

function isIdSearch(q: string) {
  return /^\d+$/.test(q.trim());
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isCatalog = location.pathname === "/";
  const { user } = useAuth();

  const [labels, setLabels] = useState<ExerciseLabels>({
    category: [],
    equipment: [],
    target: [],
  });
  const [labelsReady, setLabelsReady] = useState(false);
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [search, setSearchState] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(() => readExerciseFromUrl());
  const [wodLoading, setWodLoading] = useState(false);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(
    getStoredActiveSessionId,
  );
  const [assignTarget, setAssignTarget] = useState<SessionAssignTarget | null>(null);

  const requestId = useRef(0);
  const loadingRef = useRef(false);

  const openExercise = useCallback(
    (id: string) => {
      setOpenId(id);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("exercise", id);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const closeExercise = useCallback(() => {
    setOpenId(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("exercise");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  useEffect(() => {
    const fromUrl = searchParams.get("exercise")?.trim();
    setOpenId(fromUrl || null);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    void getLabels()
      .then((data) => {
        if (cancelled) return;
        setLabels({
          category: data.category ?? [],
          equipment: data.equipment ?? [],
          target: data.target ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setLabels({ category: [], equipment: [], target: [] });
      })
      .finally(() => {
        if (!cancelled) setLabelsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async (query: string, nextFilters: CatalogFilters) => {
    const id = ++requestId.current;
    setLoading(true);
    loadingRef.current = true;
    setReady(false);
    setError(null);
    setExercises([]);
    setPage(0);
    setPages(0);
    setTotal(0);

    try {
      if (isIdSearch(query)) {
        const exercise = await getExercise(query.trim());
        if (id !== requestId.current) return;
        setExercises([exercise]);
        setTotal(1);
        setPage(1);
        setPages(1);
        setReady(true);
        return;
      }

      const data = await getExercises({
        page: 1,
        limit: PAGE_SIZE,
        ...(nextFilters.category ? { category: nextFilters.category } : {}),
        ...(nextFilters.equipment ? { equipment: nextFilters.equipment } : {}),
        ...(nextFilters.target ? { target: nextFilters.target } : {}),
        ...(query.trim() ? { search: query.trim() } : {}),
      });
      if (id !== requestId.current) return;
      setExercises(data.data ?? []);
      setPage(data.page ?? 1);
      setPages(data.pages ?? 0);
      setTotal(data.total ?? 0);
      setReady(true);
    } catch {
      if (id !== requestId.current) return;
      setExercises([]);
      setReady(true);
      setError("loadFail");
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        loadingRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    if (!isCatalog) return;
    void reload(search, filters);
  }, [isCatalog, search, filters, reload]);

  const loadMore = useCallback(() => {
    if (!isCatalog || loadingRef.current || page >= pages || isIdSearch(search)) return;
    const id = ++requestId.current;
    loadingRef.current = true;
    setLoading(true);

    void getExercises({
      page: page + 1,
      limit: PAGE_SIZE,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.equipment ? { equipment: filters.equipment } : {}),
      ...(filters.target ? { target: filters.target } : {}),
      ...(search.trim() && !isIdSearch(search) ? { search: search.trim() } : {}),
    })
      .then((data) => {
        if (id !== requestId.current) return;
        setExercises((prev) => {
          const seen = new Set(prev.map((item) => item.id));
          const extra = (data.data ?? []).filter((item) => !seen.has(item.id));
          return [...prev, ...extra];
        });
        setPage(data.page ?? page);
        setPages(data.pages ?? pages);
        setTotal(data.total ?? 0);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setError("loadFail");
      })
      .finally(() => {
        if (id === requestId.current) {
          setLoading(false);
          loadingRef.current = false;
        }
      });
  }, [filters, isCatalog, page, pages, search]);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
  }, []);

  const toggleFilter = useCallback((key: FilterKey, value: string) => {
    setSearchState("");
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? null : value,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchState("");
    setFilters(EMPTY_FILTERS);
  }, []);

  const clearFilter = useCallback((key: FilterKey, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? null : prev[key],
    }));
  }, []);

  const sessions = useMemo(() => athleteSessions(user), [user]);

  useEffect(() => {
    if (!sessions.length) return;
    if (activeSessionId && sessions.some((session) => session.id === activeSessionId)) return;
    const next = sessions[0].id;
    setActiveSessionIdState(next);
    setStoredActiveSessionId(next);
  }, [activeSessionId, sessions]);

  const setActiveSessionId = useCallback((id: string | null) => {
    setActiveSessionIdState(id);
    setStoredActiveSessionId(id);
  }, []);

  const playWod = useCallback(async () => {
    setWodLoading(true);
    try {
      const exercise = await getRandomExercise();
      openExercise(exercise.id);
    } finally {
      setWodLoading(false);
    }
  }, [openExercise]);

  const value = useMemo<CatalogContextValue>(
    () => ({
      labels,
      labelsReady,
      filters,
      search,
      setSearch,
      toggleFilter,
      clearFilters,
      clearFilter,
      exercises,
      total,
      loading,
      ready,
      hasMore: page < pages && !isIdSearch(search),
      error,
      loadMore,
      openId,
      openExercise,
      closeExercise,
      wodLoading,
      playWod,
      activeSessionId,
      setActiveSessionId,
      assignTarget,
      setAssignTarget,
    }),
    [
      labels,
      labelsReady,
      filters,
      search,
      setSearch,
      toggleFilter,
      clearFilters,
      clearFilter,
      exercises,
      total,
      loading,
      ready,
      page,
      pages,
      error,
      loadMore,
      openId,
      openExercise,
      closeExercise,
      wodLoading,
      playWod,
      activeSessionId,
      setActiveSessionId,
      assignTarget,
    ],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used within CatalogProvider");
  return ctx;
}
