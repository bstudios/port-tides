import { DateTime } from "luxon";
import type { TidesJson_ScheduleObject } from "./types";

export interface NextHighTide {
  hours: number;
  minutes: number;
  time: string;
  height: string;
}

/**
 * Finds the first high tide after `now`, expecting `days` in chronological
 * order. Times in the schedule are Europe/London wall-clock, so they are parsed
 * in that zone rather than being parsed loose and converted.
 *
 * Shared by the homepage loader and the browser, so the countdown can be
 * recomputed client side without re-deriving how a "next" tide is picked.
 * Returns null when every tide in `days` is already in the past.
 */
export const findNextHighTide = (
  days: Array<TidesJson_ScheduleObject>,
  now: DateTime = DateTime.now().setZone("Europe/London")
): NextHighTide | null => {
  for (const day of days) {
    for (const tide of day.groups) {
      const time = DateTime.fromSQL(day.date + " " + tide.time, {
        zone: "Europe/London",
      });
      if (time <= now) continue;
      const diff = time.diff(now, ["hours", "minutes"]);
      return {
        hours: Math.floor(diff.hours),
        minutes: Math.floor(diff.minutes),
        time: time.toFormat("HH:mm"),
        height: tide.height,
      };
    }
  }
  return null;
};
