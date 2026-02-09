// src/pages/admin/Calendar.js
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import "./Calendar.css";

/**
 * Admin Calendar (Uscreen-style scheduling)
 * API (single events):
 *  GET    /api/admin/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
 *  POST   /api/admin/calendar/events
 *  PUT    /api/admin/calendar/events/:id
 *  DELETE /api/admin/calendar/events/:id
 *
 * API (recurring series):
 *  POST   /api/admin/calendar/series
 *  PUT    /api/admin/calendar/series/:id
 *  DELETE /api/admin/calendar/series/:id
 *  POST   /api/admin/calendar/series/:id/exceptions
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODate(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

function toLocalInputValue(d) {
  if (!d) return "";
  const x = new Date(d);
  const yyyy = x.getFullYear();
  const mm = pad2(x.getMonth() + 1);
  const dd = pad2(x.getDate());
  const hh = pad2(x.getHours());
  const mi = pad2(x.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalInputValue(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function startOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date, weekStartsOn = 0) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function niceMonthTitle(d) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function niceDayTitle(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function sortByStartAsc(a, b) {
  return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
}

const TYPE_OPTIONS = [
  { value: "live", label: "Live Stream" },
  { value: "premiere", label: "Premiere" },
  { value: "upload", label: "Upload / Publish" },
  { value: "meeting", label: "Meeting / Internal" },
];

/* -----------------------------------------
   Modern Loading Spinner (matches LiveStreaming.js)
----------------------------------------- */
function CircularSpinner({ size = 40, label = "Loading…" }) {
  const ring = Math.max(4, Math.round(size / 10));

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: 10,
        padding: "14px 0",
      }}
    >
      <style>{`
        @keyframes brtv-spin { to { transform: rotate(360deg); } }
        @keyframes brtv-dash {
          0%   { stroke-dasharray: 1, 200; stroke-dashoffset: 0; }
          50%  { stroke-dasharray: 90, 200; stroke-dashoffset: -35; }
          100% { stroke-dasharray: 90, 200; stroke-dashoffset: -125; }
        }
      `}</style>

      <div
        aria-label={label}
        role="status"
        style={{
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 50 50"
          style={{
            animation: "brtv-spin 1.2s linear infinite",
            filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.35))",
          }}
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={ring}
          />
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="rgba(154, 92, 255, 0.95)"
            strokeLinecap="round"
            strokeWidth={ring}
            style={{ animation: "brtv-dash 1.4s ease-in-out infinite" }}
          />
        </svg>
      </div>

      {!!label && (
        <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13 }}>
          {label}
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------
   Skeleton Shimmer Blocks (no deps)
----------------------------------------- */
function ShimmerBlock({ style }) {
  return (
    <>
      <style>{`
        @keyframes brtv-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
      `}</style>
      <div
        style={{
          borderRadius: 10,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%)",
          backgroundSize: "200% 100%",
          animation: "brtv-shimmer 1.15s ease-in-out infinite",
          ...style,
        }}
      />
    </>
  );
}

function SkeletonCalendarLayout({ isMonthView }) {
  const gridCount = isMonthView ? 42 : 7;

  return (
    <div className="cal-layout" aria-busy="true">
      <div className="cal-gridCard">
        {isMonthView ? (
          <div className="cal-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="cal-weekday">
                {d}
              </div>
            ))}
          </div>
        ) : null}

        <div className={`cal-grid ${isMonthView ? "is-month" : "is-week"}`}>
          {Array.from({ length: gridCount }).map((_, i) => (
            <div
              key={i}
              className="cal-cell"
              style={{
                cursor: "default",
              }}
            >
              <div className="cal-cellTop">
                <ShimmerBlock
                  style={{
                    width: 26,
                    height: 12,
                    borderRadius: 8,
                  }}
                />
                <ShimmerBlock
                  style={{
                    width: 22,
                    height: 14,
                    borderRadius: 999,
                    opacity: 0.65,
                  }}
                />
              </div>

              <div className="cal-pills">
                <ShimmerBlock
                  style={{
                    width: `${55 + (i % 3) * 10}%`,
                    height: 16,
                    borderRadius: 999,
                  }}
                />
                <div style={{ height: 6 }} />
                <ShimmerBlock
                  style={{
                    width: `${40 + (i % 4) * 12}%`,
                    height: 16,
                    borderRadius: 999,
                    opacity: 0.9,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="cal-agendaCard">
        <div className="cal-agendaHead">
          <div className="cal-agendaTitleWrap">
            <h3 className="cal-agendaTitle">Agenda</h3>
            <div className="cal-agendaSub">Scheduled items in this range</div>
          </div>

          <div className="cal-agendaCount">
            <ShimmerBlock style={{ width: 80, height: 12, borderRadius: 8 }} />
          </div>
        </div>

        <div style={{ paddingTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <CircularSpinner size={34} label="" />
            <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13 }}>
              Loading calendar…
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div className="cal-agendaList" style={{ pointerEvents: "none" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="cal-agendaItem"
                style={{
                  cursor: "default",
                  opacity: 0.95,
                }}
              >
                <ShimmerBlock
                  style={{
                    width: 110,
                    height: 22,
                    borderRadius: 999,
                  }}
                />
                <div className="cal-agendaMain">
                  <ShimmerBlock
                    style={{
                      width: `${62 + (i % 3) * 12}%`,
                      height: 12,
                      borderRadius: 8,
                    }}
                  />
                  <div style={{ height: 6 }} />
                  <ShimmerBlock
                    style={{
                      width: `${40 + (i % 3) * 15}%`,
                      height: 10,
                      borderRadius: 8,
                      opacity: 0.9,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Recurrence helpers ---------------- */

const DOW = [
  { key: "SU", label: "Sun" },
  { key: "MO", label: "Mon" },
  { key: "TU", label: "Tue" },
  { key: "WE", label: "Wed" },
  { key: "TH", label: "Thu" },
  { key: "FR", label: "Fri" },
  { key: "SA", label: "Sat" },
];

function guessByWeekdayFromStart(localStartAt) {
  try {
    const d = new Date(localStartAt);
    const map = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const k = map[d.getDay()];
    return k ? [k] : ["SU"];
  } catch {
    return ["SU"];
  }
}

function getSeriesId(ev) {
  return ev?.series_id ?? ev?.recurring_series_id ?? null;
}
function getOccurrenceDate(ev) {
  return ev?.occurrence_date ?? ev?.occurrence_on ?? null;
}

export default function Calendar() {
  const [view, setView] = useState("month"); // "month" | "week"
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // recurrence controls
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatFreq, setRepeatFreq] = useState("weekly"); // weekly | monthly
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatByWeekday, setRepeatByWeekday] = useState(["SU"]);
  const [repeatUntil, setRepeatUntil] = useState(""); // date-only: YYYY-MM-DD
  const [editScope, setEditScope] = useState("occurrence"); // occurrence | series

  const [form, setForm] = useState({
    title: "",
    type: "live",
    start_at: "",
    end_at: "",
    video_id: "",
    category_id: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const range = useMemo(() => {
    if (view === "week") {
      const from = startOfWeek(cursor, 0);
      const to = addDays(from, 6);
      return { from, to };
    }

    const mStart = startOfMonth(cursor);
    const mEnd = endOfMonth(cursor);
    const from = startOfWeek(mStart, 0);
    const to = addDays(startOfWeek(mEnd, 0), 6);
    return { from, to };
  }, [view, cursor]);

  async function fetchEvents() {
    setLoading(true);
    setErr("");
    try {
      const from = toISODate(range.from);
      const to = toISODate(range.to);

      const res = await api.get(
        `/admin/calendar/events?from=${from}&to=${to}&_=${Date.now()}`,
      );

      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Failed to load");

      setEvents(Array.isArray(res.data.events) ? res.data.events : []);
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "We couldn’t load calendar data.";
      setErr(msg);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, range.from.getTime(), range.to.getTime()]);

  const gridDays = useMemo(() => {
    const days = [];
    let d = new Date(range.from);
    d.setHours(0, 0, 0, 0);
    const end = new Date(range.to);
    end.setHours(0, 0, 0, 0);

    while (d.getTime() <= end.getTime()) {
      days.push(new Date(d));
      d = addDays(d, 1);
    }
    return days;
  }, [range]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const start = new Date(ev.start_at);
      const key = toISODate(start);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    for (const [k, list] of map.entries()) {
      list.sort(sortByStartAsc);
      map.set(k, list);
    }
    return map;
  }, [events]);

  const agenda = useMemo(() => [...events].sort(sortByStartAsc), [events]);

  function resetRecurrenceUI() {
    setRepeatEnabled(false);
    setRepeatFreq("weekly");
    setRepeatInterval(1);
    setRepeatByWeekday(["SU"]);
    setRepeatUntil("");
    setEditScope("occurrence");
  }

  function openCreateForDay(day) {
    const start = new Date(day);
    start.setHours(19, 0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    setEditing(null);
    setForm({
      title: "",
      type: "live",
      start_at: toLocalInputValue(start),
      end_at: toLocalInputValue(end),
      video_id: "",
      category_id: "",
      notes: "",
    });

    resetRecurrenceUI();
    setRepeatByWeekday(guessByWeekdayFromStart(toLocalInputValue(start)));

    setModalOpen(true);
  }

  function openEdit(ev) {
    setEditing(ev);
    setForm({
      title: ev.title || "",
      type: ev.type || "live",
      start_at: toLocalInputValue(ev.start_at),
      end_at: toLocalInputValue(ev.end_at),
      video_id: ev.video_id ? String(ev.video_id) : "",
      category_id: ev.category_id ? String(ev.category_id) : "",
      notes: ev.notes || "",
    });

    const seriesId = getSeriesId(ev);
    const isSeries = !!seriesId;

    resetRecurrenceUI();
    if (isSeries) {
      setEditScope("occurrence");
    }

    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
  }

  function buildPayloadFromForm() {
    return {
      title: String(form.title || "").trim(),
      type: form.type,
      start_at: fromLocalInputValue(form.start_at),
      end_at: fromLocalInputValue(form.end_at),
      video_id: form.video_id ? Number(form.video_id) : null,
      category_id: form.category_id ? Number(form.category_id) : null,
      notes: String(form.notes || "").trim(),
    };
  }

  function validatePayload(payload) {
    if (!payload.title) return "Title is required.";
    if (!payload.start_at) return "Start date/time is required.";
    if (
      payload.end_at &&
      new Date(payload.end_at) < new Date(payload.start_at)
    ) {
      return "End time must be after start time.";
    }
    return "";
  }

  async function saveEvent(e) {
    e.preventDefault();
    if (saving) return;

    const payload = buildPayloadFromForm();
    const bad = validatePayload(payload);
    if (bad) {
      alert(bad);
      return;
    }

    const wantsRepeat = !!repeatEnabled;

    setSaving(true);
    try {
      const editingSeriesId = editing ? getSeriesId(editing) : null;
      const occurrenceDate =
        (editing && getOccurrenceDate(editing)) ||
        (payload.start_at ? toISODate(payload.start_at) : null);

      // editing occurrence from series
      if (editing?.id && editingSeriesId) {
        if (editScope === "series") {
          const seriesPayload = {
            ...payload,
            recurrence: {
              freq: repeatFreq,
              interval: Math.max(1, Number(repeatInterval) || 1),
              byweekday:
                repeatFreq === "weekly"
                  ? (repeatByWeekday || []).filter(Boolean)
                  : [],
              until: repeatUntil ? `${repeatUntil}T23:59:59.000Z` : null,
            },
          };

          const res = await api.put(
            `/admin/calendar/series/${editingSeriesId}`,
            seriesPayload,
          );
          if (!res?.data?.ok)
            throw new Error(res?.data?.message || "Update failed");
        } else {
          const excPayload = {
            date: occurrenceDate,
            action: "override",
            override: payload,
          };
          const res = await api.post(
            `/admin/calendar/series/${editingSeriesId}/exceptions`,
            excPayload,
          );
          if (!res?.data?.ok)
            throw new Error(res?.data?.message || "Update failed");
        }

        setModalOpen(false);
        setEditing(null);
        await fetchEvents();
        return;
      }

      // creating new
      if (!editing?.id) {
        if (wantsRepeat) {
          const seriesPayload = {
            ...payload,
            recurrence: {
              freq: repeatFreq,
              interval: Math.max(1, Number(repeatInterval) || 1),
              byweekday:
                repeatFreq === "weekly"
                  ? (repeatByWeekday || []).filter(Boolean)
                  : [],
              until: repeatUntil ? `${repeatUntil}T23:59:59.000Z` : null,
            },
          };

          const res = await api.post(`/admin/calendar/series`, seriesPayload);
          if (!res?.data?.ok)
            throw new Error(res?.data?.message || "Create failed");
        } else {
          const res = await api.post(`/admin/calendar/events`, payload);
          if (!res?.data?.ok)
            throw new Error(res?.data?.message || "Create failed");
        }

        setModalOpen(false);
        setEditing(null);
        await fetchEvents();
        return;
      }

      // editing single event
      if (editing?.id) {
        const res = await api.put(
          `/admin/calendar/events/${editing.id}`,
          payload,
        );
        if (!res?.data?.ok)
          throw new Error(res?.data?.message || "Update failed");

        setModalOpen(false);
        setEditing(null);
        await fetchEvents();
        return;
      }
    } catch (err2) {
      const msg =
        err2?.response?.data?.message ||
        err2?.message ||
        "Failed to save event.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent() {
    if (!editing?.id) return;

    const seriesId = getSeriesId(editing);
    const occurrenceDate =
      getOccurrenceDate(editing) ||
      (editing?.start_at ? toISODate(editing.start_at) : null);

    if (seriesId) {
      // eslint-disable-next-line no-alert
      const choice = window.prompt(
        "Type one:\n\n1) occurrence  — delete only this date\n2) series      — delete entire recurring series\n\n(Enter: occurrence / series)",
        "occurrence",
      );

      const c = String(choice || "")
        .trim()
        .toLowerCase();
      if (!c) return;

      setSaving(true);
      try {
        if (c === "series") {
          const ok = window.confirm("Delete the entire recurring series?");
          if (!ok) return;

          const res = await api.delete(`/admin/calendar/series/${seriesId}`);
          if (!res?.data?.ok)
            throw new Error(res?.data?.message || "Delete failed");
        } else {
          const ok = window.confirm("Delete only this occurrence?");
          if (!ok) return;

          const res = await api.post(
            `/admin/calendar/series/${seriesId}/exceptions`,
            { date: occurrenceDate, action: "skip" },
          );
          if (!res?.data?.ok)
            throw new Error(res?.data?.message || "Delete failed");
        }

        setModalOpen(false);
        setEditing(null);
        await fetchEvents();
      } catch (err2) {
        const msg =
          err2?.response?.data?.message ||
          err2?.message ||
          "Failed to delete event.";
        alert(msg);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!window.confirm("Delete this scheduled item?")) return;

    setSaving(true);
    try {
      const res = await api.delete(`/admin/calendar/events/${editing.id}`);
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Delete failed");

      setModalOpen(false);
      setEditing(null);
      await fetchEvents();
    } catch (err2) {
      const msg =
        err2?.response?.data?.message ||
        err2?.message ||
        "Failed to delete event.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  function prev() {
    if (view === "week") setCursor(addDays(cursor, -7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  }

  function next() {
    if (view === "week") setCursor(addDays(cursor, 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  }

  function today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setCursor(d);
  }

  const isMonthView = view === "month";
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const rangeLabel =
    view === "week"
      ? `${niceDayTitle(range.from)} – ${niceDayTitle(range.to)}`
      : niceMonthTitle(cursor);

  const hasSeries = !!(editing && getSeriesId(editing));

  useEffect(() => {
    if (!modalOpen) return;
    if (!repeatEnabled) return;
    if (!form.start_at) return;
    if (repeatFreq !== "weekly") return;

    const guess = guessByWeekdayFromStart(form.start_at);
    setRepeatByWeekday((prev) => (prev?.length ? prev : guess));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatEnabled, modalOpen, repeatFreq, form.start_at]);

  // --------- Modal layout styles (scrollable body + sticky header/footer)
  const modalCardStyle = {
    width: "min(980px, calc(100vw - 32px))",
    maxHeight: "min(86vh, 820px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: 16,
  };

  const modalHeadStyle = {
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "rgba(12,12,14,0.92)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  };

  const modalBodyStyle = {
    flex: 1,
    overflowY: "auto",
    padding: 18,
    paddingRight: 14,
  };

  const modalFooterStyle = {
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    background: "rgba(12,12,14,0.92)",
    backdropFilter: "blur(10px)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    padding: 14,
  };

  const sectionCardStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  };

  function decInterval() {
    setRepeatInterval((n) => Math.max(1, (Number(n) || 1) - 1));
  }
  function incInterval() {
    setRepeatInterval((n) => Math.max(1, (Number(n) || 1) + 1));
  }

  const selectedDowLabels = useMemo(() => {
    const map = new Map(DOW.map((d) => [d.key, d.label]));
    return (repeatByWeekday || []).map((k) => map.get(k) || k);
  }, [repeatByWeekday]);

  const repeatSummary = useMemo(() => {
    if (!repeatEnabled) return "";
    const unit = repeatFreq === "monthly" ? "month" : "week";
    const every = Math.max(1, Number(repeatInterval) || 1);
    const everyText = every === 1 ? `every ${unit}` : `every ${every} ${unit}s`;

    let onText = "";
    if (repeatFreq === "weekly" && selectedDowLabels.length) {
      onText = ` on ${selectedDowLabels.join(", ")}`;
    }

    let untilText = "";
    if (repeatUntil) {
      untilText = ` until ${repeatUntil}`;
    }

    return `Repeats ${everyText}${onText}${untilText}.`;
  }, [
    repeatEnabled,
    repeatFreq,
    repeatInterval,
    selectedDowLabels,
    repeatUntil,
  ]);

  return (
    <div className="cal-page">
      <div className="cal-wrap">
        <div className="cal-top">
          <div className="cal-topLeft">
            <div className="cal-kicker">ADMIN</div>
            <h1 className="cal-title">Calendar</h1>
            <p className="cal-sub">
              Schedule live streams, premieres, and content drops.
            </p>
          </div>

          <div className="cal-controls">
            <button className="cal-btn cal-btn--ghost" onClick={today}>
              Today
            </button>
            <button
              className="cal-btn cal-btn--ghost"
              onClick={prev}
              aria-label="Previous"
            >
              ←
            </button>
            <button
              className="cal-btn cal-btn--ghost"
              onClick={next}
              aria-label="Next"
            >
              →
            </button>

            <div className="cal-sep" />

            <button
              className={`cal-btn ${
                view === "month" ? "cal-btn--primary" : "cal-btn--ghost"
              }`}
              onClick={() => setView("month")}
            >
              Month
            </button>
            <button
              className={`cal-btn ${
                view === "week" ? "cal-btn--primary" : "cal-btn--ghost"
              }`}
              onClick={() => setView("week")}
            >
              Week
            </button>
          </div>
        </div>

        <div className="cal-bar">
          <div className="cal-rangeTitle">{rangeLabel}</div>

          <div className="cal-barRight">
            <div className="cal-statPill">
              <span className="cal-statLabel">Items</span>
              <span className="cal-statValue">{events.length}</span>
            </div>

            <button
              className="cal-btn cal-btn--primary"
              onClick={() => openCreateForDay(new Date())}
            >
              + New schedule
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonCalendarLayout isMonthView={isMonthView} />
        ) : err ? (
          <div className="cal-card">
            <div className="cal-errorTitle">We couldn’t load the calendar.</div>
            <div className="cal-errorText">{err}</div>
            <div className="cal-muted" style={{ marginTop: 10 }}>
              Make sure backend route exists: <b>/api/admin/calendar/events</b>
            </div>
          </div>
        ) : (
          <div className="cal-layout">
            <div className="cal-gridCard">
              {isMonthView ? (
                <div className="cal-weekdays">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (d) => (
                      <div key={d} className="cal-weekday">
                        {d}
                      </div>
                    ),
                  )}
                </div>
              ) : null}

              <div
                className={`cal-grid ${isMonthView ? "is-month" : "is-week"}`}
              >
                {gridDays.map((day) => {
                  const iso = toISODate(day);
                  const list = eventsByDay.get(iso) || [];
                  const inMonth = day.getMonth() === cursor.getMonth();
                  const isToday = sameDay(day, todayDate);

                  return (
                    <div
                      key={iso}
                      className={[
                        "cal-cell",
                        !inMonth && isMonthView ? "is-out" : "",
                        isToday ? "is-today" : "",
                      ].join(" ")}
                      onClick={() => openCreateForDay(day)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") openCreateForDay(day);
                      }}
                      title="Click to schedule"
                    >
                      <div className="cal-cellTop">
                        <div className="cal-dayNum">{day.getDate()}</div>
                        {list.length ? (
                          <div className="cal-dayCount">{list.length}</div>
                        ) : null}
                      </div>

                      <div className="cal-pills">
                        {list.slice(0, isMonthView ? 3 : 6).map((ev) => (
                          <button
                            key={ev.id}
                            className={`cal-pill cal-pill--${ev.type || "live"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(ev);
                            }}
                            title={ev.title}
                          >
                            <span className="cal-pillDot" />
                            <span className="cal-pillText">
                              {ev.title || "Untitled"}
                              {getSeriesId(ev) ? "  ↻" : ""}
                            </span>
                          </button>
                        ))}
                        {list.length > (isMonthView ? 3 : 6) ? (
                          <div className="cal-more">
                            +{list.length - (isMonthView ? 3 : 6)} more
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="cal-agendaCard">
              <div className="cal-agendaHead">
                <div className="cal-agendaTitleWrap">
                  <h3 className="cal-agendaTitle">Agenda</h3>
                  <div className="cal-agendaSub">
                    Scheduled items in this range
                  </div>
                </div>

                <div className="cal-agendaCount">
                  {agenda.length} item{agenda.length === 1 ? "" : "s"}
                </div>
              </div>

              {agenda.length === 0 ? (
                <div className="cal-empty">
                  <div className="cal-emptyTitle">No scheduled items yet</div>
                  <div className="cal-emptyText">
                    Click any day on the calendar to create your first schedule.
                  </div>
                </div>
              ) : (
                <div className="cal-agendaList">
                  {agenda.map((ev) => {
                    const d = new Date(ev.start_at);
                    return (
                      <button
                        key={ev.id}
                        className="cal-agendaItem"
                        onClick={() => openEdit(ev)}
                      >
                        <div
                          className={`cal-typeBadge cal-typeBadge--${ev.type || "live"}`}
                        >
                          {(ev.type || "live").toUpperCase()}
                        </div>
                        <div className="cal-agendaMain">
                          <div className="cal-agendaItemTitle">
                            {ev.title || "Untitled"}
                            {getSeriesId(ev) ? (
                              <span style={{ marginLeft: 8, opacity: 0.7 }}>
                                ↻
                              </span>
                            ) : null}
                          </div>
                          <div className="cal-agendaMeta">
                            {d.toLocaleString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {modalOpen ? (
        <div className="cal-modalOverlay" onMouseDown={closeModal}>
          <div
            className="cal-modal"
            style={modalCardStyle}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="cal-modalHead" style={modalHeadStyle}>
              <div style={{ padding: "18px 18px 14px" }}>
                <div className="cal-modalTitle">
                  {editing?.id ? "Edit schedule" : "New schedule"}
                </div>
                <div className="cal-muted">
                  {editing?.id
                    ? `ID: ${editing.id}`
                    : "Create a scheduled item for the calendar."}
                </div>
              </div>

              <button className="cal-x" onClick={closeModal} aria-label="Close">
                ✕
              </button>
            </div>

            <form
              className="cal-form"
              onSubmit={saveEvent}
              style={{ display: "flex", flexDirection: "column", minHeight: 0 }}
            >
              {/* Scrollable content */}
              <div style={modalBodyStyle}>
                <div className="cal-field">
                  <label>Title</label>
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, title: e.target.value }))
                    }
                    placeholder="e.g., Sunday Service Live"
                    autoFocus
                  />
                </div>

                <div className="cal-row2">
                  <div className="cal-field">
                    <label>Type</label>
                    <select
                      value={form.type}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, type: e.target.value }))
                      }
                    >
                      {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="cal-field">
                    <label>Start</label>
                    <input
                      type="datetime-local"
                      value={form.start_at}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, start_at: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="cal-row2">
                  <div className="cal-field">
                    <label>End (optional)</label>
                    <input
                      type="datetime-local"
                      value={form.end_at}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, end_at: e.target.value }))
                      }
                    />
                  </div>

                  <div className="cal-field">
                    <label>Link to video ID (optional)</label>
                    <input
                      value={form.video_id}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, video_id: e.target.value }))
                      }
                      placeholder="e.g., 123"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div className="cal-row2">
                  <div className="cal-field">
                    <label>Category ID (optional)</label>
                    <input
                      value={form.category_id}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, category_id: e.target.value }))
                      }
                      placeholder="e.g., 45"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="cal-field">
                    <label>Notes (optional)</label>
                    <input
                      value={form.notes}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, notes: e.target.value }))
                      }
                      placeholder="Internal notes for the team…"
                    />
                  </div>
                </div>

                {/* Repeat section */}
                {!editing?.id ? (
                  <div style={sectionCardStyle}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          whiteSpace: "nowrap",
                          margin: 0,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={repeatEnabled}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setRepeatEnabled(on);
                            if (on && form.start_at) {
                              setRepeatByWeekday((prev) =>
                                prev?.length
                                  ? prev
                                  : guessByWeekdayFromStart(form.start_at),
                              );
                            }
                          }}
                        />
                        <span style={{ fontWeight: 600 }}>Repeat schedule</span>
                      </label>

                      <span
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.60)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {repeatEnabled ? "On" : "Off"}
                      </span>
                    </div>

                    {repeatEnabled ? (
                      <>
                        {/* Modern interval (simple + modern) */}
                        <div style={{ marginTop: 14 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              marginBottom: 8,
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>Interval</div>
                            <div style={{ fontSize: 12, opacity: 0.65 }}>
                              {repeatSummary}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              flexWrap: "wrap",
                              padding: 12,
                              borderRadius: 14,
                              border: "1px solid rgba(255,255,255,0.10)",
                              background: "rgba(255,255,255,0.03)",
                            }}
                          >
                            <div style={{ fontSize: 13, opacity: 0.75 }}>
                              Every
                            </div>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,0.10)",
                                overflow: "hidden",
                                background: "rgba(0,0,0,0.25)",
                              }}
                            >
                              <button
                                type="button"
                                onClick={decInterval}
                                aria-label="Decrease interval"
                                style={{
                                  width: 40,
                                  height: 38,
                                  display: "grid",
                                  placeItems: "center",
                                  border: "none",
                                  background: "transparent",
                                  color: "rgba(255,255,255,0.9)",
                                  cursor: "pointer",
                                }}
                              >
                                −
                              </button>

                              <input
                                value={String(repeatInterval)}
                                onChange={(e) =>
                                  setRepeatInterval(
                                    Math.max(1, Number(e.target.value) || 1),
                                  )
                                }
                                inputMode="numeric"
                                style={{
                                  width: 54,
                                  height: 38,
                                  textAlign: "center",
                                  border: "none",
                                  outline: "none",
                                  background: "rgba(255,255,255,0.04)",
                                  color: "rgba(255,255,255,0.92)",
                                  fontWeight: 700,
                                }}
                              />

                              <button
                                type="button"
                                onClick={incInterval}
                                aria-label="Increase interval"
                                style={{
                                  width: 40,
                                  height: 38,
                                  display: "grid",
                                  placeItems: "center",
                                  border: "none",
                                  background: "transparent",
                                  color: "rgba(255,255,255,0.9)",
                                  cursor: "pointer",
                                }}
                              >
                                +
                              </button>
                            </div>

                            <select
                              value={repeatFreq}
                              onChange={(e) => setRepeatFreq(e.target.value)}
                              style={{
                                height: 38,
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,0.10)",
                                background: "rgba(0,0,0,0.25)",
                                color: "rgba(255,255,255,0.92)",
                                padding: "0 12px",
                                outline: "none",
                                cursor: "pointer",
                              }}
                            >
                              <option value="weekly">Weeks</option>
                              <option value="monthly">Months</option>
                            </select>

                            <div
                              style={{
                                marginLeft: "auto",
                                display: "flex",
                                gap: 10,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 6,
                                }}
                              >
                                <div style={{ fontSize: 12, opacity: 0.65 }}>
                                  Until (optional)
                                </div>
                                <input
                                  type="date"
                                  value={repeatUntil}
                                  onChange={(e) =>
                                    setRepeatUntil(e.target.value)
                                  }
                                  style={{
                                    height: 38,
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,0.10)",
                                    background: "rgba(0,0,0,0.25)",
                                    color: "rgba(255,255,255,0.92)",
                                    padding: "0 12px",
                                    outline: "none",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Repeat on - modern segmented grid */}
                        {repeatFreq === "weekly" ? (
                          <div style={{ marginTop: 14 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>
                              Repeat on
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(7, minmax(0, 1fr))",
                                gap: 8,
                                padding: 10,
                                borderRadius: 14,
                                border: "1px solid rgba(255,255,255,0.10)",
                                background: "rgba(255,255,255,0.03)",
                              }}
                            >
                              {DOW.map((d) => {
                                const on = repeatByWeekday.includes(d.key);

                                return (
                                  <button
                                    key={d.key}
                                    type="button"
                                    onClick={() => {
                                      setRepeatByWeekday((prev) => {
                                        const set = new Set(prev || []);
                                        if (set.has(d.key)) set.delete(d.key);
                                        else set.add(d.key);
                                        const next = Array.from(set);
                                        return next.length ? next : [d.key];
                                      });
                                    }}
                                    style={{
                                      height: 40,
                                      borderRadius: 12,
                                      border: on
                                        ? "1px solid rgba(154, 92, 255, 0.95)"
                                        : "1px solid rgba(255,255,255,0.10)",
                                      background: on
                                        ? "linear-gradient(135deg, rgba(154, 92, 255, 0.24), rgba(154, 92, 255, 0.10))"
                                        : "rgba(0,0,0,0.18)",
                                      color: "rgba(255,255,255,0.92)",
                                      fontWeight: 700,
                                      letterSpacing: 0.2,
                                      cursor: "pointer",
                                      boxShadow: on
                                        ? "0 10px 24px rgba(154, 92, 255, 0.18)"
                                        : "none",
                                      opacity: on ? 1 : 0.85,
                                      transition:
                                        "transform 120ms ease, opacity 120ms ease",
                                    }}
                                    onMouseDown={(e) =>
                                      (e.currentTarget.style.transform =
                                        "scale(0.98)")
                                    }
                                    onMouseUp={(e) =>
                                      (e.currentTarget.style.transform =
                                        "scale(1)")
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.transform =
                                        "scale(1)")
                                    }
                                    title={d.label}
                                  >
                                    {d.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}

                {/* Series scope controls */}
                {hasSeries ? (
                  <div style={sectionCardStyle}>
                    <div className="cal-field" style={{ marginBottom: 0 }}>
                      <label>Apply changes to</label>
                      <div
                        style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                      >
                        <button
                          type="button"
                          className={`cal-btn ${
                            editScope === "occurrence"
                              ? "cal-btn--primary"
                              : "cal-btn--ghost"
                          }`}
                          onClick={() => setEditScope("occurrence")}
                        >
                          This occurrence
                        </button>
                        <button
                          type="button"
                          className={`cal-btn ${
                            editScope === "series"
                              ? "cal-btn--primary"
                              : "cal-btn--ghost"
                          }`}
                          onClick={() => {
                            setEditScope("series");
                            setRepeatEnabled(true);
                            setRepeatFreq("weekly");
                            setRepeatByWeekday(
                              guessByWeekdayFromStart(form.start_at),
                            );
                            setRepeatInterval(1);
                          }}
                        >
                          Entire series
                        </button>
                      </div>

                      <div className="cal-muted" style={{ marginTop: 8 }}>
                        {editScope === "series"
                          ? "Saving updates the recurring rule + base fields."
                          : "Saving creates an exception (only this date changes)."}
                      </div>
                    </div>

                    {editScope === "series" ? (
                      <div style={{ marginTop: 14 }}>
                        <div className="cal-row2">
                          <div className="cal-field">
                            <label>Frequency</label>
                            <select
                              value={repeatFreq}
                              onChange={(e) => setRepeatFreq(e.target.value)}
                            >
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          </div>

                          <div className="cal-field">
                            <label>Until (optional)</label>
                            <input
                              type="date"
                              value={repeatUntil}
                              onChange={(e) => setRepeatUntil(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="cal-row2">
                          <div className="cal-field">
                            <label>Every</label>
                            <input
                              value={String(repeatInterval)}
                              onChange={(e) =>
                                setRepeatInterval(
                                  Math.max(1, Number(e.target.value) || 1),
                                )
                              }
                              inputMode="numeric"
                              placeholder="1"
                            />
                            <div className="cal-muted" style={{ marginTop: 6 }}>
                              Interval in{" "}
                              {repeatFreq === "monthly" ? "months" : "weeks"}.
                            </div>
                          </div>

                          <div className="cal-field">
                            {repeatFreq === "weekly" ? (
                              <>
                                <label>Repeat on</label>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    flexWrap: "wrap",
                                    marginTop: 6,
                                  }}
                                >
                                  {DOW.map((d) => {
                                    const on = repeatByWeekday.includes(d.key);
                                    return (
                                      <button
                                        key={d.key}
                                        type="button"
                                        onClick={() => {
                                          setRepeatByWeekday((prev) => {
                                            const set = new Set(prev || []);
                                            if (set.has(d.key))
                                              set.delete(d.key);
                                            else set.add(d.key);
                                            const next = Array.from(set);
                                            return next.length ? next : [d.key];
                                          });
                                        }}
                                        className="cal-btn cal-btn--ghost"
                                        style={{
                                          padding: "0 10px",
                                          height: 34,
                                          borderRadius: 999,
                                          opacity: on ? 1 : 0.75,
                                          border: on
                                            ? "1px solid rgba(154, 92, 255, 0.9)"
                                            : undefined,
                                        }}
                                      >
                                        {d.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div
                  className="cal-muted"
                  style={{ marginTop: 12, fontSize: 12 }}
                >
                  Tip: The bottom bar stays visible — scroll this modal to reach
                  all fields.
                </div>
              </div>

              {/* Sticky actions (always visible) */}
              <div style={modalFooterStyle}>
                <div className="cal-modalActions" style={{ margin: 0 }}>
                  {editing?.id ? (
                    <button
                      type="button"
                      className="cal-btn cal-btn--danger"
                      onClick={deleteEvent}
                      disabled={saving}
                    >
                      Delete
                    </button>
                  ) : (
                    <span />
                  )}

                  <div className="cal-actionsRight">
                    <button
                      type="button"
                      className="cal-btn cal-btn--ghost"
                      onClick={closeModal}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      className="cal-btn cal-btn--primary"
                      type="submit"
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
