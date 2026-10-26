const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

/**
 * "🔥 Roadmap" -> icon "🔥", title "Roadmap". Only when the title opens with a
 * single emoji grapheme, then whitespace, then more text, and no icon was
 * given explicitly (an explicit icon, even "", always wins).
 */
export function splitEmojiTitle<T extends string | undefined>(
  title: string,
  icon?: string
): { title: string; icon?: string } {
  if (icon !== undefined) return { title, icon };
  const first = segmenter.segment(title)[Symbol.iterator]().next().value?.segment;
  if (!first || !EMOJI.test(first)) return { title };
  const rest = title.slice(first.length);
  if (!/^\s/.test(rest) || rest.trim() === "") return { title };
  return { title: rest.trim(), icon: first };
}

export function withIcon(icon?: string | null): string {
  return icon ? `${icon} ` : "";
}

export const ICON_FLAG = [
  "--icon <emoji>",
  "Page icon (a leading emoji in the title is split off when omitted)",
] as const;
export const ICON_UPDATE_FLAG = ["--icon <emoji>", 'Page icon; --icon "" clears it'] as const;

/** The PUT always rewrites content, so a title- or icon-only update must resend the current one. */
export async function resolveUpdateContent(
  content: string | undefined,
  fetchCurrent: () => Promise<string>
): Promise<string> {
  return content ?? (await fetchCurrent());
}

export function pageWriteBody(
  title: string | undefined,
  icon: string | undefined
): { title?: string; icon?: string } {
  if (title === undefined) return { icon };
  return splitEmojiTitle(title, icon);
}
