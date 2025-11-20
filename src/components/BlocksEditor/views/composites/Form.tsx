import React from "react";

type Field = {
  id: string;
  type: "text" | "email" | "textarea";
  label?: string;
  name?: string;
  placeholder?: string;
};
type AnyNode = {
  type: string;
  fields?: Field[];
  submitLabel?: string;
  style?: any;
};

export default function Form({ node }: { node: AnyNode }) {
  const fields = Array.isArray(node.fields)
    ? node.fields
    : [
        {
          id: "f1",
          type: "text",
          label: "Name",
          name: "name",
          placeholder: "Your name",
        },
        {
          id: "f2",
          type: "email",
          label: "Email",
          name: "email",
          placeholder: "you@example.com",
        },
        {
          id: "f3",
          type: "textarea",
          label: "Message",
          name: "message",
          placeholder: "How can we help?",
        },
      ];

  const s = node.style || {};
  const wrap: React.CSSProperties = { display: "grid", gap: s.gap ?? 10 };

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // wire to your API later
    alert("Submitted (demo)");
  }

  return (
    <form style={wrap} onSubmit={onSubmit}>
      {fields.map((f) => (
        <div key={f.id} style={{ display: "grid", gap: 6 }}>
          {f.label ? (
            <label style={{ fontSize: 12, color: "#6b7280" }}>{f.label}</label>
          ) : null}
          {f.type === "textarea" ? (
            <textarea
              className="be-textarea"
              name={f.name}
              placeholder={f.placeholder}
              rows={5}
            />
          ) : (
            <input
              className="be-input"
              type={f.type}
              name={f.name}
              placeholder={f.placeholder}
            />
          )}
        </div>
      ))}
      <div>
        <button className="be-btn primary" type="submit">
          {node.submitLabel ?? "Send"}
        </button>
      </div>
    </form>
  );
}
