import React from "react";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */
export type FieldKind = "text" | "number" | "color" | "select" | "textarea";

export type Option = { value: string; label?: string };

export type FieldProps = {
  kind: FieldKind;
  value: any;
  onChange: (v: any) => void;

  // optional extras used by some controls
  options?: Array<Option | string>; // for "select"
  rows?: number; // for "textarea"
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  disabled?: boolean;
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */
export default function Field({
  kind,
  value,
  onChange,
  options,
  rows,
  placeholder,
  min,
  max,
  step,
  disabled,
}: FieldProps) {
  if (kind === "text") {
    return (
      <input
        className="be-input"
        value={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (kind === "number") {
    return (
      <input
        type="number"
        className="be-input"
        value={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step as number | undefined}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? "" : Number(v));
        }}
      />
    );
  }

  if (kind === "color") {
    return (
      <input
        type="color"
        className="be-input"
        value={value || "#000000"}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (kind === "select") {
    const opts: Option[] = (options || []).map((o) =>
      typeof o === "string" ? { value: o, label: o } : o
    );
    const current = value ?? opts[0]?.value ?? "";
    return (
      <select
        className="be-input"
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label ?? o.value}
          </option>
        ))}
      </select>
    );
  }

  if (kind === "textarea") {
    return (
      <textarea
        className="be-textarea"
        rows={rows ?? 6}
        value={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // Unknown kind → render nothing to avoid crashes
  return null;
}
