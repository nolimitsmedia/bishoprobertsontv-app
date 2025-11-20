// Lightweight background shorthand helpers

export type ParsedBg = {
  color?: string; // e.g. "#111", "rgba(0,0,0,.5)"
  image?: string; // raw URL (no url(...))
  size?: string; // e.g. "cover" | "contain" | "1200px auto"
  position?: string; // e.g. "center" | "50% 0"
  repeat?: string; // e.g. "no-repeat" | "repeat-x"
};

/** Remove url("...") or url('...') wrapper, return inner URL or original */
export function stripCssUrl(v: string): string {
  if (!v) return v;
  const m = v.match(/url\((.*)\)/i);
  if (!m) return v.trim().replace(/^["']|["']$/g, "");
  const inner = m[1].trim();
  return inner.replace(/^["']|["']$/g, "");
}

/** Make url(...) string from a raw URL (no url wrapper) */
export function toCssUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  // avoid double-wrapping
  if (/^url\(/i.test(raw)) return raw;
  return `url("${raw}")`;
}

/**
 * Parse a very forgiving shorthand like:
 *  - "#111 url(x) cover center no-repeat"
 *  - "url(x) contain 50% 0 repeat"
 *  - "#fff"
 */
export function parseBgShorthand(input: string): ParsedBg {
  const out: ParsedBg = {};
  if (!input) return out;

  let s = input.trim();

  // extract url(...) first
  const urlMatch = s.match(/url\(([^)]+)\)/i);
  if (urlMatch) {
    out.image = stripCssUrl(urlMatch[0]);
    s = s.replace(urlMatch[0], "").trim();
  }

  // tokens left (color/size/position/repeat). Keep it simple & forgiving.
  const tokens = s.split(/\s+/).filter(Boolean);

  // detect color (very naive: hex, rgb/rgba, hsl/hsla, or named color)
  const isColor = (t: string) =>
    /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(t) ||
    /^rgba?\(/i.test(t) ||
    /^hsla?\(/i.test(t) ||
    /^[a-zA-Z]+$/.test(t); // named color like "black", "transparent"

  // detect repeat
  const isRepeat = (t: string) =>
    /^(repeat|repeat-x|repeat-y|no-repeat)$/i.test(t);

  // detect size keywords
  const isSizeKeyword = (t: string) =>
    /^(cover|contain|auto)$/i.test(t) || /px$|%$|rem$|vh$|vw$/i.test(t);

  // detect position (simple)
  const isPosition = (t: string) =>
    /^(left|center|right|top|bottom)$/i.test(t) || /%$|px$/i.test(t);

  // sweep once, gather candidates
  const sizes: string[] = [];
  const positions: string[] = [];
  for (const t of tokens) {
    if (!out.color && isColor(t)) {
      out.color = t;
      continue;
    }
    if (isRepeat(t)) {
      out.repeat = t;
      continue;
    }
    if (isSizeKeyword(t)) {
      sizes.push(t);
      continue;
    }
    if (isPosition(t)) {
      positions.push(t);
      continue;
    }
    // if token didn't match anything, best-effort: treat as position
    positions.push(t);
  }

  if (sizes.length) out.size = sizes.join(" ");
  if (positions.length) out.position = positions.join(" ");
  return out;
}

/** Build a shorthand string back from ParsedBg */
export function buildBgShorthand(bg: ParsedBg): string {
  const parts: string[] = [];
  if (bg.color) parts.push(bg.color);
  if (bg.image) parts.push(toCssUrl(bg.image)!);
  if (bg.size) parts.push(bg.size);
  if (bg.position) parts.push(bg.position);
  if (bg.repeat) parts.push(bg.repeat);
  return parts.join(" ").trim();
}
