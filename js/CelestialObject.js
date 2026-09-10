import { lookupName } from './namedObjects.js';
import { getConstellationName } from './constellations.js';
import { estimateEquipment, estimateMaxBortle, estimateMinMagnification } from './observingGuide.js';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const SIDEREAL_DEG_PER_HOUR = 360.98564736629 / 24;

export class CelestialObject {
    constructor(record) {
        this.catalog = record.cat1 ?? null;
        this.catalogId = record.id1 ?? null;
        this.properName = record.name ?? lookupName(this.catalog, this.catalogId);
        this.name = this.properName ?? `${this.catalog ?? ''}${this.catalogId ?? ''}`;
        this.type = record.type ?? 'unknown';
        this.magnitude = record.mag ?? null;
        // The API's `ra` field is in hours (0-24), not degrees - convert (1h = 15°).
        this.raDeg = record.ra != null ? record.ra * 15 : null;
        this.decDeg = record.dec ?? null;
        this.angularSize = record.r1 ?? null;
        this.constellation = record.const && record.const !== '-' ? record.const : null;
        this.raw = record;
    }

    // Converts equatorial coords (RA/Dec) to horizontal coords (Alt/Az) for a given location and time.
    toAltAz(location, time) {
        const { latitude, longitude } = location;
        const lst = getLocalSiderealTime(longitude, time);
        const hourAngleDeg = lst - this.raDeg;

        const haRad = hourAngleDeg * DEG_TO_RAD;
        const decRad = this.decDeg * DEG_TO_RAD;
        const latRad = latitude * DEG_TO_RAD;

        const altRad = Math.asin(
            Math.sin(decRad) * Math.sin(latRad) +
            Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad)
        );

        const azRad = Math.atan2(
            -Math.sin(haRad),
            Math.cos(latRad) * Math.tan(decRad) - Math.sin(latRad) * Math.cos(haRad)
        );

        return {
            altitude: altRad * RAD_TO_DEG,
            azimuth: (azRad * RAD_TO_DEG + 360) % 360,
        };
    }

    isVisibleAt(location, time) {
        if (this.raDeg == null || this.decDeg == null) return false;
        const { altitude } = this.toAltAz(location, time);
        return altitude > 0;
    }

    // Steps forward in 5-minute increments over the next 48h to find the next moment this object rises above the horizon.
    getNextRiseTime(location, from = new Date()) {
        const stepMs = 5 * 60 * 1000;
        const maxSteps = (48 * 60) / 5;

        let wasVisible = this.isVisibleAt(location, from);
        let t = new Date(from);

        for (let i = 0; i < maxSteps; i++) {
            t = new Date(t.getTime() + stepMs);
            const isVisible = this.isVisibleAt(location, t);
            if (isVisible && !wasVisible) return t;
            wasVisible = isVisible;
        }
        return null;
    }

    // Time of the object's next meridian crossing (max altitude / "apex"), solved directly
    // from hour angle = 0 rather than stepping, since the sky rotates at a near-constant rate.
    getNextTransitTime(location, from = new Date()) {
        if (this.raDeg == null) return null;
        const lst = getLocalSiderealTime(location.longitude, from);
        const deltaDeg = (this.raDeg - lst + 360) % 360;
        const hoursUntilTransit = deltaDeg / SIDEREAL_DEG_PER_HOUR;
        return new Date(from.getTime() + hoursUntilTransit * 3600 * 1000);
    }

    // Altitude reached at the object's next meridian transit - its highest point in the
    // sky for that pass. At transit, altitude = 90° - |latitude - declination|, but it's
    // simpler (and reuses the same math) to just evaluate toAltAz at the transit moment.
    getMaxAltitude(location, from = new Date()) {
        const transitTime = this.getNextTransitTime(location, from);
        if (!transitTime) return null;
        return this.toAltAz(location, transitTime).altitude;
    }

    // Rise, transit ("apex"), set, and peak altitude for the object's next pass above the
    // horizon. Set time is derived from rise/transit rather than stepped separately: the
    // altitude curve is symmetric around the meridian, so time-to-transit-from-rise equals
    // time-from-transit-to-set.
    getVisibilityWindow(location, from = new Date()) {
        const riseTime = this.getNextRiseTime(location, from);
        // Anchored to riseTime, not `from`: if the object is currently already up, getNextRiseTime
        // skips ahead to the *next* rise, and the transit belonging to that same pass must be
        // searched from there too - otherwise this can return today's leftover transit, which
        // lands before the skipped-ahead rise and produces a negative duration.
        const transitTime = riseTime ? this.getNextTransitTime(location, riseTime) : null;
        const setTime = riseTime && transitTime
            ? new Date(transitTime.getTime() + (transitTime.getTime() - riseTime.getTime()))
            : null;
        const durationMs = riseTime && setTime ? setTime.getTime() - riseTime.getTime() : null;
        const maxAltitudeDeg = transitTime ? this.toAltAz(location, transitTime).altitude : null;

        return { riseTime, transitTime, setTime, durationMs, maxAltitudeDeg };
    }

    // Beginner-facing observing recommendations. Magnitude and angular size are the only
    // signals available, so these are heuristic estimates, not authoritative data - see
    // observingGuide.js for the reasoning behind each one.
    getObservingGuide() {
        return {
            constellationName: getConstellationName(this.constellation),
            minMagnification: estimateMinMagnification(this.angularSize),
            equipment: estimateEquipment(this.magnitude),
            maxBortle: estimateMaxBortle(this.magnitude),
        };
    }
}

function getLocalSiderealTime(longitude, time) {
    const JD = time.getTime() / 86400000 + 2440587.5;
    const T = (JD - 2451545.0) / 36525;
    let gst = 280.46061837 + 360.98564736629 * (JD - 2451545.0) + 0.000387933 * T ** 2;
    gst = ((gst % 360) + 360) % 360;
    return (gst + longitude + 360) % 360;
}
