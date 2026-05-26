import * as vscode from "vscode";
import axios from "axios";
import { Submission } from "../types";
import { getToken, getApiUrl } from "./auth.service";

/**
 * Fetches the most recent submission and review result for the current user.
 * Returns null if no submission exists yet.
 */
export async function getLatestReview(
  context: vscode.ExtensionContext
): Promise<Submission | null> {
  const token = await getToken(context);

  if (!token) {
    return null;
  }

  try {
    const response = await axios.get<{ data: Submission }>(
      `${getApiUrl()}/submissions/latest`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    return null;
  }
}

/**
 * Polls for a completed review on the given submission id.
 * Checks every 5 seconds for up to 5 minutes.
 * Shows a progress notification while waiting.
 * Resolves with the reviewed submission or null on timeout.
 */
export async function pollForReview(
  context: vscode.ExtensionContext,
  submissionId: string
): Promise<Submission | null> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "DevSimulate: Claude is reviewing your PR...",
      cancellable: false,
    },
    async () => {
      const token = await getToken(context);
      const maxAttempts = 60;
      const intervalMs = 5_000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await sleep(intervalMs);

        try {
          const response = await axios.get<{ data: Submission }>(
            `${getApiUrl()}/submissions/${submissionId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const submission = response.data.data;

          if (submission.status === "REVIEWED") {
            return submission;
          }
        } catch {
          // Transient errors — keep polling
        }
      }

      return null;
    }
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
