import { format, formatDistanceToNow } from "date-fns";

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatTimestamp(date: string | Date) {
  return format(new Date(date), "MMM d, yyyy HH:mm:ss");
}

export function formatShort(date: string | Date) {
  return format(new Date(date), "MMM d HH:mm");
}

function shiftByOffset(utcIso: string, offsetMinutes: number) {
  return new Date(new Date(utcIso).getTime() + offsetMinutes * 60_000);
}

function formatUTC(d: Date, pattern: "short" | "full") {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mon = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return pattern === "full"
    ? `${mon} ${day}, ${year} ${hh}:${mm}:${ss}`
    : `${mon} ${day} ${hh}:${mm}`;
}

export function offsetLabel(offsetMinutes: number) {
  if (offsetMinutes === 0) return "UTC";
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${h}:${m}`;
}

export function formatLocalShort(utcIso: string, offsetMinutes: number) {
  const shifted = shiftByOffset(utcIso, offsetMinutes);
  return `${formatUTC(shifted, "short")} ${offsetLabel(offsetMinutes)}`;
}

export function formatLocalFull(utcIso: string, offsetMinutes: number) {
  const shifted = shiftByOffset(utcIso, offsetMinutes);
  return `${formatUTC(shifted, "full")} ${offsetLabel(offsetMinutes)}`;
}
