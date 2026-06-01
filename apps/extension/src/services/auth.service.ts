import * as vscode from "vscode";
import axios from "axios";
import { User, LoginResponse } from "../types";

const SECRET_KEY = "devsimulate.jwt";

/**
 * Retrieves the stored JWT from VS Code's SecretStorage.
 * SecretStorage is OS-keychain backed — never stored in plain settings.
 */
export async function getToken(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  return context.secrets.get(SECRET_KEY);
}

/**
 * Persists the JWT to VS Code's SecretStorage.
 */
export async function storeToken(
  context: vscode.ExtensionContext,
  token: string
): Promise<void> {
  await context.secrets.store(SECRET_KEY, token);
}

/**
 * Removes the stored JWT. Used on explicit logout.
 */
export async function clearToken(
  context: vscode.ExtensionContext
): Promise<void> {
  await context.secrets.delete(SECRET_KEY);
}

/**
 * Initiates the GitHub OAuth flow by:
 * 1. Opening a GitHub authorization URL in the system browser
 * 2. Prompting the user to paste the returned code
 * 3. Exchanging the code for a JWT via the DevSimulate API
 * 4. Storing the JWT in SecretStorage
 *
 * Returns the authenticated User or undefined if cancelled.
 */
export async function loginWithGitHub(
  context: vscode.ExtensionContext
): Promise<User | undefined> {
  const apiUrl = getApiUrl();
  const clientId = "0v231ifojnuE5exAlpSf";

  const authUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${clientId}` +
    `&scope=read:user,user:email` +
    `&redirect_uri=${encodeURIComponent("https://www.devsimulate.com/auth/callback")}` +
    `&state=vscode`;

  await vscode.env.openExternal(vscode.Uri.parse(authUrl));

  const code = await vscode.window.showInputBox({
    prompt:
      "A page opened in your browser showing a code. Copy that code and paste it here.",
    ignoreFocusOut: true,
    placeHolder: "Paste the code from the browser page",
  });

  if (!code) {
    return undefined;
  }

  try {
    const response = await axios.post<{ data: LoginResponse }>(
      `${apiUrl}/auth/github`,
      { code }
    );

    const { token, user } = response.data.data;
    await storeToken(context, token);
    return user;
  } catch (err) {
    const message =
      axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data as { error: string }).error
        : "Login failed. Check your internet connection.";
    throw new Error(message);
  }
}

/**
 * Fetches the current user profile using the stored JWT.
 * Returns undefined if the token is missing or expired.
 */
export async function getCurrentUser(
  context: vscode.ExtensionContext
): Promise<User | undefined> {
  const token = await getToken(context);

  if (!token) {
    return undefined;
  }

  try {
    const response = await axios.get<{ data: User }>(
      `${getApiUrl()}/auth/me`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  } catch {
    // Token is invalid or expired
    await clearToken(context);
    return undefined;
  }
}

/**
 * Returns the configured API URL from VS Code settings.
 */
export function getApiUrl(): string {
  const config = vscode.workspace.getConfiguration("devsimulate");
  return config.get<string>("apiUrl") ?? "https://devsimulateapi-production.up.railway.app";
}
