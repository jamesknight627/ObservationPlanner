export function formatDuration(ms) {
    if (ms == null) return '—';
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
}

export function formatTime(date) {
    return date ? date.toLocaleString() : 'unknown';
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

// The dataset's angular-size field (r1) is in arcminutes.
export function formatAngularSize(arcmin) {
    if (arcmin == null) return '—';
    return `${arcmin}′`;
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
