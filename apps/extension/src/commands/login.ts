import * as vscode from "vscode";
import { loginWithGitHub } from "../services/auth.service";
import { SidebarProvider } from "../views/sidebar";

/**
 * Handles the devsimulate.login command.
 * Opens GitHub OAuth in the system browser, prompts for the code,
 * exchanges it for a JWT, and updates the sidebar with the user profile.
 */
export async function loginCommand(
  context: vscode.ExtensionContext,
  sidebar: SidebarProvider
): Promise<void> {
  try {
    const user = await loginWithGitHub(context);

    if (!user) {
      return; // User cancelled the input box
    }

    sidebar.update({ user });
    vscode.window.showInformationMessage(
      `DevSimulate: Welcome, ${user.githubUsername}! 🎉`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    vscode.window.showErrorMessage(`DevSimulate: ${message}`);
  }
}
