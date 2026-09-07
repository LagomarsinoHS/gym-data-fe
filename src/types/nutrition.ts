import type { PersonName, UserGoal } from "@/types/user";

export type NutritionPlanStatus = "active" | "archived";

export type NutritionPlan = {
  id: string;
  athlete: PersonName & { id: string };
  coach: PersonName & { id: string };
  title: string;
  status: NutritionPlanStatus;
  goal: UserGoal | null;
  validFrom: string;
  validUntil: string | null;
  targets: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  meals: {
    name: string;
    time: string | null;
    foods: { name: string; quantity: number; unit: string }[];
    notes: string | null;
  }[];
  generalNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AthleteNutrition = {
  dailyActivity: "sedentary" | "standing" | "active" | "demanding" | null;
  trainingsPerWeek: number | null;
  avgDurationMin: number | null;
  dailySteps: number | null;
  weeklyCardioMin: number | null;
  extraActivity: string | null;
  trainingTime: string | null;
  trainFasted: "after_meal" | "fasted" | null;
  meals: { name: string; time: string | null }[];
  likes: string[];
  avoids: string[];
  dietType: "none" | "vegetarian" | "vegan" | "other" | null;
  restrictions: string[];
  notes: string | null;
  updatedAt: string | null;
  updatedBy: (PersonName & { id: string }) | null;
};
