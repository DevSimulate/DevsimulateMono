import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { User, TicketAssignment, Submission } from "../types";

export interface SidebarState {
  user: User | null;
  assignment: TicketAssignment | null;
  submission: Submission | null;
}

/**
 * Provides the DevSimulate activity bar sidebar as a WebviewViewProvider.
 * The webview renders ticket details, score bars, and action buttons.
 * State updates are pushed from the extension host via postMessage.
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view: vscode.WebviewView | undefined;
  private _extensionUri: vscode.Uri;
  private _state: SidebarState = {
    user: null,
    assignment: null,
    submission: null,
  };

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._buildHtml(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((message: { command: string }) => {
      switch (message.command) {
        case "login":
          vscode.commands.executeCommand("devsimulate.login");
          break;
        case "cloneCodebase":
          vscode.commands.executeCommand("devsimulate.cloneCodebase");
          break;
        case "submitPR":
          vscode.commands.executeCommand("devsimulate.submitPR");
          break;
      }
    });

    // Push current state to freshly resolved view
    this._pushState();
  }

  /**
   * Updates the sidebar with new state and re-renders the webview content.
   */
  public update(partial: Partial<SidebarState>): void {
    this._state = { ...this._state, ...partial };
    this._pushState();
  }

  private _pushState(): void {
    if (this._view) {
      this._view.webview.postMessage({
        type: "update",
        state: this._state,
      });
    }
  }

  private _buildHtml(webview: vscode.Webview): string {
    const htmlPath = path.join(
      this._extensionUri.fsPath,
      "src",
      "views",
      "sidebar.html"
    );

    let html = fs.readFileSync(htmlPath, "utf-8");

    // Generate a fresh nonce for each webview instantiation
    const nonce = crypto.randomBytes(16).toString("base64");
    html = html.replaceAll("{{NONCE}}", nonce);

    return html;
  }
}
