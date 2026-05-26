/**
 * Converts a string to a URL-safe kebab-case slug.
 * Used for generating deterministic git branch names from ticket titles.
 */
export default function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}
