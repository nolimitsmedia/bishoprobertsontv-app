// src/utils/time.js
export function formatHoursToHM(hoursFloat) {
  let h = Number(hoursFloat || 0);
  if (!Number.isFinite(h) || h < 0) h = 0;

  // Round to the nearest minute so very short streams don't show 0
  const totalMin = Math.max(0, Math.round(h * 60));
  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;

  const hrLabel = `${hr} hr${hr === 1 ? "" : "s"}`;
  const minLabel = `${min} min${min === 1 ? "" : "s"}`;

  return {
    hr,
    min,
    totalMin,
    label: `${hrLabel} ${minLabel}`,
    hrLabel,
    minLabel,
  };
}
