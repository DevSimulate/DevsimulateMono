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

  return { accessToken, githubUser: userRes.data };
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
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { userId: user.id, githubUsername: user.githubUsername },
    secret,
    { expiresIn } as jwt.SignOptions
  );
}
