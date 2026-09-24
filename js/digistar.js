// js/digistar.js — adds the selected object to the planetarium dome, with its
// marker and label, using Digistar's built-in named system objects.
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
};

// Digistar's command endpoint. The guide's reference table uses /digistar/execute;
// its sample page uses /software/execute. If commands fail with HTTP 404, try that.
const EXECUTE_PATH = "/digistar/execute";

// Read-only attribute used to check that Digistar's web interface is answering.
const PROBE_PATH = "/digistar/objects/eye/intensity";

const TIMEOUT_MS = 4000;

// ---------------------------------------------------------------------------
// Which objects Digistar has as built-in named system objects (Digistar 7
// User's Guide's system object list), each with three paired objects: the
// image itself ("M13"), its marker ("M13Marker"), and its label ("M13Label").
// Anything outside this set - the rest of the deep-sky catalog, and all
// solar-system bodies (which use an internal catalog code with no Digistar
// counterpart) - isn't in Digistar's built-in library.
// ---------------------------------------------------------------------------

// Digistar's Messier objects run M1 through M110.
function isSupportedMessierId(catalogId) {
    return Number.isInteger(catalogId) && catalogId >= 1 && catalogId <= 110;
}

const SUPPORTED_NGC_NUMBERS = new Set([
    17, 40, 55, 88, 104, 134, 185, 246, 253, 265, 281, 290, 300, 346, 362, 545, 457, 520, 602, 604,
    613, 663, 695, 772, 869, 884, 891, 908, 936, 1023, 1097, 1132, 1232, 1275, 1288, 1291, 1300,
    1309, 1313, 1316, 1350, 1365, 1448, 1491, 1501, 1512, 1514, 1532, 1535, 1559, 1569, 1614, 1672,
    1705, 1748, 1788, 1792, 1850, 1851, 1931, 1999, 2022, 2024, 2070, 2074, 2081, 2093, 2108, 2194,
    2207, 2237, 2261, 2264, 2280, 2359, 2371, 2392, 2403, 2440, 2442, 2467, 2477, 2516, 2539, 2547,
    2613, 2655, 2683, 2736, 2770, 2808, 2818, 2841, 2903, 2997, 3021, 3079, 3114, 3115, 3132, 3184,
    3190, 3201, 3242, 3256, 3293, 3310, 3314, 3344, 3370, 3372, 3384, 3521, 3532, 3603, 3607, 3628,
    3690, 3766, 3877, 3918, 3941, 3949, 3982, 4026, 4038, 4088, 4111, 4157, 4163, 4214, 4216, 4244,
    4274, 4319, 4361, 4388, 4414, 4438, 4449, 4458, 4490, 4494, 4517, 4526, 4535, 4559, 4565, 4567,
    4605, 4622, 4631, 4639, 4656, 4660, 4676, 4699, 4710, 4725, 4755, 4762, 4833, 4881, 4945, 5005,
    5033, 5090, 5128, 5139, 5256, 5257, 5331, 5466, 5679, 5746, 5907, 6050, 6067, 6090, 6118, 6210,
    6217, 6231, 6240, 6302, 6334, 6357, 6369, 6388, 6397, 6445, 6503, 6520, 6541, 6543, 6572, 6621,
    6633, 6670, 6712, 6744, 6751, 6752, 6769, 6781, 6782, 6786, 6818, 6819, 6822, 6826, 6872, 6888,
    6939, 6940, 6946, 6992, 7000, 7009, 7027, 7129, 7293, 7318, 7331, 7424, 7469, 7635, 7662, 7674,
    7742, 7789, 7793,
]);

// Maps a planner object to its Digistar system object name ("M13", "NGC40"), or
// null if it isn't one of Digistar's built-in objects.
function digistarNameFor({ catalog, catalogId }) {
    if (catalog === "M" && isSupportedMessierId(catalogId)) return `M${catalogId}`;
    if (catalog === "NGC" && SUPPORTED_NGC_NUMBERS.has(catalogId)) return `NGC${catalogId}`;
    return null;
}

// ---------------------------------------------------------------------------
// Digistar commands. navigation location/scene date/sky on come from the
// Digistar 7 Users Guide's JavaScript Web Scripting reference; the object
// add/on/off commands come from its System Objects reference.
// ---------------------------------------------------------------------------

// Date -> "2026-09-11 03:00:00" in UT, Digistar's default time scale.
function toDigistarDate(date) {
    return date.toISOString().slice(0, 19).replace("T", " ");
}

function isNumberIn(value, min, max) {
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function buildSyncCommands(date, lat, lon) {
    const commands = [];
    if (DOME_SETTINGS.syncSky && isNumberIn(lat, -90, 90) && isNumberIn(lon, -180, 180)) {
        commands.push(`navigation location ${lat} ${lon} ground 20 180 duration 0`);
    }
    if (DOME_SETTINGS.syncSky && date instanceof Date && !Number.isNaN(date.getTime())) {
        // No trailing "ut" scale keyword: some Digistar 7 installs reject it as an
        // unexpected token even though the User's Guide documents it. UT is the
        // default time scale anyway (see toDigistarDate() above), so omitting it
        // doesn't change what gets sent.
        commands.push(`scene date ${toDigistarDate(date)}`);
    }
    if (commands.length > 0) {
        commands.push("sky on"); // re-display the sky for the new location/date
    }
    return commands;
}

// Adds the object's image to the scene, then turns on its marker and label.
// Only the image needs "scene add" first - confirmed on real hardware that its
// marker turns on directly without it. The label is assumed to behave the same
// way (both are lightweight objects paired with the image, per the User's
// Guide's System Objects reference) but that specific case hasn't been tested
// yet; if it turns out to need its own "scene add <name>Label" first, add it
// here.
function buildShowCommands(digistarName) {
    return [
        `scene add ${digistarName}`,
        `${digistarName} on`,
        `${digistarName}Marker on`,
        `${digistarName}Label on`,
    ];
}

function buildHideCommands(digistarName) {
    return [`${digistarName} off`, `${digistarName}Marker off`, `${digistarName}Label off`];
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
    // Plain "if" rather than ??= : Digistar 7's embedded browser is Chromium 84
    // in some releases, and ??= only arrived in Chrome 85.
    if (availability) return availability;
    availability = fetchWithTimeout(PROBE_PATH)
        .then(async (response) => {
            if (!response.ok) return false;
            // Make sure this is really Digistar answering, not some other server.
            return (await response.text()).includes("schemas.microsoft.com");
        })
        .catch(() => false);
    return availability;
}

function requireDigistarName(target) {
    const digistarName = digistarNameFor(target);
    if (!digistarName) throw new Error(`${target.name} isn't in Digistar's object library`);
    return digistarName;
}

/**
 * Shows a target on the dome: syncs location/date, then adds the object with
 * its marker and label. Only objects in Digistar's built-in library (Messier
 * M1-M110, a fixed set of NGC objects) can be shown this way.
 * @param {{name: string, catalog: string, catalogId: string|number, date?: Date, lat?: number, lon?: number}} target
 */
export function sendToDome(target) {
    const digistarName = requireDigistarName(target);
    return sendCommands([...buildSyncCommands(target.date, target.lat, target.lon), ...buildShowCommands(digistarName)]);
}

// Turns off the object, its marker, and its label.
export function resetDome(target) {
    const digistarName = requireDigistarName(target);
    return sendCommands(buildHideCommands(digistarName));
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
        run(() => resetDome(target), "Resetting…", "Dome view reset"));

    wrapper.append(button, resetButton, status);
    isDomeAvailable().then((available) => { wrapper.hidden = !available; });
    return wrapper;
}
