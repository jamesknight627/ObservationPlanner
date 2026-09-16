// Approximate positions of the Sun and planets. The solar-system dataset has physical
// facts (diameter, gravity, ...) but no sky coordinates - planets move, so there's no
// fixed RA/Dec to store. Positions are computed here instead, from JPL's "Keplerian
// Elements for Approximate Positions of the Major Planets" (E.M. Standish, Table 1,
// valid 1800-2050 AD). Accuracy is roughly a few arcminutes, which is far better than
// needed for rise/transit/set times. Like the deep-sky catalog, results are J2000
// coordinates (no precession, nutation, or light-time correction).
//
// https://ssd.jpl.nasa.gov/planets/approx_pos.html

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const OBLIQUITY_J2000_RAD = 23.43928 * DEG_TO_RAD;
export const AU_KM = 149597870.7;

// Each element is [value at J2000, rate per Julian century]:
// a = semi-major axis (au), e = eccentricity, I = inclination (deg),
// L = mean longitude (deg), w = longitude of perihelion (deg), node = longitude of ascending node (deg)
const ORBITAL_ELEMENTS = {
    mercury: { a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749], L: [252.2503235, 149472.67411175], w: [77.45779628, 0.16047689], node: [48.33076593, -0.12534081] },
    venus:   { a: [0.72333566, 0.0000039], e: [0.00677672, -0.00004107], I: [3.39467605, -0.0007889], L: [181.9790995, 58517.81538729], w: [131.60246718, 0.00268329], node: [76.67984255, -0.27769418] },
    earth:   { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], node: [0, 0] },
    mars:    { a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], w: [-23.94362959, 0.44441088], node: [49.55953891, -0.29257343] },
    jupiter: { a: [5.202887, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775], w: [14.72847983, 0.21252668], node: [100.47390909, 0.20469106] },
    saturn:  { a: [9.53667594, -0.0012506], e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609], L: [49.95424423, 1222.49362201], w: [92.59887831, -0.41897216], node: [113.66242448, -0.28867794] },
    uranus:  { a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], I: [0.77263783, -0.00242939], L: [313.23810451, 428.48202785], w: [170.9542763, 0.40805281], node: [74.01692503, 0.04240589] },
    neptune: { a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], I: [1.77004347, 0.00035372], L: [-55.12002969, 218.45945325], w: [44.96476227, -0.32241464], node: [131.78422574, -0.00508664] },
    pluto:   { a: [39.48211675, -0.00031596], e: [0.2488273, 0.0000517], I: [17.14001206, 0.00004818], L: [238.92903833, 145.20780515], w: [224.06891629, -0.04062942], node: [110.30393684, -0.01183482] },
};

// Apparent-magnitude models (Meeus, "Astronomical Algorithms" ch. 41), as a function of
// heliocentric distance r, geocentric distance delta (both au) and phase angle i (deg).
// Saturn's rings are ignored, so its estimate can be up to ~1 mag dimmer than reality.
const MAGNITUDE_MODELS = {
    mercury: (i) => -0.42 + 0.038 * i - 0.000273 * i ** 2 + 0.000002 * i ** 3,
    venus:   (i) => -4.4 + 0.0009 * i + 0.000239 * i ** 2 - 0.00000065 * i ** 3,
    mars:    (i) => -1.52 + 0.016 * i,
    jupiter: (i) => -9.4 + 0.005 * i,
    saturn:  () => -8.88,
    uranus:  () => -7.19,
    neptune: () => -6.87,
    pluto:   () => -1.0,
};

// Bodies the app can place in the sky. `aliases` are matched against the dataset's
// planet-name field (which mixes French and English). Earth is deliberately absent -
// you can't observe it in the night sky - so its dataset record is skipped.
// `diameterKm` is only a fallback for when the dataset record lacks a diameter.
export const SOLAR_SYSTEM_BODIES = {
    sun:     { name: 'Sun', type: 'Sun', aliases: ['sun', 'soleil'], diameterKm: 1392700, wikiTitle: 'Sun' },
    mercury: { name: 'Mercury', type: 'Planet', aliases: ['mercury', 'mercure'], diameterKm: 4879, wikiTitle: 'Mercury (planet)' },
    venus:   { name: 'Venus', type: 'Planet', aliases: ['venus', 'vénus'], diameterKm: 12104, wikiTitle: 'Venus' },
    mars:    { name: 'Mars', type: 'Planet', aliases: ['mars'], diameterKm: 6792, wikiTitle: 'Mars' },
    jupiter: { name: 'Jupiter', type: 'Planet', aliases: ['jupiter'], diameterKm: 142984, wikiTitle: 'Jupiter' },
    saturn:  { name: 'Saturn', type: 'Planet', aliases: ['saturn', 'saturne'], diameterKm: 120536, wikiTitle: 'Saturn' },
    uranus:  { name: 'Uranus', type: 'Planet', aliases: ['uranus'], diameterKm: 51118, wikiTitle: 'Uranus' },
    neptune: { name: 'Neptune', type: 'Planet', aliases: ['neptune'], diameterKm: 49528, wikiTitle: 'Neptune' },
    pluto:   { name: 'Pluto', type: 'DwPl', aliases: ['pluto', 'pluton'], diameterKm: 2376, wikiTitle: 'Pluto' },
};

// Maps a dataset name value (e.g. "Saturne", "Mercury", "Mercure / Mercury") to a body key.
export function matchBodyKey(datasetName) {
    if (typeof datasetName !== 'string') return null;
    const words = datasetName.toLowerCase().split(/[^a-zà-ÿ]+/).filter(Boolean);
    for (const [key, body] of Object.entries(SOLAR_SYSTEM_BODIES)) {
        if (body.aliases.some(alias => words.includes(alias))) return key;
    }
    return null;
}

function julianCenturiesSinceJ2000(time) {
    const jd = time.getTime() / 86400000 + 2440587.5;
    return (jd - 2451545.0) / 36525;
}

function normalizeDeg180(deg) {
    return ((deg + 180) % 360 + 360) % 360 - 180;
}

// Solves Kepler's equation M = E - e sin E for E (all radians) by Newton's method.
function solveKepler(meanAnomalyRad, e) {
    let E = meanAnomalyRad + e * Math.sin(meanAnomalyRad);
    for (let i = 0; i < 10; i++) {
        const delta = (E - e * Math.sin(E) - meanAnomalyRad) / (1 - e * Math.cos(E));
        E -= delta;
        if (Math.abs(delta) < 1e-10) break;
    }
    return E;
}

// Heliocentric position in J2000 equatorial coordinates (au).
function heliocentricPosition(key, T) {
    const el = ORBITAL_ELEMENTS[key];
    const at = ([value, rate]) => value + rate * T;
    const a = at(el.a);
    const e = at(el.e);
    const I = at(el.I) * DEG_TO_RAD;
    const L = at(el.L);
    const w = at(el.w);
    const node = at(el.node);

    const argPeri = (w - node) * DEG_TO_RAD;
    const meanAnomaly = normalizeDeg180(L - w) * DEG_TO_RAD;
    const nodeRad = node * DEG_TO_RAD;
    const E = solveKepler(meanAnomaly, e);

    // Position in the orbital plane, x-axis toward perihelion.
    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

    // Rotate into the J2000 ecliptic frame...
    const cw = Math.cos(argPeri), sw = Math.sin(argPeri);
    const cn = Math.cos(nodeRad), sn = Math.sin(nodeRad);
    const ci = Math.cos(I), si = Math.sin(I);
    const x = (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp;
    const y = (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp;
    const z = (sw * si) * xp + (cw * si) * yp;

    // ...then tilt by the obliquity into the equatorial frame.
    const ce = Math.cos(OBLIQUITY_J2000_RAD), se = Math.sin(OBLIQUITY_J2000_RAD);
    return { x, y: ce * y - se * z, z: se * y + ce * z };
}

const length = ({ x, y, z }) => Math.sqrt(x * x + y * y + z * z);

// Geocentric position of a body at `time`:
// { raDeg, decDeg, distanceAu, sunDistanceAu, phaseAngleDeg, magnitude }
// Returns null for an unknown key.
export function getBodyPosition(key, time) {
    if (!SOLAR_SYSTEM_BODIES[key]) return null;
    const T = julianCenturiesSinceJ2000(time);
    const earth = heliocentricPosition('earth', T);
    const earthSunDistance = length(earth);

    let geo;
    let sunDistanceAu;
    if (key === 'sun') {
        geo = { x: -earth.x, y: -earth.y, z: -earth.z };
        sunDistanceAu = 0;
    } else {
        const helio = heliocentricPosition(key, T);
        geo = { x: helio.x - earth.x, y: helio.y - earth.y, z: helio.z - earth.z };
        sunDistanceAu = length(helio);
    }

    const distanceAu = length(geo);
    const raDeg = (Math.atan2(geo.y, geo.x) * RAD_TO_DEG + 360) % 360;
    const decDeg = Math.atan2(geo.z, Math.hypot(geo.x, geo.y)) * RAD_TO_DEG;

    let phaseAngleDeg = null;
    let magnitude = -26.74; // the Sun
    if (key !== 'sun') {
        const r = sunDistanceAu;
        const cosPhase = (r * r + distanceAu * distanceAu - earthSunDistance * earthSunDistance) / (2 * r * distanceAu);
        phaseAngleDeg = Math.acos(Math.min(1, Math.max(-1, cosPhase))) * RAD_TO_DEG;
        magnitude = MAGNITUDE_MODELS[key](phaseAngleDeg) + 5 * Math.log10(r * distanceAu);
    }

    return { raDeg, decDeg, distanceAu, sunDistanceAu, phaseAngleDeg, magnitude };
}

// Angular separation from the Sun (deg). Useful for sanity-checking positions:
// ~180 at opposition, ~0 at conjunction.
export function getElongationDeg(key, time) {
    const body = getBodyPosition(key, time);
    const sun = getBodyPosition('sun', time);
    if (!body || !sun) return null;
    const [ra1, d1, ra2, d2] = [body.raDeg, body.decDeg, sun.raDeg, sun.decDeg].map(v => v * DEG_TO_RAD);
    const cosSep = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(ra1 - ra2);
    return Math.acos(Math.min(1, Math.max(-1, cosSep))) * RAD_TO_DEG;
}
