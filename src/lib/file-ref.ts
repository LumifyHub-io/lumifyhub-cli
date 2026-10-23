/**
 * Pure helpers for `lh file`: no imports, so `node --test` can load them
 * straight from source.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const BARE_RE = new RegExp(`^${UUID}$`, "i");
const PATH_RE = new RegExp(`/(?:api/(?:cli/)?)?files/(${UUID})(?:/raw)?/?(?:[?#].*)?$`, "i");

/**
 * A file id from what a card description holds: a bare id, the
 * `/api/files/<id>/raw` path (`attrs.src`), or a full lumifyhub.io URL.
 */
export function parseFileRef(input: string): string {
  const ref = input.trim();
  if (BARE_RE.test(ref)) return ref.toLowerCase();
  const match = PATH_RE.exec(ref);
  if (match) return match[1].toLowerCase();
  throw new Error(`Not a file id or LumifyHub file URL: ${input}`);
}

/** The server's filename as a bare, harmless name: never a path, never hidden-dot-only. */
export function safeFilename(name: string | null | undefined, fallback: string): string {
  const base = (name ?? "").split(/[\\/]/).pop() ?? "";
  const clean = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f<>:"|?*]/g, "_")
    .trim()
    .replace(/^\.+$/, "");
  return clean || fallback;
}
