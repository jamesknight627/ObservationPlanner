import { fetchObjectsByCatalogId } from './api.js';
import { CelestialObject } from './CelestialObject.js';
import { findWikipediaSummary } from './wikipedia.js';
import { parseDetailParams } from './objectLink.js';
import { getLastLocation } from './storage.js';
import {
    formatDuration,
    formatTime,
    formatRaHours,
    formatDecDegrees,
    formatMagnitude,
    formatAngularSize,
    formatAltitude,
    formatCoords,
    formatMagnification,
    formatBortle,
} from './format.js';
import { getTypeLabel } from './typeLabels.js';

const DEFAULT_LOCATION = { latitude: 40.7128, longitude: -74.006, label: 'New York, NY' };

const pageEl = document.querySelector('#object-page');
const backLinkEl = document.querySelector('#back-link');

// If we arrived from the planner, go back in history so its in-memory state
// (search, tab, scroll position, open panel) is restored instead of reset.
// Falls back to the plain href navigation when there's no prior history entry
// (e.g. object.html opened directly in a new tab).
backLinkEl?.addEventListener('click', (e) => {
    if (window.history.length > 1) {
        e.preventDefault();
        window.history.back();
    }
});

async function init() {
    const { catalog, catalogId, location, date } = parseDetailParams(new URLSearchParams(window.location.search));

    if (!catalog || catalogId == null) {
        pageEl.innerHTML = '<p class="error-state">No object specified.</p>';
        return;
    }

    try {
        const record = await fetchObjectsByCatalogId(catalog, catalogId);
        if (!record) {
            pageEl.innerHTML = '<p class="error-state">Object not found.</p>';
            return;
        }

        const object = new CelestialObject(record);
        const effectiveLocation = location ?? getLastLocation() ?? DEFAULT_LOCATION;
        const effectiveDate = date ?? new Date();
        const visibility = object.getVisibilityWindow(effectiveLocation, effectiveDate);
        const summary = await findWikipediaSummary(object);

        render(object, { visibility, location: effectiveLocation, summary });
    } catch (err) {
        pageEl.innerHTML = `<p class="error-state">Couldn't load object: ${err.message}</p>`;
    }
}

function render(object, { visibility, location, summary }) {
    const { riseTime, transitTime, setTime, durationMs, maxAltitudeDeg } = visibility ?? {};

    const imageBlock = summary?.imageUrl
        ? `<img class="object-page__image" src="${summary.imageUrl}" alt="${summary.title}">`
        : '';

    const extractBlock = summary?.extract
        ? `<p class="object-page__extract">${summary.extract}</p>`
        : '<p class="empty-state">No description available.</p>';

    const wikiLink = summary?.pageUrl
        ? `<a href="${summary.pageUrl}" target="_blank" rel="noopener">View on Wikipedia →</a>`
        : '';

    const nameRow = object.properName
        ? `<dt>Name</dt><dd>${object.properName}</dd>`
        : '';

    const { constellationName, minMagnification, equipment, maxBortle } = object.getObservingGuide();

    pageEl.innerHTML = `
        <div class="object-page__layout">
            <article class="object-page__content">
                ${imageBlock}
                <h1>${object.catalog ?? ''} ${object.catalogId ?? ''}</h1>
                ${extractBlock}
                <dl class="detail-panel__attrs">
                    ${nameRow}
                    <dt>Type</dt><dd>${getTypeLabel(object.type)}</dd>
                    <dt>Magnitude</dt><dd>${formatMagnitude(object.magnitude)}</dd>
                    <dt>Angular size</dt><dd>${formatAngularSize(object.angularSize)}</dd>
                    <dt>RA / Dec</dt><dd>${formatRaHours(object.raDeg)} / ${formatDecDegrees(object.decDeg)}</dd>
                    <dt>Location</dt><dd>${location.label ?? formatCoords(location)}</dd>
                    <dt>Next rise</dt><dd>${formatTime(riseTime)}</dd>
                    <dt>Time at apex</dt><dd>${formatTime(transitTime)}</dd>
                    <dt>Max altitude</dt><dd>${formatAltitude(maxAltitudeDeg)}</dd>
                    <dt>Sets at</dt><dd>${formatTime(setTime)}</dd>
                    <dt>Transit duration</dt><dd>${formatDuration(durationMs)}</dd>
                </dl>
                ${wikiLink}
            </article>

            <aside class="observing-guide">
                <h2>Observing Guide</h2>
                <p class="observing-guide__disclaimer">Estimated from magnitude and size - a starting point, not a guarantee.</p>
                <dl class="detail-panel__attrs">
                    <dt>Constellation</dt><dd>${constellationName ?? '—'}</dd>
                    <dt>Min. magnification</dt><dd>${formatMagnification(minMagnification)}</dd>
                    <dt>Min. equipment</dt><dd>${equipment ?? '—'}</dd>
                    <dt>Max Bortle rating</dt><dd>${formatBortle(maxBortle)}</dd>
                </dl>
            </aside>
        </div>
    `;
}

init();
