import * as vscode from "vscode";
import axios from "axios";
import { TicketAssignment } from "../types";
import { getToken, getApiUrl } from "./auth.service";

/**
 * Fetches the active ticket assignment for the authenticated user.
 * Returns null if no assignment exists.
 */
export async function getAssignedTicket(
  context: vscode.ExtensionContext
): Promise<TicketAssignment | null> {
  const token = await getToken(context);

  if (!token) {
    throw new Error("Not authenticated");
  }

  try {
    const response = await axios.get<{ data: TicketAssignment }>(
      `${getApiUrl()}/tickets/assigned`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Assigns a specific ticket to the authenticated user.
 * Returns the new assignment including ticket and codebase details.
 */
export async function assignTicket(
  context: vscode.ExtensionContext,
  ticketId: string
): Promise<TicketAssignment> {
  const token = await getToken(context);

  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await axios.post<{ data: TicketAssignment }>(
    `${getApiUrl()}/tickets/${ticketId}/assign`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return response.data.data;
}
