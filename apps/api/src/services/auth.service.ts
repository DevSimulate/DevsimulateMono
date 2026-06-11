import axios from "axios";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { GitHubTokenResponse, GitHubUser } from "../types/index";
import { User } from "@prisma/client";

/**
 * Exchanges a GitHub OAuth code for an access token and returns the token
 * along with the raw GitHub user profile.
 */
export async function exchangeGitHubCode(code: string): Promise<{
  accessToken: string;
  githubUser: GitHubUser;
}> {
  const appUrl =
    process.env.APP_URL ?? "https://www.devsimulate.com";

  const tokenRes = await axios.post<GitHubTokenResponse>(
    "https://github.com/login/oauth/access_token",
    {
      client_id:    process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${appUrl}/auth/callback`,
    },
    { headers: { Accept: "application/json" } }
  );

  const accessToken = tokenRes.data.access_token;

  if (!accessToken) {
    throw new Error("GitHub did not return an access token. Check client credentials or code validity.");
  }

  const userRes = await axios.get<GitHubUser>("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  const githubUser = userRes.data;

  // The /user endpoint only returns a PUBLIC email — null for most developers.
  // Fetch /user/emails (we have the user:email scope) to get the primary
  // verified address so we can actually reach the candidate.
  if (!githubUser.email) {
    try {
      const emailsRes = await axios.get<Array<{ email: string; primary: boolean; verified: boolean }>>(
        "https://api.github.com/user/emails",
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" } }
      );
      const emails = emailsRes.data ?? [];
      const best =
        emails.find((e) => e.primary && e.verified) ??
        emails.find((e) => e.verified) ??
        emails[0];
      if (best?.email) githubUser.email = best.email;
    } catch {
      // Non-fatal — user just won't have an email on file
    }
  }

  return { accessToken, githubUser };
}

/**
 * Upserts a User record from a GitHub profile. Creates on first login,
 * updates githubUsername/email on subsequent logins. When an access token is
 * provided (OAuth granted the `repo` scope) it is stored so the platform can
 * fork/clone/push on the user's behalf — removing the need for VS Code's own
 * GitHub sign-in inside the extension.
 */
export async function upsertUserFromGitHub(
  githubUser: GitHubUser,
  accessToken?: string
): Promise<User> {
  return prisma.user.upsert({
    where: { githubId: String(githubUser.id) },
    update: {
      githubUsername: githubUser.login,
      email: githubUser.email ?? undefined,
      ...(accessToken ? { githubAccessToken: accessToken } : {}),
    },
    create: {
      githubId: String(githubUser.id),
      githubUsername: githubUser.login,
      email: githubUser.email ?? undefined,
      ...(accessToken ? { githubAccessToken: accessToken } : {}),
    },
  });
}

/**
 * Signs and returns a JWT for the given user. The token encodes userId and
 * githubUsername so downstream middleware can hydrate req.user without a DB
 * round-trip on every request.
 */
export function signJwt(user: User): string {
  const secret = process.env.JWT_SECRET;
  // 30 days so a candidate's session comfortably survives a long assessment
  // (sign in → clone & fix the bug in VS Code → come back to submit). A short
  // value here was causing "Your session expired" on the submit step.
  // NOTE: a JWT_EXPIRES_IN env var on Railway OVERRIDES this — if sessions still
  // expire too fast, check/remove that env var (it may be set to e.g. "15m"/"1h").
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "30d";

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { userId: user.id, githubUsername: user.githubUsername },
    secret,
    { expiresIn } as jwt.SignOptions
  );
}
