// src/pages/admin/Analytics.js
//
// Analytics (redesigned in the dashboard's style). Viewing activity of signed-in
// members: KPI cards with trends versus the previous period, real daily charts
// (the old "Activity" chart invented three points from the total), live
// activity, event breakdown and top videos.

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import { AreaChart, Bars, Kpi, trend } from "../../components/admin/MiniCharts";
import "./DashboardModern.css";
import "./AnalyticsModern.css";

const PERIODS = [7, 30, 90];
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (n) => num(n).toLocaleString("en-US");
function duration(sec) {
  const s = Math.round(num(sec));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}
const EVENT_LABELS = {
  video_play: "Plays",
  video_progress: "Progress pings",
  video_complete: "Completions",
  page_open: "Page opens",
  page_leave: "Page leaves",
};

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(null);
  const [liveErr, setLiveErr] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    api
      .get(`/analytics/summary?days=${days}&ping_seconds=15`)
      .then((res) => alive && setData(res.data))
      .catch(
        (e) =>
          alive &&
          setErr(
            e?.response?.status === 403
              ? "Analytics is available to administrators."
              : "Analytics could not be loaded.",
          ),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [days]);

  useEffect(() => {
    let alive = true;
    const loadLive = async () => {
      try {
        const res = await api.get(`/analytics/live?minutes=10&_=${Date.now()}`);
        if (alive) {
          setLive(res.data || null);
          setLiveErr("");
        }
      } catch {
        if (alive) setLiveErr("Live activity unavailable.");
      }
    };
    loadLive();
    const t = setInterval(loadLive, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const t = data?.totals || {};
  const prev = data?.previous || null;
  const daily = useMemo(
    () => (Array.isArray(data?.daily) ? data.daily : []),
    [data],
  );
  const playsSeries = daily.map((d) => ({ day: d.day, n: d.plays }));
  const watchSeries = daily.map((d) => ({
    day: d.day,
    n: Math.round(num(d.watch_seconds) / 60),
  }));
  const counts = Array.isArray(data?.counts) ? data.counts : [];
  const countMax = Math.max(1, ...counts.map((c) => num(c.n)));
  const top = Array.isArray(data?.top_videos) ? data.top_videos : [];
  const topMax = Math.max(1, ...top.map((v) => num(v.watch_seconds)));
  const prevRate =
    prev && prev.plays
      ? Math.round((prev.completions / prev.plays) * 100)
      : null;

  return (
    <main className="dm-page an-page">
      <header className="dm-head">
        <div>
          <nav className="dm-crumbs" aria-label="Breadcrumb">
            <span>Home</span> <span aria-hidden="true">›</span>{" "}
            <span aria-current="page">Analytics</span>
          </nav>
          <h1>Analytics</h1>
          <p className="dm-subtitle">
            Viewing by signed-in members — last {days} days compared with the{" "}
            {days} before.
          </p>
        </div>
        <div className="dm-headTools">
          <div className="an-seg" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={days === p}
                className={days === p ? "is-on" : ""}
                onClick={() => setDays(p)}
              >
                {p}D
              </button>
            ))}
          </div>
        </div>
      </header>

      {err ? (
        <p className="dm-alert" role="alert">
          {err}
        </p>
      ) : null}
      {loading && !data ? (
        <p className="dm-muted" role="status">
          Loading analytics…
        </p>
      ) : null}

      {data && !err ? (
        <>
          <div className="dm-kpis an-kpis" aria-busy={loading}>
            <Kpi
              title="Plays"
              accent="violet"
              value={fmt(t.plays)}
              sub={
                prev
                  ? `${fmt(prev.plays)} the period before`
                  : "Unique per member, video and day"
              }
              tr={prev ? trend(t.plays, prev.plays) : null}
              spark={daily.map((d) => d.plays)}
              sparkLabel="Plays per day"
            />
            <Kpi
              title="Viewers"
              accent="teal"
              value={fmt(t.unique_viewers)}
              sub="Signed-in members"
              tr={prev ? trend(t.unique_viewers, prev.unique_viewers) : null}
              spark={daily.map((d) => d.viewers)}
              sparkLabel="Viewers per day"
            />
            <Kpi
              title="Watch time"
              accent="blue"
              value={duration(data.watch_seconds)}
              sub={`${num(data.watch_hours).toFixed(1)} hours (estimated)`}
              tr={prev ? trend(data.watch_seconds, prev.watch_seconds) : null}
              spark={daily.map((d) => d.watch_seconds)}
              sparkLabel="Watch time per day"
            />
            <Kpi
              title="Completion rate"
              accent="amber"
              value={`${num(t.completion_rate)}%`}
              sub={`${fmt(t.completions)} completions`}
              tr={prevRate !== null ? trend(t.completion_rate, prevRate) : null}
            />
            <Kpi
              title="Avg watch / play"
              accent="violet"
              value={duration(t.avg_watch_seconds_per_play)}
              sub="Average engagement per start"
            />
          </div>

          <div className="dm-row">
            <section className="dm-card dm-span2" aria-labelledby="an-plays">
              <div className="dm-cardHead">
                <h2 id="an-plays">Plays per day</h2>
                <span className="dm-muted">
                  {fmt(t.plays)} in {days} days
                </span>
              </div>
              {daily.length ? (
                <AreaChart series={playsSeries} label="Plays per day" />
              ) : (
                <p className="dm-muted">No viewing data yet.</p>
              )}
            </section>
            <section className="dm-card an-live" aria-labelledby="an-live">
              <div className="dm-cardHead">
                <h2 id="an-live">
                  <span className="an-pulse" aria-hidden="true" /> Live now
                </h2>
                <span className="dm-muted">
                  last {num(live?.minutes) || 10} min
                </span>
              </div>
              {liveErr ? <p className="dm-muted">{liveErr}</p> : null}
              <dl className="an-liveGrid" aria-live="polite">
                <div>
                  <dt>Watching pages</dt>
                  <dd>{fmt(live?.live_open)}</dd>
                </div>
                <div>
                  <dt>Watching videos</dt>
                  <dd>{fmt(live?.live_progress)}</dd>
                </div>
                <div>
                  <dt>Left recently</dt>
                  <dd>{fmt(live?.live_leave)}</dd>
                </div>
              </dl>
              <p className="dm-muted">Updates every 5 seconds.</p>
            </section>
          </div>

          <div className="dm-row">
            <section className="dm-card dm-span2" aria-labelledby="an-watch">
              <div className="dm-cardHead">
                <h2 id="an-watch">Watch time per day</h2>
                <span className="dm-muted">minutes</span>
              </div>
              {daily.length ? (
                <Bars
                  series={watchSeries}
                  label="Watch minutes per day"
                  format={(v) => `${fmt(v)} min`}
                />
              ) : (
                <p className="dm-muted">No viewing data yet.</p>
              )}
            </section>
            <section className="dm-card" aria-labelledby="an-events">
              <div className="dm-cardHead">
                <h2 id="an-events">Events</h2>
                <span className="dm-muted">{days} days</span>
              </div>
              {counts.length ? (
                <ul className="dm-catList">
                  {counts.map((c) => (
                    <li key={c.type}>
                      <span className="dm-catName">
                        {EVENT_LABELS[c.type] || c.type}
                      </span>
                      <span className="dm-catBar" aria-hidden="true">
                        <span
                          style={{ width: `${(num(c.n) / countMax) * 100}%` }}
                        />
                      </span>
                      <span className="dm-catNum">{fmt(c.n)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dm-muted">No events yet.</p>
              )}
            </section>
          </div>

          <section className="dm-card" aria-labelledby="an-top">
            <div className="dm-cardHead">
              <h2 id="an-top">Top videos</h2>
              <span className="dm-muted">Ranked by watch time</span>
            </div>
            {top.length ? (
              <div className="dm-tableWrap">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Video</th>
                      <th scope="col">Plays</th>
                      <th scope="col">Viewers</th>
                      <th scope="col">Watch time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((v, i) => (
                      <tr key={v.video_id || i}>
                        <td className="an-rank">{i + 1}</td>
                        <td>
                          <span className="dm-vid">
                            {v.thumbnail_url ? (
                              <img
                                src={v.thumbnail_url}
                                alt=""
                                loading="lazy"
                              />
                            ) : (
                              <span className="dm-noThumb" aria-hidden="true">
                                No image
                              </span>
                            )}
                            {v.video_id ? (
                              <Link
                                to={`/admin/content/videos/${v.video_id}`}
                                className="an-vlink"
                              >
                                {v.title || `Video #${v.video_id}`}
                              </Link>
                            ) : (
                              <span>{v.title || "Unknown video"}</span>
                            )}
                          </span>
                        </td>
                        <td>{fmt(v.plays)}</td>
                        <td>{fmt(v.unique_viewers)}</td>
                        <td>
                          <span className="an-share">
                            <span className="dm-catBar" aria-hidden="true">
                              <span
                                style={{
                                  width: `${(num(v.watch_seconds) / topMax) * 100}%`,
                                }}
                              />
                            </span>
                            {duration(v.watch_seconds)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="dm-muted">No video analytics yet.</p>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
