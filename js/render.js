import { isFavorite } from './storage.js';
import { buildDetailUrl } from './objectLink.js';
import {
    formatDuration,
    formatTime,
    formatRaHours,
    formatDecDegrees,
    formatMagnitude,
    formatAngularSize,
    formatAltitude,
    formatCoords,
    formatQuantity,
} from './format.js';
import { getTypeLabel } from './typeLabels.js';
import { createDomeControl } from './digistar.js';

export function renderObjectCard(object, { onSelect, onToggleFavorite } = {}) {
    const card = document.createElement('article');
    card.className = 'object-card';
    card.tabIndex = 0;
    card.dataset.catalog = object.catalog;
    card.dataset.catalogId = object.catalogId;

    const favorited = isFavorite(object.catalog, object.catalogId);
    if (favorited) card.classList.add('is-favorite');

    const { equipment } = object.getObservingGuide();

    card.innerHTML = `
        <button class="favorite-toggle" aria-label="Toggle favorite" aria-pressed="${favorited}">★</button>
        <h3 class="object-card__name">${object.cardTitle}</h3>
        <p class="object-card__type">${getTypeLabel(object.type)}</p>
        <p class="object-card__mag">${formatMagnitude(object.magnitude)}</p>
        <p class="object-card__equipment">${equipment ?? '—'}</p>
    `;

    card.addEventListener('click', (e) => {
        if (e.target.closest('.favorite-toggle')) {
            onToggleFavorite?.(object, card);
            return;
        }
        onSelect?.(object);
    });

    return card;
}

export function renderObjectList(container, objects, handlers, emptyMessage = 'No objects found.') {
    container.innerHTML = '';
    if (objects.length === 0) {
        container.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
        return;
    }
    const fragment = document.createDocumentFragment();
    for (const object of objects) {
        fragment.appendChild(renderObjectCard(object, handlers));
    }
    container.appendChild(fragment);
}

// <dt>/<dd> rows for any extra dataset facts the object provides (solar-system bodies
// have diameter, gravity, etc.; deep-sky objects have none).
export function renderPhysicalFactRows(object) {
    return object.getPhysicalFacts()
        .map(({ label, value, unit }) => `<dt>${label}</dt><dd>${formatQuantity(value, unit)}</dd>`)
        .join('');
}

export function renderDetailPanel(panel, object, { visibility, location, date, onClose } = {}) {
    const { riseTime, transitTime, setTime, durationMs, maxAltitudeDeg } = visibility ?? {};

    const nameRow = object.properName
        ? `<dt>Name</dt><dd>${object.properName}</dd>`
        : '';

    const locationRow = location
        ? `<dt>From location</dt><dd>${location.label ?? formatCoords(location)}</dd>`
        : '';

    // A fresh object always opens expanded, even if the panel was left minimized for a
    // previous one - the grid column it sits in is sized by .app-body's own class, so
    // that has to be cleared here too, not just the panel's own class.
    panel.classList.remove('is-minimized');
    document.querySelector('.app-body')?.classList.remove('detail-panel-minimized');

    panel.innerHTML = `
        <div class="detail-panel__toolbar">
            <button class="detail-panel__minimize" aria-label="Minimize detail panel">›</button>
            <button class="detail-panel__close" aria-label="Close detail panel">×</button>
        </div>
        <h2>${object.heading}</h2>
        <dl class="detail-panel__attrs">
            ${nameRow}
            <dt>Type</dt><dd>${getTypeLabel(object.type)}</dd>
            <dt>Magnitude</dt><dd>${formatMagnitude(object.magnitude)}</dd>
            <dt>Angular size</dt><dd>${formatAngularSize(object.angularSize)}</dd>
            <dt>RA / Dec</dt><dd>${formatRaHours(object.raDeg)} / ${formatDecDegrees(object.decDeg)}</dd>
            ${locationRow}
            <dt>Next rise</dt><dd>${formatTime(riseTime)}</dd>
            <dt>Time at apex</dt><dd>${formatTime(transitTime)}</dd>
            <dt>Max altitude</dt><dd>${formatAltitude(maxAltitudeDeg)}</dd>
            <dt>Sets at</dt><dd>${formatTime(setTime)}</dd>
            <dt>Transit duration</dt><dd>${formatDuration(durationMs)}</dd>
            ${renderPhysicalFactRows(object)}
        </dl>
        <a class="detail-panel__more" href="${buildDetailUrl(object, location, date)}">More details &gt;</a>
    `;
    panel.classList.add('is-open');
    panel.querySelector('.detail-panel__close')?.addEventListener('click', () => {
        panel.classList.remove('is-open', 'is-minimized');
        panel.innerHTML = '';
        document.querySelector('.app-body')?.classList.remove('detail-panel-minimized');
        onClose?.();
    });

    // Collapses the panel to a narrow strip along the side of the screen (see
    // .detail-panel.is-minimized / .app-body.detail-panel-minimized in style.css), so
    // the results column can reclaim the space while still showing which object is
    // selected. Purely a CSS toggle - nothing here depends on app state, so it doesn't
    // need to survive past the next render of this panel (a new object, or a close,
    // already resets it above).
    const minimizeBtn = panel.querySelector('.detail-panel__minimize');
    minimizeBtn?.addEventListener('click', () => {
        const minimized = panel.classList.toggle('is-minimized');
        document.querySelector('.app-body')?.classList.toggle('detail-panel-minimized', minimized);
        minimizeBtn.textContent = minimized ? '‹' : '›';
        minimizeBtn.setAttribute('aria-label', minimized ? 'Expand detail panel' : 'Minimize detail panel');
    });

    // Hidden until isDomeAvailable() confirms Digistar's web interface is answering, so
    // this is a no-op outside the dome (see js/digistar.js).
    // Scene date is the object's next rise, not the planner's selected date (which has
    // no time-of-day once a date is picked) - otherwise the dome could zoom to the
    // object while it's still below the horizon.
    // transitTime is only null in two cases: the object is circumpolar (always above the
    // horizon - getNextRiseTime never finds a rise because it's already up) or it never
    // rises at all. isVisibleAt() disambiguates those; when transitTime IS set, the apex
    // (and so also the rise, which precedes it) is above the horizon, so there's nothing
    // to check.
    const apexBelowHorizon = transitTime ? false : !object.isVisibleAt(location, date);
    panel.appendChild(createDomeControl({
        name: object.name,
        catalog: object.catalog,
        catalogId: object.catalogId,
        date: riseTime,
        lat: location?.latitude,
        lon: location?.longitude,
        locationLabel: location?.label,
        apexBelowHorizon,
    }));
}

export function setLoadingState(container, isLoading) {
    container.classList.toggle('is-loading', isLoading);
}

export function setErrorState(container, message) {
    if (!message) {
        container.classList.remove('has-error');
        return;
    }
    container.classList.add('has-error');
    container.innerHTML = `<p class="error-state">${message}</p>`;
}
