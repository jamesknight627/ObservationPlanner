const FAVORITES_KEY = 'astro-planner:favorites';
const LOCATION_KEY = 'astro-planner:last-location';
const DATE_KEY = 'astro-planner:last-date';

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
