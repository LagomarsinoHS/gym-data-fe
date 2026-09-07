import type { PersonName, Role, UserGoal, UserProfile, UserSubscription } from "@/types/user";

export type AdminStats = {
  users: {
    total: number;
    byRole: { athlete: number; coach: number; admin: number };
  };
  subscriptions: {
    byPlan: { free: number; premium: number; growth: number; pro: number };
    paidExpiringSoon: number;
  };
  signups: { last7Days: number; last30Days: number };
};

export type AdminUser = {
  id: string;
  email: string;
  role: Role;
  profile: UserProfile;
  goal: UserGoal | null;
  subscription: UserSubscription;
  coachId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  coachName?: string | null;
  coach?: (PersonName & { profile?: PersonName }) | null;
  coachProfile?: PersonName | null;
};

export type AdminSubscriptionResult = {
  id: string;
  email: string;
  role: Role;
  subscription: UserSubscription;
};
