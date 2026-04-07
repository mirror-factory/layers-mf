import { Cron } from "croner";

/**
 * Validate a cron expression. Returns true if parseable by croner.
 */
export function isValidCron(expression: string): boolean {
  try {
    new Cron(expression);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate the next run time from a cron expression.
 * Returns an ISO string or null if the expression is invalid.
 */
export function calculateNextCron(expression: string): string | null {
  try {
    const job = new Cron(expression);
    const next = job.nextRun();
    return next ? next.toISOString() : null;
  } catch {
    return null;
  }
}

/**
 * Convert a cron expression to a human-readable description.
 */
export function cronToHuman(expression: string): string {
  if (expression.startsWith("once:")) {
    const date = new Date(expression.replace("once:", ""));
    return `Once at ${date.toLocaleString()}`;
  }

  const parts = expression.split(" ");
  if (parts.length !== 5) return expression;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const dayNames: Record<string, string> = {
    "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed",
    "4": "Thu", "5": "Fri", "6": "Sat", "7": "Sun",
  };

  const formatTime = (h: string, m: string) => {
    const hr = parseInt(h, 10);
    const mn = m.padStart(2, "0");
    if (hr === 0) return `12:${mn} AM`;
    if (hr < 12) return `${hr}:${mn} AM`;
    if (hr === 12) return `12:${mn} PM`;
    return `${hr - 12}:${mn} PM`;
  };

  // Every minute
  if (minute === "*" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "Every minute";
  }

  // Hourly
  if (minute !== "*" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Every hour at :${minute.padStart(2, "0")}`;
  }

  // Daily
  if (minute !== "*" && hour !== "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Daily at ${formatTime(hour, minute)}`;
  }

  // Weekdays
  if (minute !== "*" && hour !== "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "1-5") {
    return `Weekdays at ${formatTime(hour, minute)}`;
  }

  // Specific days
  if (minute !== "*" && hour !== "*" && dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    const days = dayOfWeek.split(",").map((d) => dayNames[d] ?? d).join(", ");
    return `${days} at ${formatTime(hour, minute)}`;
  }

  // Weekly (day of week specified, specific time)
  if (minute !== "*" && hour !== "*" && dayOfMonth === "*" && month === "*") {
    return `Weekly at ${formatTime(hour, minute)}`;
  }

  return expression;
}
