// js/digistar.js — sends the selected object to the planetarium dome.
//
// Designed to be hosted on Digistar's own built-in web server (put the project
// in a folder under $Content and open http://<DSHost>/content/<that folder>/).
// The page is then on the same origin as Digistar's HTTP command interface
// (Users Guide: JavaScript Web Scripting > HTTP Digistar Commands), so it can
// send commands and read the replies directly.
//
// Anywhere else (GitHub Pages, `npx serve .`), the connection check fails and
// the dome controls never appear, so the same files work as a plain planner.

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const DOME_SETTINGS = {
    // Move the dome's observer location and scene date to match the planner.
    // Uses "sky on", which briefly fades the dome to black and back.
    syncSky: true,

    // Narrow the dome's field of view onto the object after pointing at it.
    zoomIn: true,
    slewSeconds: 5,
    zoomSeconds: 10,
};

// Digistar's command endpoint. The guide's reference table uses /digistar/execute;
// its sample page uses /software/execute. If commands fail with HTTP 404, try that.
const EXECUTE_PATH = "/digistar/execute";

// Read-only attribute used to check that Digistar's web interface is answering.
const PROBE_PATH = "/digistar/objects/eye/intensity";

const TIMEOUT_MS = 4000;

// Digistar's celestial position commands need a distance. The catalog has none,
// and from Earth only the direction matters, so any large value works.
const NOMINAL_DISTANCE_LY = 1000;

// ---------------------------------------------------------------------------
// Digistar commands. Every command comes from the Digistar 7 Users Guide
// ("Zoom into an Object in the Sky", navigation location, scene date, and
// scene zoomFOV references). Only validated numbers go into them.
// ---------------------------------------------------------------------------

// Date -> "2026-09-11 03:00:00" in UT, Digistar's default time scale.
function toDigistarDate(date) {
    return date.toISOString().slice(0, 19).replace("T", " ");
}

// Frame the object at about 4x its size, within sensible limits.
function fieldOfViewFor(sizeArcmin) {
    if (!sizeArcmin) return 10;
    const degrees = (sizeArcmin / 60) * 4;
    return Math.min(30, Math.max(0.5, degrees)).toFixed(2);
}

function isNumberIn(value, min, max) {
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function buildGotoCommands(target) {
    const { ra, dec, size, date, lat, lon } = target;
    if (!isNumberIn(ra, 0, 360) || !isNumberIn(dec, -90, 90)) {
        throw new Error("This object has no usable coordinates");
    }

    const commands = [];
    if (DOME_SETTINGS.syncSky && isNumberIn(lat, -90, 90) && isNumberIn(lon, -180, 180)) {
        commands.push(`navigation location ${lat} ${lon} ground 20 180 duration 0`);
    }
    if (DOME_SETTINGS.syncSky && date instanceof Date && !Number.isNaN(date.getTime())) {
        commands.push(`scene date ${toDigistarDate(date)} ut`);
    }
    if (commands.length > 0) {
        commands.push("sky on"); // re-display the sky for the new location/date
    }

    // Digistar takes right ascension in HOURS; the planner stores degrees.
    const raHours = (ra / 15).toFixed(5);
    commands.push(
        `telescope zoom position celestial ${raHours} ${dec.toFixed(5)} ${NOMINAL_DISTANCE_LY} ly duration ${DOME_SETTINGS.slewSeconds}`,
        "zoomTarget on",
    );

    if (DOME_SETTINGS.zoomIn) {
        const fov = fieldOfViewFor(isNumberIn(size, 0, 10_000) ? size : null);
        commands.push(`scene zoomFOV ${fov} duration ${DOME_SETTINGS.zoomSeconds} 1 8`);
    }
    return commands;
}

function buildResetCommands() {
    return [
        "telescope zoom stop",
        "zoomTarget off",
        `scene zoomFOV 180 duration ${DOME_SETTINGS.slewSeconds}`,
    ];
}

// ---------------------------------------------------------------------------
// Talking to Digistar
// ---------------------------------------------------------------------------
async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, { signal: controller.signal, cache: "no-store" });
    } catch (err) {
        if (err.name === "AbortError") throw new Error("Digistar didn't answer in time");
        throw new Error("Couldn't reach Digistar's web interface");
    } finally {
        clearTimeout(timer);
    }
}

// Digistar replies with XML: an empty <string/> on success, or text such as
// "Error: 'bad' is not defined" when a command fails.
function readDigistarReply(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    return (doc.documentElement?.textContent ?? "").trim();
}

async function executeCommand(command) {
    const response = await fetchWithTimeout(`${EXECUTE_PATH}?command=${encodeURIComponent(command)}`);
    if (!response.ok) throw new Error(`Digistar's web interface returned HTTP ${response.status}`);

    const reply = readDigistarReply(await response.text());
    if (/^error/i.test(reply)) throw new Error(`Digistar rejected "${command}": ${reply}`);
    return reply;
}

// Sends commands one at a time, in order, stopping at the first error.
async function sendCommands(commands) {
    for (const command of commands) {
        await executeCommand(command);
    }
}

// Checked once per page load and shared by every dome control.
let availability;
export function isDomeAvailable() {
    availability ??= fetchWithTimeout(PROBE_PATH)
        .then(async (response) => {
            if (!response.ok) return false;
            // Make sure this is really Digistar answering, not some other server.
            return (await response.text()).includes("schemas.microsoft.com");
        })
        .catch(() => false);
    return availability;
}

/**
 * Points the dome at a target.
 * @param {{name: string, ra: number, dec: number, size?: number, date?: Date, lat?: number, lon?: number}} target
 *   ra and dec in DEGREES (converted to hours for Digistar); size in arcminutes;
 *   date as a Date; lat/lon in degrees (east positive).
 */
export function sendToDome(target) {
    return sendCommands(buildGotoCommands(target));
}

// Stops tracking, hides the zoom target, and zooms back out to the full dome.
export function resetDome() {
    return sendCommands(buildResetCommands());
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

/**
 * Builds the "Show on dome" control for the detail panel. Returns a hidden
 * element immediately and reveals it only if Digistar's web interface answers.
 */
export function createDomeControl(target) {
    const wrapper = document.createElement("div");
    wrapper.className = "dome-control";
    wrapper.hidden = true;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "dome-button";
    button.textContent = "Show on dome";

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "dome-button dome-button--secondary";
    resetButton.textContent = "Reset dome view";

    const status = document.createElement("span");
    status.className = "dome-control__status";
    status.setAttribute("aria-live", "polite");

    // Runs one dome action with shared busy/success/error handling.
    async function run(action, busyText, successText) {
        button.disabled = true;
        resetButton.disabled = true;
        status.classList.remove("is-error");
        status.textContent = busyText;
        try {
            await action();
            status.textContent = successText;
        } catch (err) {
            status.classList.add("is-error");
            status.textContent = err.message;
        } finally {
            button.disabled = false;
            resetButton.disabled = false;
        }
    }

    button.addEventListener("click", () =>
        run(() => sendToDome(target), "Sending…", `${target.name} is on the dome`));
    resetButton.addEventListener("click", () =>
        run(resetDome, "Resetting…", "Dome view reset"));

    wrapper.append(button, resetButton, status);
    isDomeAvailable().then((available) => { wrapper.hidden = !available; });
    return wrapper;
}
