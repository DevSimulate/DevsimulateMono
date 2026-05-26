// ---------------------------------------------------------------------------
// Shared domain types used by both the API and the Next.js web app.
// Keep this file free of any runtime dependencies so it stays importable
// in both server and browser environments.
// ---------------------------------------------------------------------------

export type Stack = "DOTNET" | "NODE" | "ANGULAR" | "REACT";
export type Difficulty = "JUNIOR" | "MID" | "SENIOR";
export type SubscriptionTier = "FREE" | "PRO" | "COMPANY";
export type SubmissionStatus = "PENDING" | "REVIEWED" | "VOID";

export interface User {
  id: string;
  githubId: string;
  githubUsername: string;
  email: string | null;
  primaryStack: Stack;
  subscriptionTier: SubscriptionTier;
  skillScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface Codebase {
  id: string;
  name: string;
  stack: Stack;
  repoUrl: string;
  description: string;
  companyLore: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  stack: Stack;
  difficulty: Difficulty;
  filesInvolved: string[];
  rubric: TicketRubric;
  expectedMinutes: number;
  codebaseId: string;
  codebase?: Codebase;
  createdAt: string;
}

export interface TicketRubric {
  diagnosis: string;
  design: string;
  communication: string;
  execution: string;
}

export interface TicketAssignment {
  id: string;
  userId: string;
  ticketId: string;
  branchName: string;
  assignedAt: string;
  ticket?: Ticket;
  user?: User;
}

export interface Submission {
  id: string;
  userId: string;
  ticketId: string;
  prUrl: string;
  prDescription: string;
  branchName: string;
  status: SubmissionStatus;
  scoreTotal: number | null;
  scoreDiagnosis: number | null;
  scoreDesign: number | null;
  scoreCommunication: number | null;
  scoreExecution: number | null;
  claudeReview: ClaudeReview | null;
  riskScore: number;
  submittedAt: string;
  reviewedAt: string | null;
  ticket?: Ticket;
  user?: User;
}

export interface ClaudeReview {
  scoreDiagnosis: number;
  scoreDesign: number;
  scoreCommunication: number;
  scoreExecution: number;
  scoreTotal: number;
  feedback: {
    diagnosis: string;
    design: string;
    communication: string;
    execution: string;
  };
  summary: string;
  topStrength: string;
  topImprovement: string;
}

// ---------------------------------------------------------------------------
// API response envelopes
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  statusCode: number;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthPayload {
  userId: string;
  githubUsername: string;
  iat?: number;
  exp?: number;
}

export interface LoginResponse {
  token: string;
  user: User;
}
