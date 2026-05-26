import { Request } from "express";

// ---------------------------------------------------------------------------
// Augmented Express types
// ---------------------------------------------------------------------------

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    githubUsername: string;
  };
}

// ---------------------------------------------------------------------------
// GitHub OAuth
// ---------------------------------------------------------------------------

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string;
}

// ---------------------------------------------------------------------------
// GitHub Webhook payloads
// ---------------------------------------------------------------------------

export interface GitHubPullRequestPayload {
  action: "opened" | "synchronize" | "closed" | "reopened";
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    head: {
      ref: string;
      sha: string;
      repo: {
        full_name: string;
        clone_url: string;
      };
    };
    base: {
      ref: string;
      repo: {
        full_name: string;
        owner: {
          login: string;
        };
        name: string;
      };
    };
    user: {
      login: string;
    };
  };
  repository: {
    full_name: string;
    owner: {
      login: string;
    };
    name: string;
  };
}

// ---------------------------------------------------------------------------
// BullMQ job data
// ---------------------------------------------------------------------------

export interface ReviewJobData {
  submissionId: string;
  prUrl: string;
  prDescription: string;
  branchName: string;
  ticketId: string;
  repoOwner: string;
  repoName: string;
  prNumber: number;
}

// ---------------------------------------------------------------------------
// Claude review
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// JWT payload
// ---------------------------------------------------------------------------

export interface AuthPayload {
  userId: string;
  githubUsername: string;
}

// ---------------------------------------------------------------------------
// Claude review
// ---------------------------------------------------------------------------

export interface FollowUpQuestionsResult {
  question1: string;
  question2: string;
}

export interface FollowUpScoreResult {
  score1: number;
  score2: number;
  scoreBonus: number;
  feedback: string;
  declarationMismatch: boolean;
  employerSummary: string;
}

export interface ClaudeReviewResult {
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
