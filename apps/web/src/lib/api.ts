import axios, { AxiosInstance } from "axios";
import { User, Submission, TicketAssignment } from "@devsimulate/shared";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function createClient(token?: string): AxiosInstance {
  return axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * Fetches the authenticated user's profile.
 */
export async function getMe(token: string): Promise<User> {
  const client = createClient(token);
  const res = await client.get<{ data: User }>("/auth/me");
  return res.data.data;
}

/**
 * Fetches all submissions for the authenticated user.
 */
export async function getSubmissions(token: string): Promise<Submission[]> {
  const client = createClient(token);
  const res = await client.get<{ data: Submission[] }>("/submissions");
  return res.data.data;
}

/**
 * Fetches the most recent submission for the authenticated user.
 */
export async function getLatestSubmission(
  token: string
): Promise<Submission | null> {
  try {
    const client = createClient(token);
    const res = await client.get<{ data: Submission }>("/submissions/latest");
    return res.data.data;
  } catch {
    return null;
  }
}

/**
 * Fetches all active ticket assignments for the authenticated user.
 */
export async function getAssignments(
  token: string
): Promise<TicketAssignment[]> {
  try {
    const client = createClient(token);
    const res = await client.get<{ data: TicketAssignment[] }>(
      "/tickets/assigned"
    );
    return res.data.data ?? [];
  } catch {
    return [];
  }
}

export interface ScoreHistoryPoint {
  submittedAt: string;
  scoreTotal: number | null;
  scoreDiagnosis: number | null;
  scoreDesign: number | null;
  scoreCommunication: number | null;
  scoreExecution: number | null;
  ticketTitle: string;
}

/**
 * Fetches score history for the authenticated user (for chart).
 */
export async function getScoreHistory(
  token: string,
  limit = 20
): Promise<ScoreHistoryPoint[]> {
  try {
    const client = createClient(token);
    const res = await client.get<{ data: ScoreHistoryPoint[] }>(
      `/submissions/history?limit=${limit}`
    );
    return res.data.data;
  } catch {
    return [];
  }
}

export interface PublicProfile {
  githubUsername: string;
  primaryStack: string;
  skillScore: number;
  subscriptionTier: string;
  totalSubmissions: number;
  ticketsCompleted: number;
  averageScore: number;
  scoreDiagnosis: number;
  scoreDesign: number;
  scoreCommunication: number;
  scoreExecution: number;
  recentSubmissions: Array<{
    ticketTitle: string;
    scoreTotal: number | null;
    submittedAt: string;
    status: string;
  }>;
  joinedAt: string;
}

/**
 * Fetches a public developer profile by GitHub username.
 */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  try {
    const client = createClient();
    const res = await client.get<{ data: PublicProfile }>(`/users/${username}/profile`);
    return res.data.data;
  } catch {
    return null;
  }
}
