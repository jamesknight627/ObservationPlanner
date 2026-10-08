import { fetchObjects, searchObjects } from './api.js';
import { CelestialObject } from './CelestialObject.js';
import { SolarSystemBody } from './SolarSystemBody.js';
import { fetchSolarSystemBodies, objectFromFavorite } from './objectFactory.js';
import { renderObjectList, renderDetailPanel, setLoadingState, setErrorState } from './render.js';
import { renderScheduler } from './scheduler.js';
import {
    addFavorite,
    removeFavorite,
    isFavorite,
    getFavorites,
    getLastLocation,
    setLastLocation,
    getLastDate,
    setLastDate,
    getPlanOverrides,
    setPlanOverride,
    clearPlanOverride,
} from './storage.js';
import { geocodeLocation } from './geocode.js';
import { initFontSizeControls } from './fontSize.js';
import { TYPE_LABELS, SOLAR_SYSTEM_TYPE_LABELS } from './typeLabels.js';
import { isDomeAvailable, syncDomeSky, addObjectToDome, resetAllDome } from './digistar.js';

const resultsEl = document.querySelector('#results');
const detailPanelEl = document.querySelector('#detail-panel');
const savedListEl = document.querySelector('#saved-list');
const planListEl = document.querySelector('#plan-list');
const savedListToolbarEl = document.querySelector('#saved-list-toolbar');
const favoritesSortEl = document.querySelector('#favorites-sort');
const favoritesDomeControlEl = document.querySelector('#favorites-dome-control');
const favoritesDomeAddBtn = document.querySelector('#favorites-dome-add');
const favoritesDomeResetBtn = document.querySelector('#favorites-dome-reset');
const favoritesDomeStatusEl = document.querySelector('#favorites-dome-status');
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
const datasetFilterEl = document.querySelector('#dataset-filter');
const typeFilterEl = document.querySelector('#type-filter');
const magnitudeFilterEl = document.querySelector('#magnitude-filter');
const visibleFilterEl = document.querySelector('#visible-filter');
const altitudeFilterEl = document.querySelector('#altitude-filter');
const apexStartFilterEl = document.querySelector('#apex-start-filter');
const apexEndFilterEl = document.querySelector('#apex-end-filter');
const windowStartFilterEl = document.querySelector('#window-start-filter');
const windowEndFilterEl = document.querySelector('#window-end-filter');
const clearFiltersBtn = document.querySelector('#clear-filters');

const PAGE_SIZE = 20;
// Type/magnitude filters run server-side (in the API's `where` clause) so pagination stays
// exact. "Visible now" and "apex between" can only be evaluated per-object with real math the
// API doesn't know about, so those run client-side against a larger fetched batch, capped at
// the API's own per-request max.
const CLIENT_FILTER_FETCH_LIMIT = 100;

// Which catalog the planner browses/searches: 'messier', 'deepSky' (all ~227k deep-sky
// objects), or 'solarSystem' (the Sun and planets, from the solar-system dataset).
const DEFAULT_CATALOG_SCOPE = 'messier';

// Deep-sky and solar-system objects use different type codes, so the Type dropdown is
// rebuilt whenever the catalog changes.
function populateTypeOptions(scope) {
    if (!typeFilterEl) return;
    const labels = scope === 'solarSystem' ? SOLAR_SYSTEM_TYPE_LABELS : TYPE_LABELS;
    typeFilterEl.innerHTML = '<option value="">All types</option>';
    for (const [code, label] of Object.entries(labels)) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = label;
        typeFilterEl.appendChild(option);
    }
}

populateTypeOptions(DEFAULT_CATALOG_SCOPE);

const state = {
    location: getLastLocation() ?? { latitude: 40.7128, longitude: -74.006, label: 'New York, NY' },
    date: getLastDate() ?? new Date(),
    objects: [],
    selectedObject: null,
    currentQuery: { type: 'browse' },
    page: 0,
    totalCount: 0,
    filters: {
        catalogScope: DEFAULT_CATALOG_SCOPE,
        type: '',
        maxMagnitude: null,
        visibleOnly: false,
        minMaxAltitude: null,
        apexStart: '',
        apexEnd: '',
        windowStart: '',
        windowEnd: '',
    },
    // Cached full match set when client-side filters are active, so Prev/Next paginate
    // in memory instead of re-fetching and re-filtering on every click.
    filteredResults: null,
    favoritesSortBy: 'rise',
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

function isSolarSystemScope() {
    return state.filters.catalogScope === 'solarSystem';
}

function hasClientFilters() {
    return (
        state.filters.visibleOnly ||
        state.filters.minMaxAltitude != null ||
        (state.filters.apexStart && state.filters.apexEnd) ||
        (state.filters.windowStart && state.filters.windowEnd)
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

// Start/end Dates for a "HH:MM"-"HH:MM" range on the given day, pushing `end` a day
// forward when it's not after `start` (the range wraps past midnight, e.g. 22:00-02:00).
function buildWindowRange(date, startStr, endStr) {
    const start = timeOnDate(date, startStr);
    let end = timeOnDate(date, endStr);
    if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
}

// Moves a time forward a day if it falls before `start`, so a time that's technically
// earlier in the clock (e.g. 01:00) is compared as part of the night that started the
// evening before, matching how `start`/`end` from buildWindowRange() wrap past midnight.
function shiftIntoWindow(time, start) {
    return time < start ? new Date(time.getTime() + 24 * 60 * 60 * 1000) : time;
}

function isTransitInRange(transitTime, date, startStr, endStr) {
    if (!transitTime) return false;
    const { start, end } = buildWindowRange(date, startStr, endStr);
    const t = shiftIntoWindow(transitTime, start);
    return t >= start && t <= end;
}

// True if the object's rise-to-set span overlaps the given window at all (not just its
// apex) - i.e. it's above the horizon for at least part of the window. Unlike
// isTransitInRange(), riseTime/setTime need no shifting: both are already absolute Dates
// on the same timeline as `date`, so a plain interval-overlap check is correct as-is.
function isVisibleDuringWindow(riseTime, setTime, date, startStr, endStr) {
    if (!riseTime || !setTime) return false;
    const { start, end } = buildWindowRange(date, startStr, endStr);
    return riseTime <= end && setTime >= start;
}

function matchesClientFilters(object) {
    const { visibleOnly, minMaxAltitude, apexStart, apexEnd, windowStart, windowEnd } = state.filters;
    if (visibleOnly && !object.isVisibleAt(state.location, state.date)) return false;
    if (minMaxAltitude != null) {
        const maxAltitude = object.getMaxAltitude(state.location, state.date);
        if (maxAltitude == null || maxAltitude < minMaxAltitude) return false;
    }
    if (apexStart && apexEnd) {
        const transitTime = object.getNextTransitTime(state.location, state.date);
        if (!isTransitInRange(transitTime, state.date, apexStart, apexEnd)) return false;
    }
    if (windowStart && windowEnd) {
        const { riseTime, setTime } = object.getVisibilityWindow(state.location, state.date);
        if (!isVisibleDuringWindow(riseTime, setTime, state.date, windowStart, windowEnd)) return false;
    }
    return true;
}

async function fetchQueryPage(limit, offset) {
    const filterWhere = buildServerFilterWhere(state.filters);
    if (state.currentQuery.type === 'search') {
        return searchObjects(state.currentQuery.query, { limit, offset, extraWhere: filterWhere || undefined });
    }
    const scopeWhere = state.filters.catalogScope === 'messier' ? 'cat1="M"' : '';
    return fetchObjects({ where: combineWhere(scopeWhere, filterWhere), order_by: 'id1', limit, offset });
}

// The solar-system dataset is tiny, so instead of building an API `where` clause, the
// search text and type/magnitude filters are applied here, the same way the
// client-side filters are. Magnitude is the computed one for the selected date.
function matchesSolarSystemQuery(body) {
    const { type, maxMagnitude } = state.filters;
    if (state.currentQuery.type === 'search') {
        const needle = state.currentQuery.query.toLowerCase();
        if (!body.name.toLowerCase().includes(needle)) return false;
    }
    if (type && body.type !== type) return false;
    if (maxMagnitude != null && body.magnitude > maxMagnitude) return false;
    return true;
}

// Every object matching the current query and all filters, for the in-memory pagination path.
async function fetchAllMatches() {
    if (isSolarSystemScope()) {
        const bodies = await fetchSolarSystemBodies(state.date);
        return bodies.filter(matchesSolarSystemQuery).filter(matchesClientFilters);
    }
    const { results } = await fetchQueryPage(CLIENT_FILTER_FETCH_LIMIT, 0);
    return results.map(r => new CelestialObject(r)).filter(matchesClientFilters);
}

async function loadResults() {
    setLoadingState(resultsEl, true);
    setErrorState(resultsEl, null);
    try {
        if (isSolarSystemScope() || hasClientFilters()) {
            if (state.filteredResults === null) {
                state.filteredResults = await fetchAllMatches();
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
    object.setEpoch(state.date);
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
    renderPlan();
}

// Maps the sort-by <select> value to the matching getVisibilityWindow() field.
const FAVORITES_SORT_FIELDS = {
    rise: 'riseTime',
    transit: 'transitTime',
    set: 'setTime',
    duration: 'durationMs',
};

function renderFavorites() {
    const favorites = getFavorites()
        .map(f => objectFromFavorite(f, state.date))
        .filter(Boolean);

    const field = FAVORITES_SORT_FIELDS[state.favoritesSortBy] ?? 'riseTime';
    const sorted = favorites
        .map((object) => {
            const value = object.getVisibilityWindow(state.location, state.date)[field];
            const sortKey = value instanceof Date ? value.getTime() : value;
            return { object, sortKey };
        })
        // Objects with no sort key (e.g. never rises/sets that day) sort to the end
        // rather than before everything, so they don't push valid results down.
        .sort((a, b) => {
            if (a.sortKey == null && b.sortKey == null) return 0;
            if (a.sortKey == null) return 1;
            if (b.sortKey == null) return -1;
            return a.sortKey - b.sortKey;
        })
        .map((entry) => entry.object);

    renderObjectList(
        savedListEl,
        sorted,
        { onSelect: handleSelectObject, onToggleFavorite: handleToggleFavorite },
        'No saved objects yet. Click the star on any object to save it.'
    );
}

function planKey(object) {
    return `${object.catalog}:${object.catalogId}`;
}

function roundDownToHalfHour(date) {
    const ms = 30 * 60 * 1000;
    return new Date(Math.floor(date.getTime() / ms) * ms);
}

function roundUpToHalfHour(date) {
    const ms = 30 * 60 * 1000;
    return new Date(Math.ceil(date.getTime() / ms) * ms);
}

// Evenly-spaced altitude readings across the timeline, for the scheduler's per-row
// altitude graph - deliberately independent of each object's own start/end, so the
// curve always shows the object's full path through the sky that night, not just
// whatever window is currently selected.
const ALTITUDE_SAMPLE_COUNT = 48;

function sampleAltitude(object, location, start, end, count) {
    const startMs = start.getTime();
    const endMs = end.getTime();
    const samples = [];
    for (let i = 0; i < count; i++) {
        const t = new Date(startMs + ((endMs - startMs) * i) / (count - 1));
        samples.push(object.toAltAz(location, t)?.altitude ?? 0);
    }
    return samples;
}

// Standard altitude thresholds for sunset/sunrise (accounting for atmospheric refraction
// and the Sun's own apparent radius) and the end/start of civil twilight.
const SUNSET_ALTITUDE_DEG = -0.833;
const CIVIL_TWILIGHT_ALTITUDE_DEG = -6;
const SUN_SCAN_STEP_MS = 5 * 60 * 1000;

// Finds when the Sun first crosses the sunset/sunrise and civil-twilight altitudes within
// the timeline, scanning it chronologically once so each field is that crossing's first
// (and, within one night, only) occurrence. A field stays null if the timeline doesn't
// contain that crossing - e.g. a short timeline, or a latitude/date where the Sun never
// reaches that altitude at all.
function findSunMarks(location, timelineStart, timelineEnd) {
    const sun = new SolarSystemBody({}, 'sun');
    const marks = { sunset: null, duskCivil: null, dawnCivil: null, sunrise: null };
    const startMs = timelineStart.getTime();
    const endMs = timelineEnd.getTime();
    let prevAlt = sun.toAltAz(location, timelineStart)?.altitude ?? 0;
    for (let t = startMs + SUN_SCAN_STEP_MS; t <= endMs; t += SUN_SCAN_STEP_MS) {
        const time = new Date(t);
        const alt = sun.toAltAz(location, time)?.altitude ?? 0;
        if (marks.sunset == null && prevAlt >= SUNSET_ALTITUDE_DEG && alt < SUNSET_ALTITUDE_DEG) marks.sunset = time;
        if (marks.duskCivil == null && prevAlt >= CIVIL_TWILIGHT_ALTITUDE_DEG && alt < CIVIL_TWILIGHT_ALTITUDE_DEG) marks.duskCivil = time;
        if (marks.dawnCivil == null && prevAlt < CIVIL_TWILIGHT_ALTITUDE_DEG && alt >= CIVIL_TWILIGHT_ALTITUDE_DEG) marks.dawnCivil = time;
        if (marks.sunrise == null && prevAlt < SUNSET_ALTITUDE_DEG && alt >= SUNSET_ALTITUDE_DEG) marks.sunrise = time;
        prevAlt = alt;
    }
    return marks;
}

// Tonight's observing schedule: favorites that are up on the selected date, laid out
// on a shared timeline as draggable rise→set bars (see js/scheduler.js). Any start/end
// the user has dragged away from the natural rise/set is persisted per date+object via
// storage.js, so it survives switching tabs, changing the date and back, and reloads.
function renderPlan() {
    const dateKey = toDateInputValue(state.date);
    const overrides = getPlanOverrides(dateKey);
    const favorites = getFavorites()
        .map(f => objectFromFavorite(f, state.date))
        .filter(Boolean);

    const visibleEntries = [];
    const notVisible = [];
    for (const object of favorites) {
        const { riseTime, setTime } = object.getVisibilityWindow(state.location, state.date);
        // No riseTime means either circumpolar (already up, no rise to find) or never
        // rises at all that date - isVisibleAt() disambiguates the two.
        const isUp = riseTime ? true : object.isVisibleAt(state.location, state.date);
        if (isUp) {
            visibleEntries.push({ object, originalStart: riseTime, originalEnd: setTime, circumpolar: !riseTime });
        } else {
            notVisible.push(object);
        }
    }

    // The timeline's shared axis spans every real (non-circumpolar) rise/set window that
    // night, padded a little for breathing room. If every visible favorite is circumpolar
    // there's nothing to anchor the axis to, so it falls back to a generic evening-to-
    // morning span.
    const withWindows = visibleEntries.filter((e) => !e.circumpolar);
    let timelineStart;
    let timelineEnd;
    if (withWindows.length > 0) {
        const minStart = Math.min(...withWindows.map((e) => e.originalStart.getTime()));
        const maxEnd = Math.max(...withWindows.map((e) => e.originalEnd.getTime()));
        timelineStart = roundDownToHalfHour(new Date(minStart - 15 * 60 * 1000));
        timelineEnd = roundUpToHalfHour(new Date(maxEnd + 15 * 60 * 1000));
    } else {
        timelineStart = timeOnDate(state.date, '18:00');
        timelineEnd = new Date(timeOnDate(state.date, '06:00').getTime() + 24 * 60 * 60 * 1000);
    }

    for (const entry of visibleEntries) {
        if (entry.circumpolar) {
            entry.originalStart = timelineStart;
            entry.originalEnd = timelineEnd;
        }
        const override = overrides[planKey(entry.object)];
        entry.start = override ? new Date(override.start) : entry.originalStart;
        entry.end = override ? new Date(override.end) : entry.originalEnd;
        entry.altitudeSamples = sampleAltitude(entry.object, state.location, timelineStart, timelineEnd, ALTITUDE_SAMPLE_COUNT);
    }

    // Start time ascending; circumpolar objects (pinned to the timeline's own start)
    // sort first, since they're already up and there's nothing to wait for.
    visibleEntries.sort((a, b) => a.originalStart.getTime() - b.originalStart.getTime());

    const sunMarks = findSunMarks(state.location, timelineStart, timelineEnd);

    renderScheduler(
        planListEl,
        { timelineStart, timelineEnd, entries: visibleEntries, notVisibleObjects: notVisible, sunMarks },
        {
            onSelect: handleSelectObject,
            onTimesChange: (entry, start, end) => {
                setPlanOverride(dateKey, planKey(entry.object), { start: start.toISOString(), end: end.toISOString() });
            },
            onResetTimes: (entry) => {
                clearPlanOverride(dateKey, planKey(entry.object));
                renderPlan();
            },
        },
        'No saved objects yet. Click the star on any object to save it.'
    );
}

// How far before the earliest favorite's set time to sync the dome - just enough
// that it's unambiguously still above the horizon at sync time, not exactly at the
// boundary.
const DOME_SYNC_BEFORE_SET_MS = 60 * 1000;

// Syncs the dome once, then adds every favorite that's in Digistar's object library
// and above the horizon that day. There's no single correct dome "date" for a batch
// of objects that each rise at a different time, so unlike the per-object Show on
// dome button (which syncs to that one object's own next rise), this syncs to a
// moment just before the *earliest* of them sets - late enough that as many
// favorites as possible are already up, but before any of them have set again.
// Circumpolar favorites (no set time that day) don't constrain this; if none of the
// favorites have a real set time, there's nothing to anchor to, so this falls back
// to the planner's selected date.
async function addAllFavoritesToDome() {
    const favorites = getFavorites()
        .map(f => objectFromFavorite(f, state.date))
        .filter(Boolean);

    const visibility = favorites.map((object) => {
        const { transitTime, setTime } = object.getVisibilityWindow(state.location, state.date);
        const apexBelowHorizon = transitTime ? false : !object.isVisibleAt(state.location, state.date);
        return { object, apexBelowHorizon, setTime };
    });

    const setTimesMs = visibility.map((v) => v.setTime?.getTime()).filter((t) => t != null);
    const syncDate = setTimesMs.length > 0
        ? new Date(Math.min(...setTimesMs) - DOME_SYNC_BEFORE_SET_MS)
        : state.date;

    await syncDomeSky({
        date: syncDate,
        lat: state.location?.latitude,
        lon: state.location?.longitude,
        locationLabel: state.location?.label,
    });

    let added = 0;
    const skipped = [];
    for (const { object, apexBelowHorizon } of visibility) {
        try {
            await addObjectToDome({
                name: object.name,
                catalog: object.catalog,
                catalogId: object.catalogId,
                apexBelowHorizon,
            });
            added += 1;
        } catch (err) {
            skipped.push(object.name);
        }
    }

    if (favorites.length === 0) return 'No saved objects to add.';
    if (skipped.length === 0) return `Added ${added} favorite${added === 1 ? '' : 's'} to the dome.`;
    return `Added ${added} favorite${added === 1 ? '' : 's'}; skipped ${skipped.length} (${skipped.join(', ')}).`;
}

tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab; // 'results' | 'saved' | 'plan'
        tabButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        resultsEl.hidden = tab !== 'results';
        savedListEl.hidden = tab !== 'saved';
        if (planListEl) planListEl.hidden = tab !== 'plan';
        if (filtersBarEl) filtersBarEl.hidden = tab !== 'results';
        if (savedListToolbarEl) savedListToolbarEl.hidden = tab !== 'saved';
        if (tab === 'saved') {
            renderFavorites();
            if (paginationEl) paginationEl.hidden = true;
        } else if (tab === 'plan') {
            renderPlan();
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

datasetFilterEl?.addEventListener('change', () => {
    state.filters.catalogScope = datasetFilterEl.value;
    state.filters.type = '';
    populateTypeOptions(state.filters.catalogScope);
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

windowStartFilterEl?.addEventListener('change', () => {
    state.filters.windowStart = windowStartFilterEl.value;
    refreshResults();
});

windowEndFilterEl?.addEventListener('change', () => {
    state.filters.windowEnd = windowEndFilterEl.value;
    refreshResults();
});

favoritesSortEl?.addEventListener('change', () => {
    state.favoritesSortBy = favoritesSortEl.value;
    renderFavorites();
});

// Hidden until isDomeAvailable() confirms Digistar's web interface is answering, so
// this is a no-op outside the dome (see js/digistar.js), same as the per-object
// dome control in js/render.js.
if (favoritesDomeControlEl) {
    isDomeAvailable().then((available) => { favoritesDomeControlEl.hidden = !available; });
}

async function runFavoritesDomeAction(action, busyText, getSuccessText) {
    if (!favoritesDomeAddBtn || !favoritesDomeResetBtn || !favoritesDomeStatusEl) return;
    favoritesDomeAddBtn.disabled = true;
    favoritesDomeResetBtn.disabled = true;
    favoritesDomeStatusEl.classList.remove('is-error');
    favoritesDomeStatusEl.textContent = busyText;
    try {
        const result = await action();
        favoritesDomeStatusEl.textContent = getSuccessText(result);
    } catch (err) {
        favoritesDomeStatusEl.classList.add('is-error');
        favoritesDomeStatusEl.textContent = err.message;
    } finally {
        favoritesDomeAddBtn.disabled = false;
        favoritesDomeResetBtn.disabled = false;
    }
}

favoritesDomeAddBtn?.addEventListener('click', () =>
    runFavoritesDomeAction(addAllFavoritesToDome, 'Adding…', (message) => message));
favoritesDomeResetBtn?.addEventListener('click', () =>
    runFavoritesDomeAction(() => resetAllDome(state.location?.label), 'Resetting…', () => 'Dome view reset'));

clearFiltersBtn?.addEventListener('click', () => {
    state.filters = {
        catalogScope: DEFAULT_CATALOG_SCOPE,
        type: '',
        maxMagnitude: null,
        visibleOnly: false,
        minMaxAltitude: null,
        apexStart: '',
        apexEnd: '',
        windowStart: '',
        windowEnd: '',
    };
    if (datasetFilterEl) datasetFilterEl.value = DEFAULT_CATALOG_SCOPE;
    populateTypeOptions(DEFAULT_CATALOG_SCOPE);
    if (magnitudeFilterEl) magnitudeFilterEl.value = '';
    if (visibleFilterEl) visibleFilterEl.checked = false;
    if (altitudeFilterEl) altitudeFilterEl.value = '';
    if (apexStartFilterEl) apexStartFilterEl.value = '';
    if (apexEndFilterEl) apexEndFilterEl.value = '';
    if (windowStartFilterEl) windowStartFilterEl.value = '';
    if (windowEndFilterEl) windowEndFilterEl.value = '';
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
    // Planet positions and brightness depend on the date, so solar-system results are
    // rebuilt too (the dataset itself is cached, so this doesn't re-fetch it).
    if (hasClientFilters() || isSolarSystemScope()) refreshResults();
    renderFavorites();
    renderPlan();
});

initFontSizeControls();
loadResults();
renderFavorites();
renderPlan();
