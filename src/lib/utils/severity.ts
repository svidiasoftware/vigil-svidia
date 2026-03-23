export const SEVERITY_CONFIG = {
  0: { label: "Normal", color: "slate", bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500/30", dot: "bg-slate-400" },
  1: { label: "Info", color: "blue", bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30", dot: "bg-blue-400" },
  2: { label: "Low", color: "yellow", bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30", dot: "bg-yellow-400" },
  3: { label: "Medium", color: "orange", bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30", dot: "bg-orange-400" },
  4: { label: "High", color: "red", bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30", dot: "bg-red-400" },
  5: { label: "Critical", color: "red", bg: "bg-red-600/30", text: "text-red-300", border: "border-red-500/50", dot: "bg-red-500 animate-pulse" },
} as const;

export type SeverityNum = keyof typeof SEVERITY_CONFIG;

export function getSeverityConfig(num: number) {
  return SEVERITY_CONFIG[(num >= 0 && num <= 5 ? num : 0) as SeverityNum];
}

export function getSeverityLabel(num: number) {
  return getSeverityConfig(num).label;
}
