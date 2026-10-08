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

function positionBar(el, start, end, timelineStart, timelineEnd) {
    const startMs = timelineStart.getTime();
    const endMs = timelineEnd.getTime();
    el.style.left = `${pct(start.getTime(), startMs, endMs)}%`;
    el.style.width = `${pct(end.getTime(), startMs, endMs) - pct(start.getTime(), startMs, endMs)}%`;
}

function isOverridden(entry) {
    return entry.start.getTime() !== entry.originalStart.getTime() ||
        entry.end.getTime() !== entry.originalEnd.getTime();
}

// Wires up drag-to-resize (pointer) and arrow-key (keyboard) adjustment for one edge
// of a bar. `isStart` picks which edge this handle owns; the other edge (read via
// getStart/getEnd) is the clamp boundary, kept at least MIN_SLOT_MINUTES away.
function attachHandleInteractions(handle, track, timelineStart, timelineEnd, { getStart, getEnd, isStart, onPreview, onCommit }) {
    const spanMs = timelineEnd.getTime() - timelineStart.getTime();
    const minGapMs = MIN_SLOT_MINUTES * 60000;

    function clamp(ms) {
        const bound = isStart ? getEnd().getTime() - minGapMs : getStart().getTime() + minGapMs;
        const limited = isStart ? Math.min(ms, bound) : Math.max(ms, bound);
        return Math.min(Math.max(limited, timelineStart.getTime()), timelineEnd.getTime());
    }

    function msFromClientX(clientX, rect) {
        const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        return snapToMinutes(timelineStart.getTime() + fraction * spanMs, SNAP_MINUTES);
    }

    handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        const rect = track.getBoundingClientRect();

        function onMove(ev) {
            onPreview(new Date(clamp(msFromClientX(ev.clientX, rect))));
        }
        function onUp(ev) {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            handle.releasePointerCapture(e.pointerId);
            onCommit(new Date(clamp(msFromClientX(ev.clientX, rect))));
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
        const next = new Date(clamp(currentMs + deltaMs));
        onPreview(next);
        onCommit(next);
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
        if (i % labelStride === 0) {
            tick.classList.add('scheduler__tick--labeled');
            tick.textContent = formatClockTime(new Date(t));
        }
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

function renderRow(entry, timelineStart, timelineEnd, handlers) {
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

    const startHandle = document.createElement('button');
    startHandle.type = 'button';
    startHandle.className = 'scheduler__handle scheduler__handle--start';
    startHandle.setAttribute('aria-label', `Adjust start time for ${entry.object.cardTitle}`);

    const barLabel = document.createElement('span');
    barLabel.className = 'scheduler__bar-label';

    const endHandle = document.createElement('button');
    endHandle.type = 'button';
    endHandle.className = 'scheduler__handle scheduler__handle--end';
    endHandle.setAttribute('aria-label', `Adjust end time for ${entry.object.cardTitle}`);

    bar.append(startHandle, barLabel, endHandle);

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
        barLabel.textContent = `${formatClockTime(start)}–${formatClockTime(end)}`;
        resetBtn.hidden = !isOverridden(entry);
    }
    applyTimes(entry.start, entry.end);

    attachHandleInteractions(startHandle, track, timelineStart, timelineEnd, {
        getStart: () => entry.start,
        getEnd: () => entry.end,
        isStart: true,
        onPreview: (t) => applyTimes(t, entry.end),
        onCommit: (t) => { applyTimes(t, entry.end); handlers.onTimesChange?.(entry, entry.start, entry.end); },
    });
    attachHandleInteractions(endHandle, track, timelineStart, timelineEnd, {
        getStart: () => entry.start,
        getEnd: () => entry.end,
        isStart: false,
        onPreview: (t) => applyTimes(entry.start, t),
        onCommit: (t) => { applyTimes(entry.start, t); handlers.onTimesChange?.(entry, entry.start, entry.end); },
    });

    track.append(ghost, bar);
    row.append(label, track, resetBtn);
    return row;
}

// Tonight's observing schedule as a timeline: one row per favorite that's up on the
// selected date, each a draggable bar spanning its observing window (defaulting to
// rise→set). The original rise/set span stays visible behind the bar as a grayed
// "ghost" so the user can always see how far they've adjusted from it. Favorites that
// aren't up at all that date are named separately below rather than silently dropped.
//
// `entries` is [{ object, originalStart, originalEnd, start, end }] - originalStart/End
// are the natural rise/set (or the timeline's own bounds for a circumpolar object with
// no rise/set that day); start/end are the current, possibly user-adjusted, window.
export function renderScheduler(container, { timelineStart, timelineEnd, entries, notVisibleObjects }, handlers, emptyMessage) {
    container.innerHTML = '';
    if (entries.length === 0 && notVisibleObjects.length === 0) {
        container.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
        return;
    }

    const scheduler = document.createElement('div');
    scheduler.className = 'scheduler';
    scheduler.appendChild(renderRuler(timelineStart, timelineEnd));

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
            rows.appendChild(renderRow(entry, timelineStart, timelineEnd, handlers));
        }
        body.appendChild(rows);

        scheduler.appendChild(body);
    }

    container.appendChild(scheduler);

    if (notVisibleObjects.length > 0) {
        const notVisible = document.createElement('p');
        notVisible.className = 'plan-list__not-visible';
        notVisible.textContent = `Not up on this date: ${notVisibleObjects.map((o) => o.cardTitle).join(', ')}`;
        container.appendChild(notVisible);
    }
}
