// src/components/BlocksEditor/inspector/Inspector.tsx
import React from "react";
import Field from "./fields/Field";
import ImagePicker from "./fields/ImagePicker";
import ImageListEditor from "./fields/ImageListEditor";
import ItemsEditor from "./fields/ItemsEditor";
import { INSPECTOR_SCHEMAS, FieldSpec } from "./schema";

/* -------------------------- tiny local path helpers ----------------------- */
function getByPath(obj: any, path: string) {
  if (!obj || !path) return undefined;
  return path
    .split(".")
    .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}
function setByPath<T extends Record<string, any>>(
  obj: T,
  path: string,
  value: any
): T {
  const next: any = structuredClone(obj);
  const keys = path.split(".");
  let cur: any = next;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return next as T;
}

/* --------------------------------- ui bits -------------------------------- */
function EmptyPanel() {
  return (
    <div className="be-panel">
      <div className="be-empty">Select a block to edit</div>
    </div>
  );
}
function BasicPanel() {
  return (
    <div className="be-panel">
      <div className="be-title">Inspector</div>
      <div className="be-subtle">No schema for this block type yet.</div>
    </div>
  );
}

/* --------------------------------- types ---------------------------------- */
type AnyNode = { id?: string; type: string; [k: string]: any };

/* ---------------------------- field dispatcher ---------------------------- */
function renderField(
  f: FieldSpec,
  node: AnyNode,
  onChange: (next: AnyNode) => void,
  // optional file uploader for images (wire your backend later)
  onUpload?: (file: File) => Promise<string>
) {
  const value = getByPath(node, f.path);

  // custom editors
  if (f.kind === "image-picker") {
    return (
      <ImagePicker
        value={value ?? ""}
        onChange={(url) => onChange(setByPath(node, f.path, url))}
        onUpload={onUpload}
      />
    );
  }
  if (f.kind === "image-list") {
    // value should be an array of { id, url, alt }
    return (
      <ImageListEditor
        value={Array.isArray(value) ? value : []}
        onChange={(arr) => onChange(setByPath(node, f.path, arr))}
        onUpload={onUpload}
      />
    );
  }
  if (f.kind === "items-editor") {
    // tabs/accordion
    return (
      <ItemsEditor
        value={Array.isArray(value) ? value : []}
        onChange={(arr) => onChange(setByPath(node, f.path, arr))}
        titleKey={f.titleKey}
      />
    );
  }

  // default generic field
  return (
    <Field
      kind={f.kind as any}
      value={value}
      options={f.options as any}
      rows={f.rows}
      onChange={(v) => onChange(setByPath(node, f.path, v))}
    />
  );
}

/* -------------------------------- inspector ------------------------------- */
export default function Inspector({
  node,
  onChange,
  onUpload, // optional uploader passed down to image editors
  ...rest
}: {
  node?: AnyNode | null;
  onChange: (next: AnyNode) => void;
  onUpload?: (file: File) => Promise<string>;
}) {
  if (!node) return <EmptyPanel />;

  const spec = INSPECTOR_SCHEMAS[node.type];
  if (!spec) return <BasicPanel />;

  return (
    <div className="be-panel" {...rest}>
      <div className="be-title">Inspector</div>

      {spec.map((f) => (
        <div className="be-field" key={f.path}>
          <label className="be-label">{f.label}</label>
          {renderField(f, node, onChange, onUpload)}
        </div>
      ))}
    </div>
  );
}
