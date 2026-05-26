"use client";

const TOKEN_KEY = "ds_token";

/**
 * Stores the JWT in localStorage. Only call this in client components.
 */
export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Retrieves the JWT from localStorage. Returns null if not set.
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Clears the stored JWT (logout).
 */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Returns true if a JWT is currently stored.
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}
