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
