// src/pages/admin/SubscriptionPlanNew.js
import React from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";

/* ------------------------------------------------------------------ */
/* Small image picker (local to this page)                             */
/* ------------------------------------------------------------------ */
function ImagePicker({ label, value, onChange, uploadPath = "/uploads" }) {
  const inputRef = React.useRef();

  async function handlePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(uploadPath, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange?.(data?.url || "");
    } catch (err) {
      console.error("upload error", err);
      alert("Image upload failed");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div>
      {label && <label className="vd-label">{label}</label>}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 120,
            height: 76,
            borderRadius: 8,
            overflow: "hidden",
            background: "#f3f4f6",
            border: "1px solid var(--line)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          {value ? (
            <img
              src={value.startsWith("http") ? value : `/${value}`}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span className="vd-muted vd-small">No image</span>
          )}
        </div>
        <div>
          <button
            className="btn small"
            onClick={() => inputRef.current?.click()}
          >
            Upload…
          </button>
          {value && (
            <button
              className="btn small ghost"
              style={{ marginLeft: 8 }}
              onClick={() => onChange("")}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePick}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Plan Editor (used by New and Edit pages)                            */
/* ------------------------------------------------------------------ */
function PlanEditor({ initial, onSave, saving }) {
  const [form, setForm] = React.useState(() => ({
    // core
    title: "",
    description: "",
    priceUSD: 0,
    interval: "month",
    status: "public",
    in_trial_days: 0,
    // new fields
    tier: "basic", // basic | pro | enterprise
    features: {
      mobile_tv_apps: false,
      custom_option: false,
      support: "standard", // standard | priority | concierge
    },
    thumbnail_url: "",
  }));

  React.useEffect(() => {
    if (!initial) return;
    setForm({
      title: initial.title || "",
      description: initial.description || "",
      priceUSD: Math.max(0, Number(initial.price_cents || 0) / 100),
      interval: initial.interval || "month",
      status: initial.status || "public",
      in_trial_days: Number(initial.in_trial_days || 0),
      tier: initial.tier || "basic",
      features: {
        mobile_tv_apps: !!initial.features?.mobile_tv_apps,
        custom_option: !!initial.features?.custom_option,
        support: initial.features?.support || "standard",
      },
      thumbnail_url: initial.thumbnail_url || "",
    });
  }, [initial]);

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }
  function setFeature(k, v) {
    setForm((p) => ({ ...p, features: { ...p.features, [k]: v } }));
  }

  function save() {
    const payload = {
      title: (form.title || "").trim(),
      description: form.description || "",
      price_cents: Math.round(Number(form.priceUSD || 0) * 100),
      interval: form.interval,
      status: form.status,
      in_trial_days: Number(form.in_trial_days || 0),
      tier: form.tier,
      features: {
        mobile_tv_apps: !!form.features.mobile_tv_apps,
        custom_option: !!form.features.custom_option,
        support: form.features.support || "standard",
      },
      thumbnail_url: form.thumbnail_url || null,
    };
    if (!payload.title) return alert("Please enter a title.");
    onSave?.(payload);
  }

  return (
    <div className="card" style={{ paddingBottom: 10 }}>
      {/* Header actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800 }}>
          {initial?.id ? "Edit subscription plan" : "New subscription plan"}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn ghost"
            onClick={() => window.history.back()}
            disabled={saving}
          >
            Cancel
          </button>
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div
        className="vd-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: 18,
        }}
      >
        {/* Title */}
        <div>
          <div className="vd-label">Title</div>
          <div className="vd-muted vd-small">Name of the subscription plan</div>
        </div>
        <div>
          <input
            className="search"
            placeholder="Pro"
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <div className="vd-label">Description</div>
          <div className="vd-muted vd-small">
            Key benefits of this particular plan
          </div>
        </div>
        <div>
          <textarea
            className="search"
            rows={4}
            placeholder="Everything in Starter + Mobile & TV apps"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
          />
        </div>

        {/* Image */}
        <div>
          <div className="vd-label">Image</div>
          <div className="vd-muted vd-small">
            Appears next to the plan (recommended 995×560px)
          </div>
        </div>
        <div>
          <ImagePicker
            value={form.thumbnail_url}
            onChange={(u) => setField("thumbnail_url", u)}
          />
        </div>

        {/* Price */}
        <div>
          <div className="vd-label">Price</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <span className="badge">USD</span>
          <input
            className="search"
            type="number"
            min="0"
            step="0.01"
            value={form.priceUSD}
            onChange={(e) => setField("priceUSD", e.target.value)}
            style={{ maxWidth: 160 }}
          />
        </div>

        {/* Billing period */}
        <div>
          <div className="vd-label">Billing period</div>
          <div className="vd-muted vd-small">
            The frequency users are charged
          </div>
        </div>
        <div>
          <select
            className="search"
            value={form.interval}
            onChange={(e) => setField("interval", e.target.value)}
            style={{ maxWidth: 220 }}
          >
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </div>

        {/* Trial period */}
        <div>
          <div className="vd-label">Trial period</div>
          <div className="vd-muted vd-small">Number of days</div>
        </div>
        <div>
          <input
            className="search"
            type="number"
            min="0"
            step="1"
            style={{ maxWidth: 180 }}
            value={form.in_trial_days}
            onChange={(e) => setField("in_trial_days", e.target.value)}
          />
        </div>

        {/* Status */}
        <div>
          <div className="vd-label">Availability</div>
        </div>
        <div>
          <select
            className="search"
            value={form.status}
            onChange={(e) => setField("status", e.target.value)}
            style={{ maxWidth: 220 }}
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Tier */}
        <div>
          <div className="vd-label">Tier</div>
          <div className="vd-muted vd-small">
            Match the 3-tier model (Starter / Pro / Enterprise)
          </div>
        </div>
        <div>
          <select
            className="search"
            value={form.tier}
            onChange={(e) => setField("tier", e.target.value)}
            style={{ maxWidth: 260 }}
          >
            <option value="basic">Starter (Base)</option>
            <option value="pro">Pro (Mobile & TV)</option>
            <option value="enterprise">Enterprise (Custom)</option>
          </select>
        </div>

        {/* Features */}
        <div>
          <div className="vd-label">Features</div>
          <div className="vd-muted vd-small">Plan entitlements</div>
        </div>
        <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={!!form.features.mobile_tv_apps}
              onChange={(e) => setFeature("mobile_tv_apps", e.target.checked)}
            />
            <span>Mobile & TV apps</span>
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={!!form.features.custom_option}
              onChange={(e) => setFeature("custom_option", e.target.checked)}
            />
            <span>Custom option enabled</span>
          </label>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="vd-label" style={{ minWidth: 120 }}>
              Support level
            </span>
            <select
              className="search"
              value={form.features.support}
              onChange={(e) => setFeature("support", e.target.value)}
              style={{ maxWidth: 220 }}
            >
              <option value="standard">Standard</option>
              <option value="priority">Priority</option>
              <option value="concierge">Concierge</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* New Plan page                                                      */
/* ------------------------------------------------------------------ */
export default function SubscriptionPlanNew() {
  const navigate = useNavigate();
  const [saving, setSaving] = React.useState(false);

  async function handleSave(payload) {
    try {
      setSaving(true);
      await api.post("/subscription/plans", payload);
      navigate("/subscriptions", { replace: true });
    } catch (e) {
      console.error("create plan error:", e);
      alert(e?.response?.data?.message || "Create plan failed");
    } finally {
      setSaving(false);
    }
  }

  return <PlanEditor onSave={handleSave} saving={saving} />;
}
