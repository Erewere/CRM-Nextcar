import { Client, Vehicle, Task } from "../../../types";

export interface MatchScore {
  score: number; // 0 a 100
  reasons: string[];
}

export interface LeadScore {
  score: number; // 0 a 100
  probabilityCategory: "Alta" | "Media" | "Baja";
  factors: {
    budget: number;
    urgency: number;
    activity: number;
    profileCompleteness: number;
  };
}

export interface Recommendation {
  actionText: string;
  actionType: "call" | "email" | "quote" | "appointment" | "finance" | "followup";
  priority: "high" | "medium" | "low";
  reason: string;
  dueDate?: Date;
}

export interface Opportunity {
  id: string;
  clientId: string;
  vehicleId: string;
  matchScore: number;
  leadScore: number;
  status: "new" | "notified" | "dismissed" | "converted";
  createdAt: Date;
  reasons: string[];
}

export interface DemandPattern {
  make?: string;
  model?: string;
  bodyType?: string;
  yearRange?: { min: number; max: number };
  searchVolume: number;
  averageBudget: number;
  opportunityLevel: "high" | "medium" | "low";
}

export interface ClientIntelligence extends Client {
  leadScore?: number;
  leadScoreDetails?: LeadScore;
  nextRecommendedAction?: Recommendation;
}
