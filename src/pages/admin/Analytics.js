import React, { useEffect, useState } from "react";
import api from "../../api";

export default function Analytics() {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      const { data } = await api.get("/analytics/summary?days=30");
      setData(data);
    })().catch(() => {});
  }, []);
  if (!data) return <div className="card">Loading…</div>;

  const max = Math.max(1, ...data.counts.map((c) => Number(c.n)));

  return (
    <div className="card">
      <h2>Analytics (last {data.days} days)</h2>
      <div style={{ margin: "6px 0 12px" }}>
        Watch hours: <strong>{data.watch_hours.toFixed(2)}</strong>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {data.counts.map((row) => {
          const width = Math.round((Number(row.n) / max) * 100);
          return (
            <div key={row.type}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{row.type}</strong>
                <span>{row.n}</span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "#eef2f7",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${width}%`,
                    height: "100%",
                    background: "#1677ff",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
