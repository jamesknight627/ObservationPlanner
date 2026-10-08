// Site-wide text size controls (the "A-"/"A+" buttons in each page's header).
// Scales the root font size, which every other size in style.css is defined relative
// to (rem units throughout), so one setting resizes the whole page rather than just
// specific pieces of it.
import { getFontScale, setFontScale } from './storage.js';

const MIN_SCALE = 0.8;
const MAX_SCALE = 1.6;
const STEP = 0.1;

function applyFontScale(scale) {
    document.documentElement.style.fontSize = `${scale * 100}%`;
}

// Applies the saved scale immediately (before the caller even wires up the buttons),
// so there's no flash of default-size text on load.
applyFontScale(getFontScale());

// Finds #font-size-increase/#font-size-decrease on the current page and wires them
// up. Safe to call on a page that doesn't have them (e.g. the setup check page) -
// they're just no-ops then, and the scale set above still applies.
export function initFontSizeControls() {
    const increaseBtn = document.querySelector('#font-size-increase');
    const decreaseBtn = document.querySelector('#font-size-decrease');

    function adjust(delta) {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((getFontScale() + delta) * 100) / 100));
        setFontScale(next);
        applyFontScale(next);
    }

    increaseBtn?.addEventListener('click', () => adjust(STEP));
    decreaseBtn?.addEventListener('click', () => adjust(-STEP));
}
