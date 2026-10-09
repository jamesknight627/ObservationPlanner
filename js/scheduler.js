import { formatClockTime } from './format.js';

// Smallest allowed bar width when dragging a handle, and the increment times snap to.
const MIN_SLOT_MINUTES = 15;
const SNAP_MINUTES = 5;

function pct(timeMs, startMs, endMs) {
    return ((timeMs - startMs) / (endMs - startMs)) * 100;
}

function snapToMinutes(ms, minutes) {
    const step = minutes * 60000;
    return Math.round(ms / step) * step;
}

// Pixel/time "magnetism" for aligning a dragged edge with another row's current
// start/end - makes it easy to line two objects up back-to-back. Pointer drags use a
// pixel radius (so it feels the same regardless of zoom level); keyboard nudges use a
// fixed time radius instead, since there's no cursor position to derive a pixel radius
// from.
const SNAP_TO_WINDOW_PIXEL_RADIUS = 8;
const SNAP_TO_WINDOW_KEYBOARD_MINUTES = 10;

// Every other row's current start/end, in ms - the targets a dragged edge can snap to.
// Recomputed on every call rather than cached, since other rows' entries mutate in
// place as they're dragged, so this always reflects their live positions, not whatever
// they were when this row was first rendered.
function getSnapTargetsMs(entry, entries) {
    const targets = [];
    for (const other of entries) {
        if (other === entry) continue;
        targets.push(other.start.getTime(), other.end.getTime());
    }
    return targets;
}

// Snaps `ms` to the closest value in `targetsMs` if one is within `thresholdMs` of it;
// otherwise falls back to the plain SNAP_MINUTES grid, same as before snapping to
// other windows existed.
function snapToNearestEdge(ms, targetsMs, thresholdMs) {
    let closest = null;
    let closestDist = Infinity;
    for (const t of targetsMs) {
        const dist = Math.abs(ms - t);
        if (dist < closestDist) {
            closestDist = dist;
            closest = t;
        }
    }
    if (closest != null && closestDist <= thresholdMs) return closest;
    return snapToMinutes(ms, SNAP_MINUTES);
}

function positionBar(el, start, end, timelineStart, timelineEnd) {
    const startMs = timelineStart.getTime();
    const endMs = timelineEnd.getTime();
    el.style.left = `${pct(start.getTime(), startMs, endMs)}%`;
    el.style.width = `${pct(end.getTime(), startMs, endMs) - pct(start.getTime(), startMs, endMs)}%`;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// Fixed and shared by every row's graph (rather than each row scaling to its own
// min/max), so how tall a curve stands directly reflects how high that object actually
// gets - comparable at a glance across every row. The domain extends 20° below the
// horizon (rather than stopping at 0°) so the 0° reference line sits clearly inside the
// chart, with real headroom below it, instead of being squeezed flush against the
// track's own bottom border.
const ALTITUDE_DOMAIN_MIN = -20;
const ALTITUDE_DOMAIN_MAX = 90;

function renderAltitudeGraph(samples) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'scheduler__altitude');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');

    const yFor = (alt) => {
        const clamped = Math.min(ALTITUDE_DOMAIN_MAX, Math.max(ALTITUDE_DOMAIN_MIN, alt));
        return 100 - ((clamped - ALTITUDE_DOMAIN_MIN) / (ALTITUDE_DOMAIN_MAX - ALTITUDE_DOMAIN_MIN)) * 100;
    };
    const points = samples.map((alt, i) => ({
        x: (i / (samples.length - 1)) * 100,
        y: yFor(alt),
    }));

    const areaPath = document.createElementNS(SVG_NS, 'path');
    const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
    areaPath.setAttribute('class', 'scheduler__altitude-area');
    areaPath.setAttribute('d', `M0,100 L${linePoints} L100,100 Z`);

    const line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('class', 'scheduler__altitude-line');
    line.setAttribute('points', linePoints);

    // The 0° reference line, at its real proportional position in the domain (now that
    // ALTITUDE_DOMAIN_MIN is below 0°, that's no longer the same as the chart's bottom
    // edge).
    const horizon = document.createElementNS(SVG_NS, 'line');
    horizon.setAttribute('class', 'scheduler__altitude-horizon');
    horizon.setAttribute('x1', '0');
    horizon.setAttribute('x2', '100');
    horizon.setAttribute('y1', String(yFor(0)));
    horizon.setAttribute('y2', String(yFor(0)));

    svg.append(areaPath, line, horizon);
    return svg;
}

function isOverridden(entry) {
    return entry.start.getTime() !== entry.originalStart.getTime() ||
        entry.end.getTime() !== entry.originalEnd.getTime();
}

// Wires up drag-to-resize (pointer) and arrow-key (keyboard) adjustment for one edge
// of a bar. `isStart` picks which edge this handle owns; the other edge (read via
// getStart/getEnd) is the clamp boundary, kept at least MIN_SLOT_MINUTES away. The
// moved edge snaps to another row's current start/end when it's dragged close to one
// (see snapToNearestEdge), falling back to the plain time grid otherwise.
function attachHandleInteractions(handle, track, timelineStart, timelineEnd, { getStart, getEnd, isStart, entry, entries, onPreview, onCommit }) {
    const spanMs = timelineEnd.getTime() - timelineStart.getTime();
    const minGapMs = MIN_SLOT_MINUTES * 60000;

    function clamp(ms) {
        const bound = isStart ? getEnd().getTime() - minGapMs : getStart().getTime() + minGapMs;
        const limited = isStart ? Math.min(ms, bound) : Math.max(ms, bound);
        return Math.min(Math.max(limited, timelineStart.getTime()), timelineEnd.getTime());
    }

    function snappedMsFromClientX(clientX, rect) {
        const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        const rawMs = timelineStart.getTime() + fraction * spanMs;
        const thresholdMs = SNAP_TO_WINDOW_PIXEL_RADIUS * (spanMs / rect.width);
        return snapToNearestEdge(rawMs, getSnapTargetsMs(entry, entries), thresholdMs);
    }

    handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation(); // don't also trigger the bar's own whole-window drag
        handle.setPointerCapture(e.pointerId);
        const rect = track.getBoundingClientRect();

        function onMove(ev) {
            onPreview(new Date(clamp(snappedMsFromClientX(ev.clientX, rect))));
        }
        function onUp(ev) {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            handle.releasePointerCapture(e.pointerId);
            onCommit(new Date(clamp(snappedMsFromClientX(ev.clientX, rect))));
        }
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    });

    handle.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const stepMs = (e.shiftKey ? 30 : SNAP_MINUTES) * 60000;
        const deltaMs = e.key === 'ArrowRight' ? stepMs : -stepMs;
        const currentMs = (isStart ? getStart() : getEnd()).getTime();
        const rawMs = currentMs + deltaMs;
        const thresholdMs = SNAP_TO_WINDOW_KEYBOARD_MINUTES * 60000;
        const snapped = snapToNearestEdge(rawMs, getSnapTargetsMs(entry, entries), thresholdMs);
        const next = new Date(clamp(snapped));
        onPreview(next);
        onCommit(next);
    });
}

// Wires up drag-to-move (pointer) and arrow-key (keyboard) adjustment for a bar as a
// whole - shifts both start and end together by the same amount, so a window's
// duration never changes from a move the way it would from a handle resize. Tracks
// the offset between the initial grab point and the window's start, so the bar shifts
// by exactly how far the pointer moves rather than jumping to align an edge with the
// cursor (which is the right behavior for a handle, but not for grabbing the middle).
//
// Snapping tries the dragged window's start *and* end against every other row's
// current start/end (as candidate start positions, via snapToEdgeStartCandidates),
// so it catches all four meaningful back-to-back alignments - this window starting or
// ending flush with another's start or end - in one search.
function snapToEdgeStartCandidates(rawStartMs, durationMs, targetsMs, thresholdMs) {
    const candidates = targetsMs.flatMap((t) => [t, t - durationMs]);
    return snapToNearestEdge(rawStartMs, candidates, thresholdMs);
}

function attachBarMoveInteraction(bar, track, timelineStart, timelineEnd, { getStart, getEnd, entry, entries, onPreview, onCommit }) {
    const timelineStartMs = timelineStart.getTime();
    const timelineEndMs = timelineEnd.getTime();
    const spanMs = timelineEndMs - timelineStartMs;

    function clampStart(startMs, durationMs) {
        return Math.min(Math.max(startMs, timelineStartMs), timelineEndMs - durationMs);
    }

    bar.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        bar.setPointerCapture(e.pointerId);
        const rect = track.getBoundingClientRect();
        const durationMs = getEnd().getTime() - getStart().getTime();
        const initialStartMs = getStart().getTime();
        const grabClientX = e.clientX;
        const thresholdMs = SNAP_TO_WINDOW_PIXEL_RADIUS * (spanMs / rect.width);

        function startFromClientX(clientX) {
            const deltaFraction = (clientX - grabClientX) / rect.width;
            const rawStartMs = initialStartMs + deltaFraction * spanMs;
            const targets = getSnapTargetsMs(entry, entries);
            const snapped = snapToEdgeStartCandidates(rawStartMs, durationMs, targets, thresholdMs);
            return clampStart(snapped, durationMs);
        }

        function onMove(ev) {
            const startMs = startFromClientX(ev.clientX);
            onPreview(new Date(startMs), new Date(startMs + durationMs));
        }
        function onUp(ev) {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            bar.releasePointerCapture(e.pointerId);
            const startMs = startFromClientX(ev.clientX);
            onCommit(new Date(startMs), new Date(startMs + durationMs));
        }
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    });

    bar.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const stepMs = (e.shiftKey ? 30 : SNAP_MINUTES) * 60000;
        const deltaMs = e.key === 'ArrowRight' ? stepMs : -stepMs;
        const durationMs = getEnd().getTime() - getStart().getTime();
        const rawStartMs = getStart().getTime() + deltaMs;
        const thresholdMs = SNAP_TO_WINDOW_KEYBOARD_MINUTES * 60000;
        const targets = getSnapTargetsMs(entry, entries);
        const startMs = clampStart(snapToEdgeStartCandidates(rawStartMs, durationMs, targets, thresholdMs), durationMs);
        onPreview(new Date(startMs), new Date(startMs + durationMs));
        onCommit(new Date(startMs), new Date(startMs + durationMs));
    });
}

const HOUR_MS = 60 * 60000;

// Every whole-hour timestamp from timelineStart to timelineEnd - shared by the ruler's
// ticks and the gridlines behind the rows, so the two always line up.
function hourMarks(timelineStart, timelineEnd) {
    const startMs = timelineStart.getTime();
    const endMs = timelineEnd.getTime();
    const marks = [];
    for (let t = Math.ceil(startMs / HOUR_MS) * HOUR_MS; t <= endMs; t += HOUR_MS) {
        marks.push(t);
    }
    return marks;
}

// Above roughly this many hour marks, labeling every single one starts to crowd them
// into each other, so every hour still gets a tick mark but only every Nth one is
// labeled with a time - the same convention as minor/major ticks on a ruler.
const MAX_LABELED_TICKS = 10;

function renderRuler(timelineStart, timelineEnd) {
    const ruler = document.createElement('div');
    ruler.className = 'scheduler__ruler';

    const spacer = document.createElement('div');
    spacer.className = 'scheduler__label-spacer';
    ruler.appendChild(spacer);

    const track = document.createElement('div');
    track.className = 'scheduler__ruler-track';

    const startMs = timelineStart.getTime();
    const endMs = timelineEnd.getTime();
    const marks = hourMarks(timelineStart, timelineEnd);
    const labelStride = Math.max(1, Math.ceil(marks.length / MAX_LABELED_TICKS));

    marks.forEach((t, i) => {
        const tick = document.createElement('span');
        tick.className = 'scheduler__tick';
        tick.style.left = `${pct(t, startMs, endMs)}%`;

        const isLabeled = i % labelStride === 0;
        if (isLabeled) {
            tick.classList.add('scheduler__tick--labeled');
            const label = document.createElement('span');
            label.className = 'scheduler__tick-label';
            label.textContent = formatClockTime(new Date(t));
            tick.appendChild(label);
        }

        const mark = document.createElement('span');
        mark.className = 'scheduler__tick-mark';
        tick.appendChild(mark);

        track.appendChild(tick);
    });

    ruler.appendChild(track);
    return ruler;
}

// One vertical line per whole hour, as a single overlay behind the row list rather than
// per-row, so the lines run continuously through every object's track - including
// through the gaps between rows - instead of resetting at each row's own edges.
function renderGridlines(timelineStart, timelineEnd) {
    const gridlines = document.createElement('div');
    gridlines.className = 'scheduler__gridlines';

    const startMs = timelineStart.getTime();
    const endMs = timelineEnd.getTime();
    for (const t of hourMarks(timelineStart, timelineEnd)) {
        const line = document.createElement('span');
        line.className = 'scheduler__gridline';
        line.style.left = `${pct(t, startMs, endMs)}%`;
        gridlines.appendChild(line);
    }

    return gridlines;
}

// Which sunMarks field goes with which label, line style, and legend entry. `kind` is
// unique per mark (not shared between e.g. sunset/sunrise) so every line gets its own
// distinct color/pattern - see the .scheduler__sun-mark--* rules in style.css. `tier`
// puts the two members of each close-together pair (sunset/duskCivil at dusk,
// dawnCivil/sunrise at dawn) on alternating lines above the timeline instead of
// overlapping each other.
const SUN_MARK_DEFS = [
    { key: 'sunset', label: 'Sunset', kind: 'sunset', tier: 0 },
    { key: 'duskCivil', label: 'Civil dusk', kind: 'civil-dusk', tier: 1 },
    { key: 'dawnCivil', label: 'Civil dawn', kind: 'civil-dawn', tier: 1 },
    { key: 'sunrise', label: 'Sunrise', kind: 'sunrise', tier: 0 },
];

// The legend lists every line used on the scheduler, including the per-row horizon
// reference line, which isn't one of the sunMarks crossings but shares the same visual
// language (a distinctly colored/patterned line meaning a specific altitude or moment).
const LEGEND_ITEMS = [
    ...SUN_MARK_DEFS.map(({ kind, label }) => ({ kind, label })),
    { kind: 'horizon', label: 'Horizon (0° altitude)' },
];

function hasAnySunMark(sunMarks) {
    return !!sunMarks && SUN_MARK_DEFS.some(({ key }) => sunMarks[key]);
}

// One <span> per sunset/sunrise/civil-twilight crossing present in sunMarks, left-
// positioned (as a percentage, 0-100) to its moment on the timeline. Used both for the
// full-height overlay (renderSunMarkOverlay) and, appended straight into a row's own
// track, so each row's line stays visible crossing its altitude graph/ghost/bar rather
// than being hidden behind their backgrounds (the overlay alone only shows in the gaps
// between rows, since a track's own background would otherwise cover it).
//
// `trimToLabels` tags each span with its tier (see .scheduler__sun-mark--tier0/--tier1
// in style.css), which stops it a few pixels below its own flag's text instead of
// running the line through the reserved label row's full height - only meaningful for
// the full-height overlay; a row's own copy is already scoped to just that row's track.
function buildSunMarkSpans(timelineStart, timelineEnd, sunMarks, { trimToLabels = false } = {}) {
    if (!sunMarks) return [];
    const startMs = timelineStart.getTime();
    const endMs = timelineEnd.getTime();
    const spans = [];
    for (const { key, kind, tier } of SUN_MARK_DEFS) {
        const time = sunMarks[key];
        if (!time) continue;
        const mark = document.createElement('span');
        mark.className = `scheduler__sun-mark scheduler__sun-mark--${kind}`;
        if (trimToLabels) mark.classList.add(`scheduler__sun-mark--tier${tier}`);
        mark.style.left = `${pct(time.getTime(), startMs, endMs)}%`;
        spans.push(mark);
    }
    return spans;
}

// The sunset/sunrise/civil-twilight lines as one overlay spanning the *entire* scheduler
// (labels row + ruler + body), not just the row list, so each line visibly runs from its
// time-labeled flag at the top all the way down through the timeline - see the "inset: 0"
// on .scheduler__sun-marks and "position: relative" on .scheduler itself.
function renderSunMarkOverlay(timelineStart, timelineEnd, sunMarks) {
    const container = document.createElement('div');
    container.className = 'scheduler__sun-marks';
    container.append(...buildSunMarkSpans(timelineStart, timelineEnd, sunMarks, { trimToLabels: true }));
    return container;
}

// A compact key for every line used on the scheduler - the four sunset/sunrise/civil-
// twilight crossings plus the per-row horizon reference - so their colors/patterns are
// explained rather than left for the user to guess. Each swatch reuses the exact same
// classes as the real line, so it can never drift out of sync with how the lines
// actually render.
function renderLegend() {
    const table = document.createElement('table');
    table.className = 'scheduler__legend';

    const tbody = document.createElement('tbody');
    for (const { kind, label } of LEGEND_ITEMS) {
        const row = document.createElement('tr');

        const swatchCell = document.createElement('td');
        swatchCell.className = 'scheduler__legend-swatch-cell';
        const swatch = document.createElement('span');
        swatch.className = `scheduler__legend-swatch scheduler__legend-swatch--${kind}`;
        swatchCell.appendChild(swatch);

        const labelCell = document.createElement('td');
        labelCell.textContent = label;

        row.append(swatchCell, labelCell);
        tbody.appendChild(row);
    }
    table.appendChild(tbody);

    return table;
}

// A row of small time-labeled flags above the ruler, one per sunset/sunrise/civil-
// twilight crossing, x-positioned to line up with their vertical lines in the body
// below. Lives in its own fixed-height track (rather than floating labels up from the
// lines themselves) so two close-together flags (e.g. sunset and civil dusk) can stack
// into tiers without ever growing past their reserved space into the page above.
function renderSunLabelsRow(timelineStart, timelineEnd, sunMarks) {
    const row = document.createElement('div');
    row.className = 'scheduler__sun-labels';

    const spacer = document.createElement('div');
    spacer.className = 'scheduler__label-spacer';
    row.appendChild(spacer);

    const track = document.createElement('div');
    track.className = 'scheduler__sun-labels-track';

    const startMs = timelineStart.getTime();
    const endMs = timelineEnd.getTime();
    for (const { key, label, kind, tier } of SUN_MARK_DEFS) {
        const time = sunMarks[key];
        if (!time) continue;

        const flag = document.createElement('span');
        flag.className = `scheduler__sun-mark-label scheduler__sun-mark-label--${kind} scheduler__sun-mark-label--tier${tier}`;
        flag.style.left = `${pct(time.getTime(), startMs, endMs)}%`;
        flag.textContent = `${label} ${formatClockTime(time)}`;
        track.appendChild(flag);
    }

    row.appendChild(track);
    return row;
}

function renderRow(entry, entries, timelineStart, timelineEnd, handlers, sunMarks) {
    const row = document.createElement('li');
    row.className = 'scheduler__row';

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'scheduler__label';
    label.textContent = entry.object.cardTitle;
    label.addEventListener('click', () => handlers.onSelect?.(entry.object));

    const track = document.createElement('div');
    track.className = 'scheduler__track';

    const ghost = document.createElement('div');
    ghost.className = 'scheduler__ghost';
    positionBar(ghost, entry.originalStart, entry.originalEnd, timelineStart, timelineEnd);

    const bar = document.createElement('div');
    bar.className = 'scheduler__bar';
    bar.tabIndex = 0;
    bar.setAttribute('aria-label', `Move observing window for ${entry.object.cardTitle}`);

    const startHandle = document.createElement('button');
    startHandle.type = 'button';
    startHandle.className = 'scheduler__handle scheduler__handle--start';
    startHandle.setAttribute('aria-label', `Adjust start time for ${entry.object.cardTitle}`);

    const endHandle = document.createElement('button');
    endHandle.type = 'button';
    endHandle.className = 'scheduler__handle scheduler__handle--end';
    endHandle.setAttribute('aria-label', `Adjust end time for ${entry.object.cardTitle}`);

    bar.append(startHandle, endHandle);

    // A direct child of the track, not of the bar - the bar (and everything else that
    // paints inside the track) is clipped to the track's rounded corners by the inner
    // .scheduler__track-content wrapper below, but the label sits just *above* the
    // track, so it has to live outside that clipped wrapper to avoid being cut off.
    const barLabel = document.createElement('span');
    barLabel.className = 'scheduler__bar-label';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'scheduler__reset';
    resetBtn.title = 'Reset to rise/set times';
    resetBtn.setAttribute('aria-label', `Reset ${entry.object.cardTitle} to its rise/set times`);
    resetBtn.textContent = '↺';
    resetBtn.addEventListener('click', () => handlers.onResetTimes?.(entry));

    function applyTimes(start, end) {
        entry.start = start;
        entry.end = end;
        positionBar(bar, start, end, timelineStart, timelineEnd);
        const midpointMs = (start.getTime() + end.getTime()) / 2;
        barLabel.style.left = `${pct(midpointMs, timelineStart.getTime(), timelineEnd.getTime())}%`;
        barLabel.textContent = `${formatClockTime(start)}–${formatClockTime(end)}`;
        resetBtn.hidden = !isOverridden(entry);
    }
    applyTimes(entry.start, entry.end);

    attachHandleInteractions(startHandle, track, timelineStart, timelineEnd, {
        getStart: () => entry.start,
        getEnd: () => entry.end,
        isStart: true,
        entry,
        entries,
        onPreview: (t) => applyTimes(t, entry.end),
        onCommit: (t) => { applyTimes(t, entry.end); handlers.onTimesChange?.(entry, entry.start, entry.end); },
    });
    attachHandleInteractions(endHandle, track, timelineStart, timelineEnd, {
        getStart: () => entry.start,
        getEnd: () => entry.end,
        isStart: false,
        entry,
        entries,
        onPreview: (t) => applyTimes(entry.start, t),
        onCommit: (t) => { applyTimes(entry.start, t); handlers.onTimesChange?.(entry, entry.start, entry.end); },
    });
    attachBarMoveInteraction(bar, track, timelineStart, timelineEnd, {
        getStart: () => entry.start,
        getEnd: () => entry.end,
        entry,
        entries,
        onPreview: (s, en) => applyTimes(s, en),
        onCommit: (s, en) => { applyTimes(s, en); handlers.onTimesChange?.(entry, entry.start, entry.end); },
    });

    const content = document.createElement('div');
    content.className = 'scheduler__track-content';
    const parts = [];
    if (entry.altitudeSamples) parts.push(renderAltitudeGraph(entry.altitudeSamples));
    parts.push(...buildSunMarkSpans(timelineStart, timelineEnd, sunMarks));
    parts.push(ghost, bar);
    content.append(...parts);

    track.append(content, barLabel);
    row.append(label, track, resetBtn);
    return row;
}

// Tonight's observing schedule as a timeline: one row per favorite that's up on the
// selected date, each a draggable bar spanning its observing window (defaulting to
// rise→set). The original rise/set span stays visible behind the bar as a grayed
// "ghost" so the user can always see how far they've adjusted from it. Favorites that
// aren't up at all that date are named separately below rather than silently dropped.
//
// `entries` is [{ object, originalStart, originalEnd, start, end, altitudeSamples }] -
// originalStart/End are the natural rise/set (or the timeline's own bounds for a
// circumpolar object with no rise/set that day); start/end are the current, possibly
// user-adjusted, window; altitudeSamples (optional) is the object's altitude in degrees
// at evenly-spaced points across the whole timeline, plotted as the track's background.
// `sunMarks` (optional) is { sunset, duskCivil, dawnCivil, sunrise }, each a Date or null
// (see findSunMarks() in js/app.js) - drawn as vertical lines through every row.
export function renderScheduler(container, { timelineStart, timelineEnd, entries, notVisibleObjects, sunMarks }, handlers, emptyMessage) {
    container.innerHTML = '';
    if (entries.length === 0 && notVisibleObjects.length === 0) {
        container.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
        return;
    }

    const scheduler = document.createElement('div');
    scheduler.className = 'scheduler';
    const hasSunMarks = hasAnySunMark(sunMarks);
    if (hasSunMarks) {
        scheduler.appendChild(renderSunLabelsRow(timelineStart, timelineEnd, sunMarks));
    }
    scheduler.appendChild(renderRuler(timelineStart, timelineEnd));
    // Spans the *whole* scheduler (appended here, not inside the body below), so each
    // line visibly runs from its flag at the top down through the ruler, the gaps
    // between rows, and - via the matching spans renderRow() adds to each row's own
    // track - every row's bar and altitude graph too.
    if (hasSunMarks) {
        scheduler.appendChild(renderSunMarkOverlay(timelineStart, timelineEnd, sunMarks));
    }

    if (entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'None of your saved objects are up on this date.';
        scheduler.appendChild(empty);
    } else {
        const body = document.createElement('div');
        body.className = 'scheduler__body';
        body.appendChild(renderGridlines(timelineStart, timelineEnd));

        const rows = document.createElement('ol');
        rows.className = 'scheduler__rows';
        for (const entry of entries) {
            rows.appendChild(renderRow(entry, entries, timelineStart, timelineEnd, handlers, sunMarks));
        }
        body.appendChild(rows);

        scheduler.appendChild(body);
    }

    container.appendChild(scheduler);

    if (entries.length > 0) {
        container.appendChild(renderLegend());
    }

    if (notVisibleObjects.length > 0) {
        const notVisible = document.createElement('p');
        notVisible.className = 'plan-list__not-visible';
        notVisible.textContent = `Not up on this date: ${notVisibleObjects.map((o) => o.cardTitle).join(', ')}`;
        container.appendChild(notVisible);
    }
}
