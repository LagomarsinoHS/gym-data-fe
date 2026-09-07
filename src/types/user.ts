export type Role = "athlete" | "coach" | "admin";

export type SubscriptionPlan = "free" | "premium" | "growth" | "pro";

export type UserSex = "male" | "female" | "other" | "prefer_not_to_say";

export type UserGoal = "strength" | "hypertrophy" | "fat_loss" | "general";

export type PersonName = {
  firstName: string;
  lastName: string;
};

export type UserProfile = {
  firstName: string;
  lastName: string;
  heightCm: number | null;
  sex: UserSex | null;
  birthDate: string | null;
};

export type UserSubscription = {
  plan: SubscriptionPlan;
  startedAt: string | null;
  expiresAt: string | null;
};

export type UserProfilePhoto = {
  url: string;
  uploadedAt: string;
};

export type CoachQuota = {
  athleteLimit: number;
  athleteCount: number;
  canInvite: boolean;
};

export type TrainingProgramItem = {
  exerciseId: string;
  order?: number;
  sets?: number;
  reps?: string;
  rest?: number;
  notes?: string;
  exercise?: {
    id: string;
    name?: { en?: string; es?: string } | string;
    image?: string;
    gif_url?: string;
    category?: string;
    equipment?: string;
  };
};

export type TrainingSession = {
  id: string;
  name: string;
  order: number;
  items: TrainingProgramItem[];
};

export type MeUser = {
  id: string;
  email: string;
  role: Role;
  coachId: string | null;
  active: boolean;
  profile: UserProfile;
  subscription: UserSubscription;
  coachQuota: CoachQuota | null;
  profilePhoto: UserProfilePhoto | null;
  goal?: UserGoal | null;
  coach?: PersonName | null;
  trainingProgram?: TrainingProgramItem[];
  trainingSessions?: TrainingSession[];
  coachTrainingProgram?: TrainingSession[];
  currentWeightKg?: number | null;
  lastLoginAt?: string;
  createdAt?: string;
};

export type PendingCoachInvite = {
  coachId: string;
  invitedAt: string;
  coach: PersonName;
};

export type Paginated<T> = {
  data: T[];
  page: number;
  limit: number;
  pages: number;
  total: number;
};

export type CoachAthlete = {
  id: string;
  email: string;
  profile: UserProfile;
  goal: UserGoal | null;
  currentWeightKg: number | null;
  coachTrainingProgram: TrainingSession[];
};

export type CoachInviteStatus = "pending" | "accepted" | "rejected" | "cancelled";

export type CoachInvite = {
  id: string;
  athleteId: string | null;
  email: string;
  status: CoachInviteStatus;
  invitedAt: string;
  respondedAt: string | null;
  athlete: PersonName | null;
};
