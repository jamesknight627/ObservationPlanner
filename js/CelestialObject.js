import { lookupName } from './namedObjects.js';
import { getConstellationName } from './constellations.js';
import { estimateEquipment, estimateMaxBortle, estimateMinMagnification } from './observingGuide.js';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const SIDEREAL_DEG_PER_HOUR = 360.98564736629 / 24;
const MS_PER_HOUR = 3600 * 1000;

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

    // Heading shown on the detail panel / object page (e.g. "M 31").
    get heading() {
        return `${this.catalog ?? ''} ${this.catalogId ?? ''}`;
    }

    // Title shown on result cards (e.g. "Andromeda Galaxy (M31)").
    get cardTitle() {
        const catalogLabel = `${this.catalog ?? ''}${this.catalogId ?? ''}`;
        return this.properName ? `${this.properName} (${catalogLabel})` : catalogLabel;
    }

    // RA/Dec at a given moment. Deep-sky objects are fixed, so `time` is ignored here;
    // SolarSystemBody overrides this to compute a moving position. All the visibility
    // math below goes through this method, so it works for both kinds of object.
    getEquatorialCoords(time) {
        if (this.raDeg == null || this.decDeg == null) return null;
        return { raDeg: this.raDeg, decDeg: this.decDeg };
    }

    // Hook for objects whose displayed values (magnitude, size, RA/Dec) depend on the date.
    // Fixed deep-sky objects have nothing to update.
    setEpoch(date) {}

    // Extra dataset facts to show on the detail views, as [{ label, value, unit }].
    getPhysicalFacts() {
        return [];
    }

    // Wikipedia article titles to try, in order: the proper name, then catalog-specific
    // naming conventions ("Messier 31", "NGC 224").
    getWikipediaCandidates() {
        const candidates = [];
        if (this.properName) candidates.push(this.properName);
        if (this.catalog === 'M' && this.catalogId != null) {
            candidates.push(`Messier ${this.catalogId}`);
        }
        if (this.catalog && this.catalogId != null) {
            candidates.push(`${this.catalog} ${this.catalogId}`);
        }
        return candidates;
    }

    // Converts equatorial coords (RA/Dec) to horizontal coords (Alt/Az) for a given location and time.
    toAltAz(location, time) {
        const coords = this.getEquatorialCoords(time);
        if (!coords) return null;
        const { latitude, longitude } = location;
        const lst = getLocalSiderealTime(longitude, time);
        const hourAngleDeg = lst - coords.raDeg;

        const haRad = hourAngleDeg * DEG_TO_RAD;
        const decRad = coords.decDeg * DEG_TO_RAD;
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
        const altAz = this.toAltAz(location, time);
        return altAz != null && altAz.altitude > 0;
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
    // A planet's RA drifts slightly during the wait, so the estimate is then refined against
    // the RA at the estimated moment; for fixed objects the correction is zero.
    getNextTransitTime(location, from = new Date()) {
        const start = this.getEquatorialCoords(from);
        if (!start) return null;
        const lst0 = getLocalSiderealTime(location.longitude, from);
        const deltaDeg = (start.raDeg - lst0 + 360) % 360;
        let t = new Date(from.getTime() + (deltaDeg / SIDEREAL_DEG_PER_HOUR) * MS_PER_HOUR);

        for (let i = 0; i < 4; i++) {
            const { raDeg } = this.getEquatorialCoords(t);
            const lst = getLocalSiderealTime(location.longitude, t);
            const offsetDeg = ((raDeg - lst + 540) % 360) - 180; // signed, in [-180, 180)
            t = new Date(t.getTime() + (offsetDeg / SIDEREAL_DEG_PER_HOUR) * MS_PER_HOUR);
            // Refinement can nudge a transit that was due right at `from` to just before it;
            // in that case the next transit is the following one.
            if (t < from) t = new Date(t.getTime() + (360 / SIDEREAL_DEG_PER_HOUR) * MS_PER_HOUR);
            if (Math.abs(offsetDeg) < 0.001) break;
        }
        return t;
    }

    // Altitude reached at the object's next meridian transit - its highest point in the
    // sky for that pass. At transit, altitude = 90° - |latitude - declination|, but it's
    // simpler (and reuses the same math) to just evaluate toAltAz at the transit moment.
    getMaxAltitude(location, from = new Date()) {
        const transitTime = this.getNextTransitTime(location, from);
        if (!transitTime) return null;
        return this.toAltAz(location, transitTime)?.altitude ?? null;
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
        const maxAltitudeDeg = transitTime ? this.toAltAz(location, transitTime)?.altitude ?? null : null;

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
