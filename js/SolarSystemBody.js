import { CelestialObject } from './CelestialObject.js';
import { SOLAR_SYSTEM_BODIES, AU_KM, getBodyPosition, matchBodyKey } from './ephemeris.js';
import { estimateEquipment, estimateMaxBortle, estimatePlanetMagnification } from './observingGuide.js';

// Pseudo-catalog code for solar-system bodies. Keeps favorites, detail links, and card
// data attributes working with the same catalog + ID pair deep-sky objects use
// (e.g. catalog "SOL", catalogId "jupiter").
export const SOLAR_SYSTEM_CATALOG = 'SOL';

// Field names in the datastro "donnees-systeme-solaire-solar-system-data" dataset.
// They combine the French and English column titles. If the dataset's schema ever
// changes, this is the only place that needs updating.
export const SOLAR_FIELDS = {
    name: 'planete_planet',
    diameterKm: 'diametre_diameter_km',
    averageDistanceMillionKm: 'distance_moyenne_average_distance_x10_6_km',
    gravity: 'gravite_gravity_m_s2',
    orbitalPeriodYears: 'periode_de_revolution_an_orbital_period_year',
    moons: 'nombre_de_satellites_number_of_satellites',
};

const RAD_TO_ARCMIN = (180 / Math.PI) * 60;

const numberOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

// A planet (or the Sun, or Pluto). Unlike a deep-sky object its position, brightness, and
// apparent size change from day to day, so they're computed from the date rather than read
// from the dataset. Everything else - rise/transit/set, "visible now", favorites - is
// inherited from CelestialObject unchanged.
export class SolarSystemBody extends CelestialObject {
    // Returns null for dataset records the app can't place in the sky (e.g. Earth).
    static fromRecord(record, date = new Date()) {
        const key = matchBodyKey(record?.[SOLAR_FIELDS.name]);
        return key ? new SolarSystemBody(record, key, date) : null;
    }

    constructor(record, bodyKey, date = new Date()) {
        super({});
        const info = SOLAR_SYSTEM_BODIES[bodyKey];
        this.bodyKey = bodyKey;
        this.catalog = SOLAR_SYSTEM_CATALOG;
        this.catalogId = bodyKey;
        this.properName = info.name;
        this.name = info.name;
        this.type = info.type;
        this.diameterKm = numberOrNull(record[SOLAR_FIELDS.diameterKm]) ?? info.diameterKm;
        this.raw = record;
        this.setEpoch(date);
    }

    get heading() {
        return this.name;
    }

    get cardTitle() {
        return this.name;
    }

    get isSun() {
        return this.bodyKey === 'sun';
    }

    // Snapshot of the date-dependent values that cards and detail panels display.
    setEpoch(date) {
        const position = getBodyPosition(this.bodyKey, date);
        this.raDeg = position.raDeg;
        this.decDeg = position.decDeg;
        this.distanceAu = position.distanceAu;
        this.magnitude = Math.round(position.magnitude * 10) / 10;
        const diameterRad = this.diameterKm / (position.distanceAu * AU_KM);
        this.angularSize = diameterRad * RAD_TO_ARCMIN; // rounded for display in format.js
    }

    getEquatorialCoords(time) {
        const { raDeg, decDeg } = getBodyPosition(this.bodyKey, time);
        return { raDeg, decDeg };
    }

    getPhysicalFacts() {
        const r = this.raw;
        return [
            { label: 'Distance from Earth', value: Math.round(this.distanceAu * AU_KM / 1e5) / 10, unit: 'million km' },
            { label: 'Diameter', value: this.diameterKm, unit: 'km' },
            { label: 'Surface gravity', value: numberOrNull(r[SOLAR_FIELDS.gravity]), unit: 'm/s²' },
            { label: 'Average distance from Sun', value: numberOrNull(r[SOLAR_FIELDS.averageDistanceMillionKm]), unit: 'million km' },
            { label: 'Orbital period', value: numberOrNull(r[SOLAR_FIELDS.orbitalPeriodYears]), unit: 'years' },
            { label: 'Known moons', value: numberOrNull(r[SOLAR_FIELDS.moons]), unit: '' },
        ].filter(fact => fact.value != null && !(this.isSun && fact.label === 'Average distance from Sun'));
    }

    getWikipediaCandidates() {
        return [SOLAR_SYSTEM_BODIES[this.bodyKey].wikiTitle];
    }

    getObservingGuide() {
        if (this.isSun) {
            return {
                constellationName: null,
                minMagnification: null,
                equipment: 'Certified solar filter only',
                maxBortle: null,
                warning: 'Never look at the Sun directly or through any optics without a certified solar filter - it causes permanent eye damage.',
            };
        }
        return {
            // Planets drift through the zodiac constellations, so there's no fixed answer.
            constellationName: 'Varies - moves along the zodiac',
            minMagnification: estimatePlanetMagnification(this.angularSize),
            equipment: estimateEquipment(this.magnitude),
            maxBortle: estimateMaxBortle(this.magnitude),
        };
    }
}
