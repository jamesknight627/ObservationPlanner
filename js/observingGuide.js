// None of this is in the dataset - magnitude and angular size are the only signals
// available, so these are heuristic estimates (typical dark-sky assumptions), not
// authoritative astronomical data. Good enough to help a beginner plan a session, not a
// substitute for an actual observing guide.

const EQUIPMENT_TIERS = [
    { maxMag: 6, label: 'Naked eye' },
    { maxMag: 9, label: 'Binoculars (7x50 or similar)' },
    { maxMag: 11.5, label: 'Small telescope (3–6" aperture)' },
    { maxMag: 13.5, label: 'Medium telescope (8–10" aperture)' },
    { maxMag: Infinity, label: 'Large telescope (12"+ aperture)' },
];

// Bortle scale runs 1 (excellent dark sky) to 9 (inner-city). This is the *worst*
// (highest-numbered) sky the object should still be reasonably findable under.
const BORTLE_TIERS = [
    { maxMag: 4, bortle: 9 },
    { maxMag: 6, bortle: 7 },
    { maxMag: 8, bortle: 6 },
    { maxMag: 10, bortle: 5 },
    { maxMag: 12, bortle: 4 },
    { maxMag: 14, bortle: 3 },
    { maxMag: Infinity, bortle: 2 },
];

const MIN_MAGNIFICATION = 20;
const MAX_MAGNIFICATION = 250;

export function estimateEquipment(magnitude) {
    if (magnitude == null) return null;
    return EQUIPMENT_TIERS.find(tier => magnitude <= tier.maxMag)?.label ?? null;
}

export function estimateMaxBortle(magnitude) {
    if (magnitude == null) return null;
    return BORTLE_TIERS.find(tier => magnitude <= tier.maxMag)?.bortle ?? null;
}

// Large, diffuse objects (e.g. Andromeda Galaxy) want low power so they fit in the field
// of view; small, compact objects (e.g. planetary nebulae) need higher power to resolve
// as more than a point. Scales roughly with 1/sqrt(size) so it falls off gently rather
// than blowing up for very small objects.
export function estimateMinMagnification(angularSizeArcmin) {
    if (angularSizeArcmin == null || angularSizeArcmin <= 0) return null;
    const raw = 300 / Math.sqrt(angularSizeArcmin);
    const clamped = Math.min(MAX_MAGNIFICATION, Math.max(MIN_MAGNIFICATION, raw));
    return Math.round(clamped / 5) * 5;
}
