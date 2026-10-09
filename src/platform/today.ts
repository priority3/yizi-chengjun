// The local calendar day as a number, YYYYMMDD (e.g. 20261009): the daily challenge's seed and the key of its record.
// The one place the game reads the date for gameplay; the simulation only ever sees the number.

/** `d`'s local date as YYYYMMDD. */
export function dayKey(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** Today's key, by the device's local date. */
export function todayKey(): number {
  return dayKey(new Date());
}
