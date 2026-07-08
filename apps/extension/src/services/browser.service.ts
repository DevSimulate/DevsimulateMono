import * as vscode from "vscode";
import * as fs from "fs";
import { spawn } from "child_process";

/**
 * Known install locations for Microsoft Edge on Windows.
 */
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  `${process.env["LOCALAPPDATA"] ?? ""}\\Microsoft\\Edge\\Application\\msedge.exe`,
];

function findEdge(): string | null {
  for (const p of EDGE_PATHS) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Opens a URL in Microsoft Edge specifically.
 *
 * The DevSimulate assessment flow (verbal defence: camera + mic + speech
 * recognition) is only reliable in Edge, and login must happen in the SAME
 * browser as the assessment or the session cookie won't carry over. Routing
 * every DevSimulate URL through Edge guarantees both.
 *
 * Falls back to the OS default browser on non-Windows, or if Edge isn't found.
 */
export async function openInBrowser(url: string): Promise<void> {
  if (process.platform === "win32") {
    // 1. Launch the Edge executable directly. Passing the URL as a single argv
    //    entry avoids any shell parsing of `&` in query strings.
    const edge = findEdge();
    if (edge) {
      try {
        const child = spawn(edge, [url], { detached: true, stdio: "ignore" });
        child.unref();
        return;
      } catch {
        /* fall through to protocol handler */
      }
    }

    // 2. Fallback: the microsoft-edge: protocol handler via `start`.
    try {
      const child = spawn("cmd", ["/c", "start", "", `microsoft-edge:${url}`], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.unref();
      return;
    } catch {
      /* fall through to default browser */
    }
  }

  // 3. Non-Windows or Edge unavailable — use whatever the OS default is.
  await vscode.env.openExternal(vscode.Uri.parse(url));
}
