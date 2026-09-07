export type ProgressPhoto = {
  url: string;
  uploadedAt: string;
};

export type ProgressMonth = {
  month: number;
  yearMonth: string;
  weightKg: number | null;
  front: ProgressPhoto | null;
  back: ProgressPhoto | null;
};

export type ProgressPhotosResponse = {
  currentWeightKg: number | null;
  years: {
    year: number;
    months: ProgressMonth[];
  }[];
};

export type AnalyzeAiBlock = {
  type: "paragraph" | "subtitle";
  title?: string;
  text: string;
};

export type AnalyzeAiSection = {
  title: string;
  blocks: AnalyzeAiBlock[];
};

export type AnalyzeAiState = {
  loading: boolean;
  sections: AnalyzeAiSection[] | null;
  error: string | null;
};
