import { fetchObjectsByCatalogId, fetchSolarSystemRecords } from './api.js';
import { CelestialObject } from './CelestialObject.js';
import { SolarSystemBody, SOLAR_SYSTEM_CATALOG } from './SolarSystemBody.js';

// Builds the right kind of object for each dataset, so the pages don't need to know
// which class goes with which catalog.

export function isSolarSystemCatalog(catalog) {
    return catalog === SOLAR_SYSTEM_CATALOG;
}

// All solar-system bodies the app can place in the sky, positioned for `date`.
export async function fetchSolarSystemBodies(date) {
    const records = await fetchSolarSystemRecords();
    return records.map(record => SolarSystemBody.fromRecord(record, date)).filter(Boolean);
}

// Looks up a single object by catalog + ID from whichever dataset it belongs to.
export async function fetchObject(catalog, catalogId, date) {
    if (isSolarSystemCatalog(catalog)) {
        const bodies = await fetchSolarSystemBodies(date);
        return bodies.find(body => body.catalogId === catalogId) ?? null;
    }
    const record = await fetchObjectsByCatalogId(catalog, catalogId);
    return record ? new CelestialObject(record) : null;
}

// Rebuilds an object from a saved favorite (localStorage keeps the plain JSON).
export function objectFromFavorite(favorite, date) {
    if (isSolarSystemCatalog(favorite.catalog)) {
        return SolarSystemBody.fromRecord(favorite.raw, date);
    }
    return new CelestialObject(favorite.raw);
}
