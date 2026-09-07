export type LocalizedName = {
  en: string;
  es: string;
};

export type LocalizedSteps = {
  en?: string[];
  es?: string[];
};

export type Exercise = {
  id: string;
  name: LocalizedName | string;
  category?: string;
  body_part?: string;
  equipment?: string;
  target?: string;
  secondary_muscles?: string[];
  instruction_steps?: LocalizedSteps;
  image?: string;
  gif_url?: string;
};

export type ExercisePage = {
  data: Exercise[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type ExerciseLabels = {
  category: string[];
  equipment: string[];
  target: string[];
};

export type FilterKey = "category" | "equipment" | "target";

export type CatalogFilters = {
  category: string | null;
  equipment: string | null;
  target: string | null;
};
