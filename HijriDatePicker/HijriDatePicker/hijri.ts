// Umm al-Qura Hijri calendar helpers built on the browser's Intl (ICU) calendar data.

export interface HijriDate {
    year: number;
    month: number; // 1-12
    day: number;
}

export const MIN_YEAR = 1300;
export const MAX_YEAR = 1500;

const DAY_MS = 86400000;
// Approximate Gregorian date of 1 Muharram 1 AH and mean synodic month length, used only as a search start
const EPOCH_MS = Date.UTC(622, 6, 16, 12);
const MEAN_MONTH_DAYS = 29.530588853;

const formatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
});

const monthStartCache = new Map<number, number>();

/** False when the browser's Intl silently falls back to another calendar. */
export function isUmmAlQuraSupported(): boolean {
    return formatter.resolvedOptions().calendar === "islamic-umalqura";
}

/** Converts a Gregorian date (UTC milliseconds) to Hijri. */
export function toHijri(utcMs: number): HijriDate {
    const result: HijriDate = { year: 0, month: 0, day: 0 };
    for (const part of formatter.formatToParts(new Date(utcMs))) {
        if (part.type === "year") {
            result.year = parseInt(part.value, 10);
        } else if (part.type === "month") {
            result.month = parseInt(part.value, 10);
        } else if (part.type === "day") {
            result.day = parseInt(part.value, 10);
        }
    }
    return result;
}

function compare(a: HijriDate, b: HijriDate): number {
    return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** Returns UTC noon (ms) of the Gregorian day matching the first day of the given Hijri month. */
function monthStart(year: number, month: number): number {
    const key = year * 100 + month;
    const cached = monthStartCache.get(key);
    if (cached !== undefined) {
        return cached;
    }
    const target: HijriDate = { year, month, day: 1 };
    const monthsSinceEpoch = (year - 1) * 12 + (month - 1);
    let ms = EPOCH_MS + Math.round(monthsSinceEpoch * MEAN_MONTH_DAYS) * DAY_MS;
    let current = toHijri(ms);
    // Jump by the day difference first, then walk single days to land exactly on day 1
    for (let i = 0; i < 10 && current.year === year && current.month === month && current.day !== 1; i++) {
        ms -= (current.day - 1) * DAY_MS;
        current = toHijri(ms);
    }
    let guard = 0;
    while (compare(current, target) !== 0 && guard++ < 120) {
        ms += (compare(current, target) < 0 ? 1 : -1) * DAY_MS;
        current = toHijri(ms);
    }
    monthStartCache.set(key, ms);
    return ms;
}

/** Converts a Hijri date to Gregorian (UTC noon, milliseconds). */
export function toGregorian(date: HijriDate): number {
    return monthStart(date.year, date.month) + (date.day - 1) * DAY_MS;
}

export function daysInMonth(year: number, month: number): number {
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return Math.round((monthStart(nextYear, nextMonth) - monthStart(year, month)) / DAY_MS);
}

/** Today's Hijri date based on the user's local calendar day. */
export function todayHijri(): HijriDate {
    const now = new Date();
    return toHijri(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12));
}

function pad(n: number, width: number): string {
    let s = String(n);
    while (s.length < width) {
        s = "0" + s;
    }
    return s;
}

/** Formats as dd/MM/yyyy with Latin digits (the stored value). */
export function formatHijri(date: HijriDate): string {
    return `${pad(date.day, 2)}/${pad(date.month, 2)}/${pad(date.year, 4)}`;
}

/** Converts Arabic-Indic and Persian digits to Latin digits. */
function normalizeDigits(text: string): string {
    return text.replace(/[٠-٩۰-۹]/g, (ch) => {
        const code = ch.charCodeAt(0);
        return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    });
}

/** Parses d/M/yyyy (also accepts - or . separators and Arabic digits). Returns null when invalid. */
export function parseHijri(text: string | null | undefined): HijriDate | null {
    if (!text) {
        return null;
    }
    const match = /^\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})\s*$/.exec(normalizeDigits(text));
    if (!match) {
        return null;
    }
    const date: HijriDate = { day: parseInt(match[1], 10), month: parseInt(match[2], 10), year: parseInt(match[3], 10) };
    if (date.year < MIN_YEAR || date.year > MAX_YEAR || date.month < 1 || date.month > 12 || date.day < 1) {
        return null;
    }
    if (date.day > daysInMonth(date.year, date.month)) {
        return null;
    }
    return date;
}

export function isSameDate(a: HijriDate | null, b: HijriDate | null): boolean {
    return !!a && !!b && compare(a, b) === 0;
}
