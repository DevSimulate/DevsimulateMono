import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest, AuthPayload } from "../types/index";

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ error: "Server misconfiguration: JWT_SECRET not set" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as AuthPayload;
    // A valid signature but the wrong token shape (e.g. an employer-magic or
    // vscode-link token used on a user-authenticated route) has no userId.
    if (!payload.userId) {
      res.status(401).json({ error: "Wrong token type for this request. Please sign in again.", code: "WRONG_TOKEN" });
      return;
    }
    req.user = {
      userId: payload.userId,
      githubUsername: payload.githubUsername,
    };
    next();
  } catch (err) {
    // Distinguish an expired session from a bad/mismatched-secret token so the
    // client can react correctly (re-login vs. surface a real problem).
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Your session expired. Please sign in again.", code: "TOKEN_EXPIRED" });
      return;
    }
    res.status(401).json({ error: "Invalid token. Please sign in again.", code: "TOKEN_INVALID" });
  }
}
