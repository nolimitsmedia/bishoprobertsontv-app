import React, { useRef, useState } from "react";

export type ImagePickerProps = {
  /** current image url (can be data URL preview) */
  value?: string;
  /** called with the final URL (after upload if provided) */
  onChange: (url: string) => void;

  /** optional async uploader: given a File, return a public URL */
  onUpload?: (file: File) => Promise<string>;
  /** accept attribute for <input type="file"> */
  accept?: string;
  /** placeholder for the url input */
  placeholder?: string;
  /** disable the control */
  disabled?: boolean;
};

export default function ImagePicker({
  value,
  onChange,
  onUpload,
  accept = "image/*",
  placeholder = "https://… or choose a file",
  disabled,
}: ImagePickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setBusy(true);
    try {
      if (onUpload) {
        const url = await onUpload(file);
        onChange(url || "");
      } else {
        // fallback to data URL preview
        const data = await fileToDataURL(file);
        onChange(data);
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="be-stack" style={{ gap: 6 }}>
      <div className="be-row" style={{ gap: 6 }}>
        <input
          className="be-input"
          placeholder={placeholder}
          value={value ?? ""}
          disabled={disabled || busy}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="be-btn"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "Uploading…" : "Choose"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {value ? (
        <div
          className="be-thumb"
          style={{ border: "1px solid #e5e7eb", padding: 6, borderRadius: 8 }}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img
            src={value}
            style={{ maxWidth: "100%", height: "auto", display: "block" }}
          />
        </div>
      ) : null}
    </div>
  );
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => resolve(String(fr.result || ""));
    fr.readAsDataURL(file);
  });
}
