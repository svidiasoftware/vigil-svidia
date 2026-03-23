import { cn } from "@/lib/utils";
import { getSeverityConfig } from "@/lib/utils/severity";

export function SeverityBadge({
  severity,
  className,
}: {
  severity: number;
  className?: string;
}) {
  const config = getSeverityConfig(severity);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        config.bg,
        config.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
