import { fetchObjects, searchObjects } from './api.js';
import { CelestialObject } from './CelestialObject.js';
import { renderObjectList, renderDetailPanel, setLoadingState, setErrorState } from './render.js';
import {
    addFavorite,
    removeFavorite,
    isFavorite,
    getFavorites,
    getLastLocation,
    setLastLocation,
    getLastDate,
    setLastDate,
} from './storage.js';
import { geocodeLocation } from './geocode.js';
import { TYPE_LABELS } from './typeLabels.js';

const resultsEl = document.querySelector('#results');
const detailPanelEl = document.querySelector('#detail-panel');
const savedListEl = document.querySelector('#saved-list');
const searchFormEl = document.querySelector('#search-form');
const searchInputEl = document.querySelector('#search-input');
const dateInputEl = document.querySelector('#date-input');
const locationInputEl = document.querySelector('#location-input');
const locationStatusEl = document.querySelector('#location-status');
const tabButtons = document.querySelectorAll('.tab');
const paginationEl = document.querySelector('#pagination');
const prevPageBtn = document.querySelector('#prev-page');
const nextPageBtn = document.querySelector('#next-page');
const pageInfoEl = document.querySelector('#page-info');
const filtersBarEl = document.querySelector('#filters-bar');
const allCatalogsFilterEl = document.querySelector('#all-catalogs-filter');
const typeFilterEl = document.querySelector('#type-filter');
const magnitudeFilterEl = document.querySelector('#magnitude-filter');
const visibleFilterEl = document.querySelector('#visible-filter');
const altitudeFilterEl = document.querySelector('#altitude-filter');
const apexStartFilterEl = document.querySelector('#apex-start-filter');
const apexEndFilterEl = document.querySelector('#apex-end-filter');
const clearFiltersBtn = document.querySelector('#clear-filters');

const PAGE_SIZE = 20;
// Type/magnitude filters run server-side (in the API's `where` clause) so pagination stays
// exact. "Visible now" and "apex between" can only be evaluated per-object with real math the
// API doesn't know about, so those run client-side against a larger fetched batch, capped at
// the API's own per-request max.
const CLIENT_FILTER_FETCH_LIMIT = 100;

for (const [code, label] of Object.entries(TYPE_LABELS)) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = label;
    typeFilterEl?.appendChild(option);
}

const state = {
    location: getLastLocation() ?? { latitude: 40.7128, longitude: -74.006, label: 'New York, NY' },
    date: getLastDate() ?? new Date(),
    objects: [],
    selectedObject: null,
    currentQuery: { type: 'browse' },
    page: 0,
    totalCount: 0,
    filters: {
        allCatalogs: false,
        type: '',
        maxMagnitude: null,
        visibleOnly: false,
        minMaxAltitude: null,
        apexStart: '',
        apexEnd: '',
    },
    // Cached full match set when client-side filters are active, so Prev/Next paginate
    // in memory instead of re-fetching and re-filtering on every click.
    filteredResults: null,
};

if (locationInputEl) locationInputEl.value = state.location.label ?? '';
if (dateInputEl) dateInputEl.value = toDateInputValue(state.date);

// Formats a Date as the "YYYY-MM-DD" string <input type="date"> expects, using local
// date parts rather than toISOString() (which is UTC and can shift the date by a day).
function toDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Parses a <input type="date"> value ("YYYY-MM-DD") as local midnight. `new Date("YYYY-MM-DD")`
// parses as UTC midnight, which in timezones behind UTC lands the evening before locally -
// visibility searches starting from that point could then find a rise still on the prior
// local calendar day even though the user picked "today".
function parseDateInputValue(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function hasClientFilters() {
    return (
        state.filters.visibleOnly ||
        state.filters.minMaxAltitude != null ||
        (state.filters.apexStart && state.filters.apexEnd)
    );
}

function buildServerFilterWhere(filters) {
    const parts = [];
    if (filters.type) parts.push(`type="${filters.type}"`);
    if (filters.maxMagnitude != null) parts.push(`mag<=${filters.maxMagnitude}`);
    return parts.join(' and ');
}

// Joins non-empty where-clause fragments with "and". Used instead of always assuming a
// base clause exists, since browsing "all catalogs" has no base restriction at all.
function combineWhere(...parts) {
    return parts.filter(Boolean).join(' and ');
}

// Builds a Date for "HH:MM" on the given day, in local time.
function timeOnDate(date, hhmm) {
    const [hours, minutes] = hhmm.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
}

function isTransitInRange(transitTime, date, startStr, endStr) {
    if (!transitTime) return false;
    const start = timeOnDate(date, startStr);
    let end = timeOnDate(date, endStr);
    if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000); // range wraps past midnight

    let t = transitTime;
    if (t < start) t = new Date(t.getTime() + 24 * 60 * 60 * 1000);
    return t >= start && t <= end;
}

function matchesClientFilters(object) {
    const { visibleOnly, minMaxAltitude, apexStart, apexEnd } = state.filters;
    if (visibleOnly && !object.isVisibleAt(state.location, state.date)) return false;
    if (minMaxAltitude != null) {
        const maxAltitude = object.getMaxAltitude(state.location, state.date);
        if (maxAltitude == null || maxAltitude < minMaxAltitude) return false;
    }
    if (apexStart && apexEnd) {
        const transitTime = object.getNextTransitTime(state.location, state.date);
        if (!isTransitInRange(transitTime, state.date, apexStart, apexEnd)) return false;
    }
    return true;
}

async function fetchQueryPage(limit, offset) {
    const filterWhere = buildServerFilterWhere(state.filters);
    if (state.currentQuery.type === 'search') {
        return searchObjects(state.currentQuery.query, { limit, offset, extraWhere: filterWhere || undefined });
    }
    const scopeWhere = state.filters.allCatalogs ? '' : 'cat1="M"';
    return fetchObjects({ where: combineWhere(scopeWhere, filterWhere), order_by: 'id1', limit, offset });
}

async function loadResults() {
    setLoadingState(resultsEl, true);
    setErrorState(resultsEl, null);
    try {
        if (hasClientFilters()) {
            if (state.filteredResults === null) {
                const { results } = await fetchQueryPage(CLIENT_FILTER_FETCH_LIMIT, 0);
                state.filteredResults = results.map(r => new CelestialObject(r)).filter(matchesClientFilters);
            }
            state.totalCount = state.filteredResults.length;
            state.objects = state.filteredResults.slice(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE);
        } else {
            const offset = state.page * PAGE_SIZE;
            const { results, totalCount } = await fetchQueryPage(PAGE_SIZE, offset);
            state.objects = results.map(r => new CelestialObject(r));
            state.totalCount = totalCount;
        }

        renderObjectList(resultsEl, state.objects, {
            onSelect: handleSelectObject,
            onToggleFavorite: handleToggleFavorite,
        });
        renderPagination();
    } catch (err) {
        setErrorState(resultsEl, `Couldn't load objects: ${err.message}`);
    } finally {
        setLoadingState(resultsEl, false);
    }
}

// Resets to page 1 and drops the client-filter cache, then re-runs the current query -
// use this whenever the query, filters, location, or date change.
function refreshResults() {
    state.page = 0;
    state.filteredResults = null;
    loadResults();
}

function renderPagination() {
    if (!paginationEl) return;
    const totalPages = Math.max(1, Math.ceil(state.totalCount / PAGE_SIZE));
    const currentPage = state.page + 1;

    paginationEl.hidden = state.totalCount <= PAGE_SIZE;
    pageInfoEl.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = state.page === 0;
    nextPageBtn.disabled = currentPage >= totalPages;
}

function handleSelectObject(object) {
    state.selectedObject = object;
    const visibility = object.getVisibilityWindow(state.location, state.date);
    renderDetailPanel(detailPanelEl, object, {
        visibility,
        location: state.location,
        date: state.date,
        onClose: () => { state.selectedObject = null; },
    });
}

function handleToggleFavorite(object, cardEl) {
    const favorited = isFavorite(object.catalog, object.catalogId);
    if (favorited) {
        removeFavorite(object.catalog, object.catalogId);
    } else {
        addFavorite(object);
    }
    cardEl.classList.toggle('is-favorite', !favorited);
    renderFavorites();
}

function renderFavorites() {
    const favorites = getFavorites().map(f => new CelestialObject(f.raw));
    renderObjectList(
        savedListEl,
        favorites,
        { onSelect: handleSelectObject, onToggleFavorite: handleToggleFavorite },
        'No saved objects yet. Click the star on any object to save it.'
    );
}

tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const isSaved = btn.dataset.tab === 'saved';
        tabButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        resultsEl.hidden = isSaved;
        savedListEl.hidden = !isSaved;
        if (filtersBarEl) filtersBarEl.hidden = isSaved;
        if (isSaved) {
            renderFavorites();
            if (paginationEl) paginationEl.hidden = true;
        } else {
            renderPagination();
        }
    });
});

searchFormEl?.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInputEl.value.trim();
    // An empty query isn't an error here - it just means "browse with the active filters"
    // rather than "search by name/catalog ID", so this still runs instead of no-op'ing.
    state.currentQuery = query ? { type: 'search', query } : { type: 'browse' };
    refreshResults();
});

allCatalogsFilterEl?.addEventListener('change', () => {
    state.filters.allCatalogs = allCatalogsFilterEl.checked;
    refreshResults();
});

typeFilterEl?.addEventListener('change', () => {
    state.filters.type = typeFilterEl.value;
    refreshResults();
});

magnitudeFilterEl?.addEventListener('change', () => {
    const value = magnitudeFilterEl.value.trim();
    state.filters.maxMagnitude = value === '' ? null : Number(value);
    refreshResults();
});

visibleFilterEl?.addEventListener('change', () => {
    state.filters.visibleOnly = visibleFilterEl.checked;
    refreshResults();
});

altitudeFilterEl?.addEventListener('change', () => {
    const value = altitudeFilterEl.value.trim();
    state.filters.minMaxAltitude = value === '' ? null : Number(value);
    refreshResults();
});

apexStartFilterEl?.addEventListener('change', () => {
    state.filters.apexStart = apexStartFilterEl.value;
    refreshResults();
});

apexEndFilterEl?.addEventListener('change', () => {
    state.filters.apexEnd = apexEndFilterEl.value;
    refreshResults();
});

clearFiltersBtn?.addEventListener('click', () => {
    state.filters = {
        allCatalogs: false,
        type: '',
        maxMagnitude: null,
        visibleOnly: false,
        minMaxAltitude: null,
        apexStart: '',
        apexEnd: '',
    };
    if (allCatalogsFilterEl) allCatalogsFilterEl.checked = false;
    if (typeFilterEl) typeFilterEl.value = '';
    if (magnitudeFilterEl) magnitudeFilterEl.value = '';
    if (visibleFilterEl) visibleFilterEl.checked = false;
    if (altitudeFilterEl) altitudeFilterEl.value = '';
    if (apexStartFilterEl) apexStartFilterEl.value = '';
    if (apexEndFilterEl) apexEndFilterEl.value = '';
    refreshResults();
});

prevPageBtn?.addEventListener('click', () => {
    if (state.page === 0) return;
    state.page -= 1;
    loadResults();
});

nextPageBtn?.addEventListener('click', () => {
    state.page += 1;
    loadResults();
});

locationInputEl?.addEventListener('change', async () => {
    const query = locationInputEl.value.trim();
    if (!query) return;

    if (locationStatusEl) locationStatusEl.textContent = 'Locating…';
    try {
        const location = await geocodeLocation(query);
        if (!location) {
            if (locationStatusEl) locationStatusEl.textContent = 'Location not found';
            return;
        }

        state.location = location;
        setLastLocation(location);
        locationInputEl.value = location.label ?? query;
        if (locationStatusEl) locationStatusEl.textContent = '';

        if (state.selectedObject) handleSelectObject(state.selectedObject);
        if (hasClientFilters()) refreshResults();
    } catch (err) {
        if (locationStatusEl) locationStatusEl.textContent = `Couldn't look up location: ${err.message}`;
    }
});

dateInputEl?.addEventListener('change', () => {
    if (!dateInputEl.value) return;
    state.date = parseDateInputValue(dateInputEl.value);
    setLastDate(state.date);
    if (state.selectedObject) handleSelectObject(state.selectedObject);
    if (hasClientFilters()) refreshResults();
});

loadResults();
renderFavorites();
