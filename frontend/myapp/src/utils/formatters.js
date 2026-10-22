/**
 * Format a number as currency with two decimals.
 */
export const formatCurrency = (amount) => {
  const n = Number(amount) || 0;
  return `$${n.toFixed(2)}`;
};

/**
 * "2025-01-15T..." → "15 Jan 2025"
 */
export const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * "2025-01-15T14:30:00Z" → "15 Jan 2025, 14:30"
 */
export const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Human-friendly relative time. Good for recent activity lists.
 */
export const timeAgo = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
};