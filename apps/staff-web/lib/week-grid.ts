import type { BookingRequest } from "@pylr/schemas";

/** Monday 00:00 of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun .. 6 = Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** The 7 calendar days (Mon–Sun) starting at `weekStart`. */
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/**
 * Buckets bookings by which day (index 0 = Monday .. 6 = Sunday) of
 * `weekStart`'s week their `startsAt` falls on — pure client-side grouping
 * over data the calendar endpoint already returns, no new API needed.
 * Bookings outside the week window are dropped.
 */
export function bucketByDay<T extends Pick<BookingRequest, "startsAt">>(bookings: T[], weekStart: Date): T[][] {
  const buckets: T[][] = Array.from({ length: 7 }, () => []);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  for (const b of bookings) {
    const start = new Date(b.startsAt);
    if (start < weekStart || start >= weekEnd) continue;
    const dayIndex = Math.floor((start.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
    buckets[dayIndex]?.push(b);
  }
  return buckets;
}
