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

    webviewView.webview.onDidReceiveMessage((message: { command: string }) => {
      switch (message.command) {
        case "ready":
          // Webview JS has initialised — safe to push state now
          this._pushState();
          break;
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
  }

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

  private _buildHtml(_webview: vscode.Webview): string {
    const nonce = crypto.randomBytes(16).toString("base64");

    const htmlPath = path.join(
      this._extensionUri.fsPath,
      "media",
      "sidebar.html"
    );

    try {
      let html = fs.readFileSync(htmlPath, "utf-8");
      html = html.replaceAll("{{NONCE}}", nonce);
      return html;
    } catch {
      // Fallback: inline login screen so the sidebar is never blank
      return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"/>
        <style>body{font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);padding:16px;text-align:center;}
        button{margin-top:16px;padding:9px 16px;background:#24292e;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;width:100%;}</style>
        </head><body>
        <div style="font-size:24px;margin-bottom:8px;">⚡</div>
        <div style="font-weight:700;font-size:15px;margin-bottom:4px;">DevSimulate</div>
        <div style="font-size:12px;opacity:0.6;margin-bottom:20px;">Solve real tickets. Get scored by AI.</div>
        <button id="btn-login">Login with GitHub</button>
        <script nonce="${nonce}">
          const vscode=acquireVsCodeApi();
          document.getElementById('btn-login').addEventListener('click',()=>vscode.postMessage({command:'login'}));
          vscode.postMessage({command:'ready'});
        </script></body></html>`;
    }
  }
}
