// src/components/BlocksEditor/core/html.ts

/** ---------- small helpers ---------- **/

// Parse 'color:red; font-size:16px' → { color: 'red', fontSize: '16px' }
export function parseStyleString(input?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  const parts = String(input)
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of parts) {
    const i = p.indexOf(":");
    if (i === -1) continue;
    const key = p
      .slice(0, i)
      .trim()
      .replace(/-([a-z])/g, (_, g1) => g1.toUpperCase()); // kebab→camel
    const val = p.slice(i + 1).trim();
    out[key] = val;
  }
  return out;
}

// Serialize style object back to string (camelCase → kebab-case)
export function stringifyStyleObject(
  obj: Record<string, string | number | undefined>
): string {
  const toKebab = (s: string) =>
    s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${toKebab(k)}:${v}`)
    .join("; ");
}

// Remove inline styles from arbitrary HTML strings (not used by our blocks)
export function stripInlineStyles(html: string): string {
  if (!html) return html;
  return html.replace(/\sstyle="[^"]*"/gi, "");
}

// Extremely basic sanitizer for editor text blocks
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  let out = html.replace(/<\/?(script|style)[^>]*>/gi, "");
  out = out.replace(/\son\w+="[^"]*"/gi, "");
  out = out.replace(/\shref="javascript:[^"]*"/gi, ' href="#"');
  return out;
}

/** ---------- BLOCKS → HTML RENDERER (used by live frontend fallback) ---------- **/

type Block = {
  id?: string | number;
  type: string;
  props?: any;
  children?: Block[]; // for section
};

function sectionPadding(pad: any) {
  // supports [t,r,b,l] or {top,right,bottom,left} or numbers/strings
  if (Array.isArray(pad)) {
    const [t = 0, r = 0, b = 0, l = 0] = pad;
    return { top: t, right: r, bottom: b, left: l };
  }
  if (pad && typeof pad === "object") {
    return {
      top: pad.top ?? 0,
      right: pad.right ?? 0,
      bottom: pad.bottom ?? 0,
      left: pad.left ?? 0,
    };
  }
  // default
  return { top: 24, right: 24, bottom: 24, left: 24 };
}

function styleToString(style: Record<string, any>) {
  return stringifyStyleObject(style as any);
}

/** render a single node */
function renderNode(b?: Block): string {
  if (!b) return "";

  switch (b.type) {
    case "section": {
      const p = b.props || {};
      const pad = sectionPadding(p.padding);
      const bgColor = p.background ?? p.bg ?? "";
      const bgImg = p.backgroundImage ?? p.bgImage ?? "";
      const textAlign = p.textAlign ?? p.align ?? "left";

      const style: Record<string, any> = {
        paddingTop: `${pad.top || 0}px`,
        paddingRight: `${pad.right || 0}px`,
        paddingBottom: `${pad.bottom || 0}px`,
        paddingLeft: `${pad.left || 0}px`,
        width: "100%",
        // These two lines are the important ones for the live page:
        backgroundColor: bgColor || undefined,
        backgroundImage: bgImg ? `url("${bgImg}")` : undefined,
        backgroundSize: bgImg ? "cover" : undefined,
        backgroundRepeat: bgImg ? "no-repeat" : undefined,
        backgroundPosition: bgImg ? "center" : undefined,
        textAlign,
      };

      const children = (Array.isArray(b.children) ? b.children : [])
        .map(renderNode)
        .join("");

      return `<section style="${styleToString(style)}">${children}</section>`;
    }

    case "columns": {
      const p = b.props || {};
      const cols = Math.max(1, parseInt(p.columns ?? p.cols ?? 2, 10));
      const gap = parseInt(p.gap ?? 16, 10);
      const style: Record<string, any> = {
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
        gap: `${gap}px`,
        width: "100%",
      };
      const children = (Array.isArray(b.children) ? b.children : [])
        .map(renderNode)
        .join("");
      return `<div style="${styleToString(style)}">${children}</div>`;
    }

    case "heading": {
      const p = b.props || {};
      const text = p.text ?? "Heading";
      const tag =
        p.tag ||
        `h${Math.min(Math.max(parseInt(p.level || 2, 10) || 2, 1), 6)}`;
      const size = parseInt(p.fontSize ?? p.size ?? 28, 10);
      const weight = parseInt(p.fontWeight ?? p.weight ?? 700, 10);
      const align = p.textAlign ?? p.align ?? "left";
      const color = p.color || "";
      const style = {
        margin: 0,
        fontSize: `${size}px`,
        fontWeight: weight,
        textAlign: align,
        lineHeight: 1.2,
        color: color || undefined,
      };
      return `<${tag} style="${styleToString(style)}">${text}</${tag}>`;
    }

    case "text": {
      const p = b.props || {};
      const text = p.text || "";
      const align = p.textAlign ?? p.align ?? "left";
      const size = parseInt(p.fontSize ?? p.size ?? 16, 10);
      const color = p.color || "";
      const style = {
        margin: "0.5rem 0",
        fontSize: `${size}px`,
        textAlign: align,
        color: color || undefined,
      };
      return `<p style="${styleToString(style)}">${text}</p>`;
    }

    case "image": {
      const p = b.props || {};
      const src = p.src ?? p.url ?? "";
      const alt = p.alt || "";
      const width = p.width ? `${p.width}px` : undefined;
      const style = {
        maxWidth: "100%",
        height: "auto",
        width,
        display: "block",
      };
      if (!src) return "";
      return `<img src="${src}" alt="${alt}" style="${styleToString(
        style
      )}" />`;
    }

    case "button": {
      const p = b.props || {};
      const label = p.label || "Button";
      const href = p.href || "#";
      const align = p.textAlign ?? p.align;
      const link = `<a href="${href}" style="${styleToString({
        display: "inline-block",
        padding: "10px 16px",
        borderRadius: "8px",
        background: p.background || "#2563eb",
        color: p.color || "#fff",
        textDecoration: "none",
        fontWeight: 600,
      })}">${label}</a>`;
      if (align && align !== "left") {
        return `<div style="text-align:${align}">${link}</div>`;
      }
      return link;
    }

    default:
      return (Array.isArray(b.children) ? b.children : [])
        .map(renderNode)
        .join("");
  }
}

/** PUBLIC RENDERER: input blocks → full HTML string */
export function renderHtml(blocks: Block[] = []): string {
  const body = (Array.isArray(blocks) ? blocks : []).map(renderNode).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>${body}</body></html>`;
}
