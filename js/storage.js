const FAVORITES_KEY = 'astro-planner:favorites';
const LOCATION_KEY = 'astro-planner:last-location';
const DATE_KEY = 'astro-planner:last-date';
const PLAN_OVERRIDES_KEY = 'astro-planner:plan-overrides';
const FONT_SCALE_KEY = 'astro-planner:font-scale';

export function getFavorites() {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
}

export function isFavorite(catalog, catalogId) {
    return getFavorites().some(f => f.catalog === catalog && f.catalogId === catalogId);
}

export function addFavorite(record) {
    const favorites = getFavorites();
    if (!isFavorite(record.catalog, record.catalogId)) {
        favorites.push(record);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    }
}

export function removeFavorite(catalog, catalogId) {
    const favorites = getFavorites().filter(
        f => !(f.catalog === catalog && f.catalogId === catalogId)
    );
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export function getLastLocation() {
    const raw = localStorage.getItem(LOCATION_KEY);
    return raw ? JSON.parse(raw) : null;
}

export function setLastLocation(location) {
    localStorage.setItem(LOCATION_KEY, JSON.stringify(location));
}

export function getLastDate() {
    const raw = localStorage.getItem(DATE_KEY);
    return raw ? new Date(raw) : null;
}

export function setLastDate(date) {
    localStorage.setItem(DATE_KEY, date.toISOString());
}

function getAllPlanOverrides() {
    const raw = localStorage.getItem(PLAN_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
}

// User-adjusted start/end times for the Plan tab's scheduler, keyed by date (so a
// tweak made for one night doesn't carry over to the next) and then by object.
export function getPlanOverrides(dateKey) {
    return getAllPlanOverrides()[dateKey] ?? {};
}

export function setPlanOverride(dateKey, objectKey, times) {
    const all = getAllPlanOverrides();
    all[dateKey] = { ...(all[dateKey] ?? {}), [objectKey]: times };
    localStorage.setItem(PLAN_OVERRIDES_KEY, JSON.stringify(all));
}

export function clearPlanOverride(dateKey, objectKey) {
    const all = getAllPlanOverrides();
    if (!all[dateKey]) return;
    delete all[dateKey][objectKey];
    if (Object.keys(all[dateKey]).length === 0) delete all[dateKey];
    localStorage.setItem(PLAN_OVERRIDES_KEY, JSON.stringify(all));
}

// Site-wide text size, as a multiplier of the browser default (1 = 100%). Shared
// across every page via the same key, so a change made on one carries over to the
// others.
export function getFontScale() {
    const raw = localStorage.getItem(FONT_SCALE_KEY);
    const scale = raw ? Number(raw) : 1;
    return Number.isFinite(scale) ? scale : 1;
}

export function setFontScale(scale) {
    localStorage.setItem(FONT_SCALE_KEY, String(scale));
}
