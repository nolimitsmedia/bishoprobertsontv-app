// src/components/BlocksEditor/inspector/schema.ts

export type FieldKind =
  | "text"
  | "number"
  | "color"
  | "select"
  | "textarea"
  // custom editors:
  | "image-picker"
  | "image-list"
  | "items-editor";

export type Option = { value: string; label?: string };

export type FieldSpec = {
  path: string; // e.g. "style.color", "images"
  kind: FieldKind;
  label: string;
  options?: Array<Option | string>;
  rows?: number; // for textarea
  // extras for custom editors:
  titleKey?: "title" | "label"; // ItemsEditor
  bodyKey?: "html"; // ItemsEditor (kept for future extension)
};

export type InspectorSchemas = Record<string, FieldSpec[]>;

/* ----------------------------------------------------------------------------
 * Schemas for each block type
 * ------------------------------------------------------------------------- */
export const INSPECTOR_SCHEMAS: InspectorSchemas = {
  /* ------------------------------- primitives ------------------------------ */
  heading: [
    { path: "content", kind: "text", label: "Text" },
    {
      path: "tag",
      kind: "select",
      label: "Tag",
      options: ["h1", "h2", "h3", "h4"],
    },
    { path: "style.color", kind: "color", label: "Text color" },
    { path: "style.size", kind: "number", label: "Font size (px)" },
    {
      path: "style.weight",
      kind: "select",
      label: "Weight",
      options: ["400", "600", "700", "800"],
    },
    { path: "style.line", kind: "number", label: "Line height" },
    {
      path: "style.align",
      kind: "select",
      label: "Align",
      options: ["left", "center", "right"],
    },
    { path: "style.bg", kind: "color", label: "Background" },
    { path: "style.pad", kind: "text", label: "Padding (e.g., 12px 16px)" },
    { path: "style.radius", kind: "number", label: "Corner radius (px)" },
    {
      path: "style.inline",
      kind: "select",
      label: "Display inline",
      options: ["no", "yes"],
    },
  ],

  text: [
    { path: "html", kind: "textarea", label: "HTML", rows: 8 },
    { path: "style.color", kind: "color", label: "Text color" },
    {
      path: "style.align",
      kind: "select",
      label: "Align",
      options: ["left", "center", "right"],
    },
    { path: "style.bg", kind: "color", label: "Background" },
    { path: "style.pad", kind: "text", label: "Padding" },
    { path: "style.radius", kind: "number", label: "Corner radius (px)" },
  ],

  image: [
    { path: "url", kind: "image-picker", label: "Image" }, // <— custom editor
    { path: "alt", kind: "text", label: "Alt text" },
    {
      path: "style.align",
      kind: "select",
      label: "Align",
      options: ["left", "center", "right"],
    },
    {
      path: "style.fit",
      kind: "select",
      label: "Object Fit",
      options: ["cover", "contain", "fill", "none", "scale-down"],
    },
    { path: "style.width", kind: "text", label: "Width (e.g., 100% or 320px)" },
    {
      path: "style.height",
      kind: "text",
      label: "Height (e.g., auto or 240px)",
    },
    { path: "style.radius", kind: "number", label: "Corner radius (px)" },
  ],

  button: [
    { path: "label", kind: "text", label: "Label" },
    { path: "href", kind: "text", label: "Link URL" },
    {
      path: "style.align",
      kind: "select",
      label: "Align",
      options: ["left", "center", "right"],
    },
    { path: "style.bg", kind: "color", label: "Background" },
    { path: "style.color", kind: "color", label: "Text color" },
    { path: "style.pad", kind: "text", label: "Padding" },
    { path: "style.radius", kind: "number", label: "Corner radius (px)" },
  ],

  divider: [
    { path: "style.color", kind: "color", label: "Color" },
    { path: "style.thickness", kind: "number", label: "Thickness (px)" },
    { path: "style.width", kind: "text", label: "Width (e.g., 100% or 320px)" },
    {
      path: "style.align",
      kind: "select",
      label: "Align",
      options: ["left", "center", "right"],
    },
  ],

  spacer: [{ path: "style.height", kind: "number", label: "Height (px)" }],

  /* -------------------------------- containers ---------------------------- */
  section: [
    {
      path: "style.background",
      kind: "text",
      label: "Background shorthand (e.g., #fff url(...) cover center)",
    },
    { path: "style.pad", kind: "text", label: "Padding (e.g., 24px 16px)" },
    {
      path: "style.width",
      kind: "text",
      label: "Max width (e.g., 100% or 960px)",
    },
    {
      path: "style.center",
      kind: "select",
      label: "Center content",
      options: ["no", "yes"],
    },
    { path: "style.radius", kind: "number", label: "Corner radius (px)" },
    { path: "style.shadow", kind: "text", label: "Box shadow (CSS)" },
    { path: "style.border", kind: "text", label: "Border (CSS)" },
  ],

  columns: [
    { path: "style.gap", kind: "number", label: "Gap (px)" },
    {
      path: "style.align",
      kind: "select",
      label: "Align items",
      options: ["stretch", "start", "center", "end"],
    },
    {
      path: "style.wrap",
      kind: "select",
      label: "Wrap",
      options: ["no", "yes"],
    },
    { path: "style.width", kind: "text", label: "Width (e.g., 100%)" },
  ],

  column: [
    { path: "style.gap", kind: "number", label: "Gap (px)" },
    { path: "span", kind: "number", label: "Flex span" },
    {
      path: "style.width",
      kind: "text",
      label: "Width (optional, overrides span)",
    },
    { path: "style.pad", kind: "text", label: "Padding" },
  ],

  /* -------------------------------- composites ---------------------------- */
  gallery: [
    { path: "images", kind: "image-list", label: "Images" }, // <— custom editor
    { path: "style.cols", kind: "number", label: "Columns" },
    {
      path: "style.rowHeight",
      kind: "number",
      label: "Row height (px, optional)",
    },
    { path: "style.gap", kind: "number", label: "Gap (px)" },
    {
      path: "style.fit",
      kind: "select",
      label: "Object Fit",
      options: ["cover", "contain", "fill", "none", "scale-down"],
    },
    { path: "style.radius", kind: "number", label: "Corner radius (px)" },
  ],

  carousel: [
    { path: "images", kind: "image-list", label: "Slides" }, // <— custom editor
    {
      path: "style.fit",
      kind: "select",
      label: "Object Fit",
      options: ["cover", "contain", "fill", "none", "scale-down"],
    },
    { path: "style.radius", kind: "number", label: "Corner radius (px)" },
  ],

  accordion: [
    { path: "items", kind: "items-editor", label: "Items", titleKey: "title" }, // <— custom editor
  ],

  tabs: [
    { path: "items", kind: "items-editor", label: "Tabs", titleKey: "label" }, // <— custom editor (label)
  ],

  form: [
    // Keeping simple: let your future advanced editor manage fields; for now submit label + gap
    { path: "submitLabel", kind: "text", label: "Submit label" },
    { path: "style.gap", kind: "number", label: "Field gap (px)" },
  ],

  live: [
    {
      path: "provider",
      kind: "select",
      label: "Provider",
      options: ["iframe", "youtube", "vimeo"],
    },
    { path: "src", kind: "text", label: "Source URL" },
    {
      path: "style.aspect",
      kind: "number",
      label: "Aspect (height/width, e.g., 0.5625 for 16:9)",
    },
    { path: "style.radius", kind: "number", label: "Corner radius (px)" },
  ],
};
