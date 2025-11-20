// src/components/BlocksEditor/core/migrate.ts

import { stripCssUrl } from "./bg";
import { sanitizeHtml } from "./html";

export type AnyNode = {
  id: string;
  type: string;
  children?: AnyNode[];
  cols?: AnyNode[];
  style?: any;
  [k: string]: any;
};

export type DocV2 = { version: 2; root: AnyNode };
export type AnyDoc = any;

export function isDocV2(d: any): d is DocV2 {
  return d && d.version === 2 && d.root && typeof d.root === "object";
}

function ensureArray<T>(v: T | T[] | undefined): T[] {
  return Array.isArray(v) ? v : v ? [v as T] : [];
}

function migrateNode(n: any): AnyNode {
  const node: AnyNode = {
    id: n.id ?? cryptoRandomId(),
    type: n.type ?? "section",
    style: n.style ?? {},
  };

  // legacy: background fields split → compress to style.background
  if (n.bgColor || n.bgImage || n.bgSize || n.bgPosition || n.bgRepeat) {
    const parts: string[] = [];
    if (n.bgColor) parts.push(String(n.bgColor));
    if (n.bgImage) parts.push(`url("${stripCssUrl(String(n.bgImage))}")`);
    if (n.bgSize) parts.push(String(n.bgSize));
    if (n.bgPosition) parts.push(String(n.bgPosition));
    if (n.bgRepeat) parts.push(String(n.bgRepeat));
    node.style.background = parts.join(" ");
  }

  // normalize containers
  if (node.type === "columns") {
    node.cols = ensureArray(n.cols).map(migrateNode);
  } else {
    node.children = ensureArray(n.children).map(migrateNode);
  }

  // sanitize text/html fields
  if (node.type === "text") {
    node.html = sanitizeHtml(n.html ?? "");
  }
  if (node.type === "heading") {
    node.content = String(n.content ?? "");
    node.tag = n.tag ?? "h2";
  }
  if (node.type === "image") {
    node.url = String(n.url ?? "");
    node.alt = String(n.alt ?? "");
  }
  if (node.type === "button") {
    node.label = String(n.label ?? "Button");
    node.href = String(n.href ?? "#");
  }
  if (node.type === "divider") {
    node.style = {
      ...(node.style || {}),
      thickness: Number(n.style?.thickness ?? 1),
    };
  }
  if (node.type === "spacer") {
    node.style = {
      ...(node.style || {}),
      height: Number(n.style?.height ?? 16),
    };
  }

  return node;
}

export function migrateToV2(doc: AnyDoc): DocV2 {
  if (isDocV2(doc)) {
    // still sanitize root defensively
    return { version: 2, root: migrateNode(doc.root) };
  }
  // naive legacy shape: assume doc is an array of sections or a node
  const legacyRoot = Array.isArray(doc)
    ? { id: cryptoRandomId(), type: "section", children: doc }
    : doc;
  return { version: 2, root: migrateNode(legacyRoot) };
}

export function sanitizeV2Doc(doc: DocV2): DocV2 {
  // re-run migrateNode to ensure consistent shape
  return { version: 2, root: migrateNode(doc.root) };
}

/* --------------------------------- helpers -------------------------------- */

function cryptoRandomId(): string {
  // works in modern browsers; fallback if needed
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return "id_" + Math.random().toString(36).slice(2, 10);
}
