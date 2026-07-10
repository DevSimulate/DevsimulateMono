/**
 * Shared DevFest category mapping. Stacks are grouped into the four leaderboard
 * categories — Frontend, Backend, DevOps / Infra, System Design — so both the
 * leaderboard and certificate ranking stay in sync.
 */
export type CategoryMeta = { name: string; icon: string; order: number };

export const CATEGORY_MAP: Record<string, CategoryMeta> = {
  REACT:         { name: "Frontend",       icon: "🖥️",  order: 1 },
  ANGULAR:       { name: "Frontend",       icon: "🖥️",  order: 1 },
  JAVA:          { name: "Backend",        icon: "⚙️",  order: 2 },
  CPP:           { name: "Backend",        icon: "⚙️",  order: 2 },
  DOTNET:        { name: "Backend",        icon: "⚙️",  order: 2 },
  PYTHON:        { name: "Backend",        icon: "⚙️",  order: 2 },
  NODE:          { name: "Backend",        icon: "⚙️",  order: 2 },
  DEVOPS:        { name: "DevOps / Infra", icon: "🚀",  order: 3 },
  SYSTEM_DESIGN: { name: "System Design",  icon: "🏗️", order: 4 },
};

export const OTHER_CATEGORY: CategoryMeta = { name: "Other", icon: "💻", order: 5 };

/** Resolves a stack to its DevFest category (falls back to "Other"). */
export function categoryForStack(stack: string | null | undefined): CategoryMeta {
  return (stack && CATEGORY_MAP[stack]) || OTHER_CATEGORY;
}
