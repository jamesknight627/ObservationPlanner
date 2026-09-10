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
} from './format.js';
import { getTypeLabel } from './typeLabels.js';

export function renderObjectCard(object, { onSelect, onToggleFavorite } = {}) {
    const card = document.createElement('article');
    card.className = 'object-card';
    card.tabIndex = 0;
    card.dataset.catalog = object.catalog;
    card.dataset.catalogId = object.catalogId;

    const favorited = isFavorite(object.catalog, object.catalogId);
    if (favorited) card.classList.add('is-favorite');

    const catalogLabel = `${object.catalog ?? ''}${object.catalogId ?? ''}`;
    const title = object.properName ? `${object.properName} (${catalogLabel})` : catalogLabel;
    const { equipment } = object.getObservingGuide();

    card.innerHTML = `
        <button class="favorite-toggle" aria-label="Toggle favorite" aria-pressed="${favorited}">★</button>
        <h3 class="object-card__name">${title}</h3>
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

export function renderDetailPanel(panel, object, { visibility, location, date, onClose } = {}) {
    const { riseTime, transitTime, setTime, durationMs, maxAltitudeDeg } = visibility ?? {};

    const nameRow = object.properName
        ? `<dt>Name</dt><dd>${object.properName}</dd>`
        : '';

    const locationRow = location
        ? `<dt>From location</dt><dd>${location.label ?? formatCoords(location)}</dd>`
        : '';

    panel.innerHTML = `
        <button class="detail-panel__close" aria-label="Close detail panel">×</button>
        <h2>${object.catalog ?? ''} ${object.catalogId ?? ''}</h2>
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
        </dl>
        <a class="detail-panel__more" href="${buildDetailUrl(object, location, date)}">More details →</a>
    `;
    panel.classList.add('is-open');
    panel.querySelector('.detail-panel__close')?.addEventListener('click', () => {
        panel.classList.remove('is-open');
        panel.innerHTML = '';
        onClose?.();
    });
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
