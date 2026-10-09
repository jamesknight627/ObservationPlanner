export function formatDuration(ms) {
    if (ms == null) return '—';
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
}

// Approximates the IANA zone for a longitude as a fixed whole-hour UTC offset (one
// 15-degree slice per hour), so times can be shown in roughly the *observing location's*
// local time instead of the viewing device's own system timezone - which otherwise can
// be wildly different (e.g. picking an Australian location from a US-timezone device
// shows every rise/set/sunset time shifted by most of a day). This has no notion of
// real timezone/DST boundaries, so it can be off by up to an hour or so near a zone
// edge or during DST - acceptable for an observing-planning estimate, same tradeoff as
// the app's already-approximate ephemeris. `Etc/GMT` zones use an inverted sign
// (Etc/GMT-5 is UTC+5), and only support whole-hour, integer offsets from -14 to +12.
function timeZoneForLongitude(longitude) {
    if (typeof longitude !== 'number' || Number.isNaN(longitude)) return undefined;
    const offset = Math.max(-12, Math.min(14, Math.round(longitude / 15)));
    if (offset === 0) return 'Etc/GMT';
    return offset > 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
}

// `longitude` is the observing location's, not the viewer's - pass it whenever the date
// being shown is tied to a specific location (rise/set times, sun marks, scheduler bars)
// so the clock reads correctly there. Omit it (e.g. for a date with no location context)
// to fall back to the viewing device's own local time, same as before this existed.
export function formatTime(date, longitude) {
    return date ? date.toLocaleString(undefined, { timeZone: timeZoneForLongitude(longitude) }) : 'unknown';
}

// Just the clock time (e.g. "9:45 PM"), for compact labels like the scheduler's
// ruler ticks and bar labels where the full date would be redundant/too wide.
export function formatClockTime(date, longitude) {
    return date
        ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timeZoneForLongitude(longitude) })
        : '—';
}

// Formats RA as sexagesimal hr:min:sec.s (e.g. "05:35:17.2"). Rounds to the nearest
// tenth of a second first, rather than rounding h/m/s independently, so a value like
// 59.96s correctly carries over into the next minute instead of displaying as "60.0".
export function formatRaHours(raDeg) {
    if (raDeg == null) return '—';
    const totalSeconds = Math.round((raDeg / 15) * 3600 * 10) / 10;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${seconds.toFixed(1).padStart(4, '0')}`;
}

export function formatDecDegrees(decDeg) {
    if (decDeg == null) return '—';
    return `${decDeg.toFixed(2)}°`;
}

export function formatMagnitude(mag) {
    if (mag == null) return '—';
    return `${mag} mag`;
}

// Angular size is stored in arcminutes (the deep-sky dataset's r1 field is too). Planets
// are much smaller than 1′, so those are shown in arcseconds instead.
export function formatAngularSize(arcmin) {
    if (arcmin == null) return '—';
    if (arcmin < 1) return `${(arcmin * 60).toFixed(1)}″`;
    return `${Number(arcmin.toFixed(2))}′`;
}

// A dataset value with its unit, e.g. "142,984 km" or "24.79 m/s²".
export function formatQuantity(value, unit) {
    if (value == null) return '—';
    const number = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return unit ? `${number} ${unit}` : number;
}

export function formatAltitude(altDeg) {
    if (altDeg == null) return '—';
    return `${altDeg.toFixed(1)}°`;
}

export function formatCoords(location) {
    return `${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°`;
}

export function formatMagnification(power) {
    if (power == null) return '—';
    return `~${power}x`;
}

export function formatBortle(bortle) {
    if (bortle == null) return '—';
    return `Class ${bortle} or better`;
}
