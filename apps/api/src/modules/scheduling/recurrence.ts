import { BadRequestException } from "@nestjs/common";
import { RRule } from "rrule";

/**
 * Computes the next `count` occurrence timestamps for a service, from its
 * iCal RRULE string and "HH:MM" default time.
 *
 * Deliberately simple, per the Phase 1 scope note in docs/ARCHITECTURE.md
 * ("scope recurrence to simple weekly/biweekly patterns first; DST/holiday
 * edge cases are a fast-follow"): the time-of-day is treated as UTC rather
 * than resolved against the organization's IANA timezone, so a service
 * whose org isn't in UTC will land on the wrong wall-clock hour until that
 * follow-up work lands. Simple weekly/biweekly `FREQ` patterns are exactly
 * what this is exercised against; more exotic RRULE features are untested.
 */
export function computeUpcomingOccurrences(
  recurrenceRule: string,
  defaultTime: string,
  count: number,
  from: Date = new Date(),
): Date[] {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(defaultTime);
  if (!match) throw new BadRequestException(`Invalid defaultTime "${defaultTime}"`);
  const [, hh, mm] = match;

  const dtstart = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), Number(hh), Number(mm)),
  );

  let parsed: ReturnType<typeof RRule.parseString>;
  try {
    parsed = RRule.parseString(recurrenceRule);
  } catch {
    throw new BadRequestException(`Invalid recurrence rule "${recurrenceRule}"`);
  }

  const rule = new RRule({ ...parsed, dtstart });
  // rule.all() requires the iterator form (a plain count isn't accepted)
  // to bound an otherwise-infinite recurrence.
  return rule.all((_date, i) => i < count);
}
