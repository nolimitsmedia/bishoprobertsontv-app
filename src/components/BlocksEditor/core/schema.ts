// src/components/BlocksEditor/core/schema.ts

export type AnyNode = {
  id: string;
  type: string;
  children?: AnyNode[];
  cols?: AnyNode[];
  style?: any;
  [k: string]: any;
};

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return "id_" + Math.random().toString(36).slice(2, 10);
}

/* --------------------------------- defaults -------------------------------- */

export const DEFAULTS = {
  section(): AnyNode {
    return {
      id: uid(),
      type: "section",
      style: { width: "100%", pad: "24px 16px" },
      children: [],
    };
  },

  columns(): AnyNode {
    return {
      id: uid(),
      type: "columns",
      style: { gap: 16 },
      cols: [DEFAULTS.column(), DEFAULTS.column()],
    };
  },

  column(): AnyNode {
    return {
      id: uid(),
      type: "column",
      style: { gap: 12 },
      children: [],
    };
  },

  heading(): AnyNode {
    return {
      id: uid(),
      type: "heading",
      tag: "h2",
      content: "Heading",
      style: { size: 28, weight: "700", align: "left" },
    };
  },

  text(): AnyNode {
    return {
      id: uid(),
      type: "text",
      html: "<p>Type your content…</p>",
      style: { align: "left", color: "#222222" },
    };
  },

  image(): AnyNode {
    return {
      id: uid(),
      type: "image",
      url: "",
      alt: "",
      style: { fit: "cover", radius: 0 },
    };
  },

  button(): AnyNode {
    return {
      id: uid(),
      type: "button",
      label: "Click me",
      href: "#",
      style: {
        align: "left",
        bg: "#111827",
        color: "#ffffff",
        pad: "10px 16px",
        radius: 8,
      },
    };
  },

  divider(): AnyNode {
    return {
      id: uid(),
      type: "divider",
      style: { color: "#e5e7eb", thickness: 1, width: "100%", align: "left" },
    };
  },

  spacer(): AnyNode {
    return {
      id: uid(),
      type: "spacer",
      style: { height: 24 },
    };
  },
};

/* -------------------------------- factories -------------------------------- */

export type WidgetType =
  | "section"
  | "columns"
  | "column"
  | "heading"
  | "text"
  | "image"
  | "button"
  | "divider"
  | "spacer";

export const WIDGETS: WidgetType[] = [
  "section",
  "columns",
  "column",
  "heading",
  "text",
  "image",
  "button",
  "divider",
  "spacer",
];

export function createNode(type: WidgetType): AnyNode {
  const f = (DEFAULTS as any)[type];
  if (!f) throw new Error(`Unknown widget type: ${type}`);
  return f();
}

/* ------------------------------ sample document --------------------------- */

export function emptyDoc(): { version: 2; root: AnyNode } {
  const root = DEFAULTS.section();
  root.children!.push(DEFAULTS.heading(), DEFAULTS.text());
  return { version: 2, root };
}
