// Small inline SVG glyphs shown in the lower-right corner of each object card (see
// .object-card__type-icon in style.css), so an object's type reads at a glance without
// reading the text label underneath. One glyph per visually distinct category - most of
// the dataset's raw type codes group into a shared glyph (every open-cluster-like code
// uses the same loose-scatter icon, every star-cluster look distinguishes only "loose"
// from "dense and radial") rather than drawing a unique icon for every rare code, since
// a few of them (Photographic Plate Defect, Possible Nebula, ...) barely occur at all.
//
// Every glyph is colored via currentColor, set by .object-card__type-icon, except the
// Dark Nebula glyph: its "blotted-out" patch is deliberately filled with the card's own
// background color (var(--surface)) instead, so it visually erases the star dots behind
// it rather than just drawing a shape over them.

const GALAXY = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <ellipse cx="12" cy="12" rx="10" ry="4" fill="currentColor" opacity="0.25"/>
    <path d="M12 12 C 8 8, 4 10, 3 13" stroke="currentColor" stroke-width="1" fill="none" opacity="0.7" stroke-linecap="round"/>
    <path d="M12 12 C 16 16, 20 14, 21 11" stroke="currentColor" stroke-width="1" fill="none" opacity="0.7" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="2.2" fill="currentColor"/>
</svg>`;

const OPEN_CLUSTER = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.08"/>
    <circle cx="7" cy="8" r="1.3" fill="currentColor"/>
    <circle cx="13" cy="6" r="0.9" fill="currentColor"/>
    <circle cx="17" cy="10" r="1.5" fill="currentColor"/>
    <circle cx="9" cy="13" r="1" fill="currentColor"/>
    <circle cx="15" cy="15" r="1.2" fill="currentColor"/>
    <circle cx="5" cy="15" r="0.8" fill="currentColor"/>
    <circle cx="19" cy="17" r="0.9" fill="currentColor"/>
    <circle cx="11" cy="19" r="1.1" fill="currentColor"/>
</svg>`;

const GLOBULAR_CLUSTER = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="17.99" cy="13.61" r="0.4" fill="currentColor" opacity="0.45"/>
    <circle cx="16.38" cy="16.38" r="0.4" fill="currentColor" opacity="0.45"/>
    <circle cx="13.61" cy="17.99" r="0.4" fill="currentColor" opacity="0.45"/>
    <circle cx="10.39" cy="17.99" r="0.4" fill="currentColor" opacity="0.45"/>
    <circle cx="7.62" cy="16.38" r="0.4" fill="currentColor" opacity="0.45"/>
    <circle cx="6.01" cy="13.61" r="0.4" fill="currentColor" opacity="0.45"/>
    <circle cx="6.01" cy="10.39" r="0.4" fill="currentColor" opacity="0.45"/>
    <circle cx="7.62" cy="7.62" r="0.4" fill="currentColor" opacity="0.45"/>
    <circle cx="10.39" cy="6.01" r="0.4" fill="currentColor" opacity="0.45"/>
    <circle cx="13.61" cy="6.01" r="0.4" fill="currentColor" opacity="0.45"/>
    <circle cx="16.38" cy="7.62" r="0.4" fill="currentColor" opacity="0.45"/>
    <circle cx="17.99" cy="10.39" r="0.4" fill="currentColor" opacity="0.45"/>
    <circle cx="15.4" cy="12" r="0.55" fill="currentColor" opacity="0.8"/>
    <circle cx="14.75" cy="14.0" r="0.55" fill="currentColor" opacity="0.8"/>
    <circle cx="13.05" cy="15.23" r="0.55" fill="currentColor" opacity="0.8"/>
    <circle cx="10.95" cy="15.23" r="0.55" fill="currentColor" opacity="0.8"/>
    <circle cx="9.25" cy="14.0" r="0.55" fill="currentColor" opacity="0.8"/>
    <circle cx="8.6" cy="12" r="0.55" fill="currentColor" opacity="0.8"/>
    <circle cx="9.25" cy="10.0" r="0.55" fill="currentColor" opacity="0.8"/>
    <circle cx="10.95" cy="8.77" r="0.55" fill="currentColor" opacity="0.8"/>
    <circle cx="13.05" cy="8.77" r="0.55" fill="currentColor" opacity="0.8"/>
    <circle cx="14.75" cy="10.0" r="0.55" fill="currentColor" opacity="0.8"/>
    <circle cx="12" cy="12" r="1.6" fill="currentColor"/>
</svg>`;

const NEBULA = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="9" cy="10" r="5" fill="currentColor" opacity="0.18"/>
    <circle cx="15" cy="9" r="4" fill="currentColor" opacity="0.18"/>
    <circle cx="13" cy="15" r="4.5" fill="currentColor" opacity="0.18"/>
    <circle cx="8" cy="15" r="3.5" fill="currentColor" opacity="0.18"/>
    <circle cx="11" cy="11" r="0.7" fill="currentColor"/>
    <circle cx="14" cy="13" r="0.5" fill="currentColor"/>
</svg>`;

const PLANETARY_NEBULA = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path fill-rule="evenodd" fill="currentColor" opacity="0.22"
      d="M22.5,12 C22,16 18.5,18.5 15.5,18.06 C11,20.5 8,24 6.75,21.09
         C3,19 3,15 5,12 C3,8 3,5 6.75,2.91 C10,1 14,2 15.5,5.94
         C19,7 22,8 22.5,12 Z
         M16.5,12 A4.5,4.5 0 1,0 7.5,12 A4.5,4.5 0 1,0 16.5,12 Z"/>
    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.2" opacity="0.45"/>
    <circle cx="12" cy="12" r="1" fill="currentColor"/>
</svg>`;

// Deliberately fills with var(--surface) rather than currentColor, so the "void" patch
// genuinely erases the star dots behind it instead of just overlapping them - see the
// module doc comment above.
const DARK_NEBULA = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="4" cy="5" r="0.5" fill="currentColor" opacity="0.5"/>
    <circle cx="9" cy="3" r="0.5" fill="currentColor" opacity="0.45"/>
    <circle cx="18" cy="4" r="0.6" fill="currentColor" opacity="0.55"/>
    <circle cx="21" cy="8" r="0.5" fill="currentColor" opacity="0.4"/>
    <circle cx="3" cy="11" r="0.5" fill="currentColor" opacity="0.5"/>
    <circle cx="20" cy="13" r="0.5" fill="currentColor" opacity="0.4"/>
    <circle cx="5" cy="18" r="0.6" fill="currentColor" opacity="0.5"/>
    <circle cx="10" cy="20" r="0.5" fill="currentColor" opacity="0.45"/>
    <circle cx="16" cy="19" r="0.5" fill="currentColor" opacity="0.5"/>
    <circle cx="21" cy="19" r="0.45" fill="currentColor" opacity="0.4"/>
    <circle cx="7" cy="9" r="0.55" fill="currentColor" opacity="0.5"/>
    <circle cx="14" cy="6" r="0.5" fill="currentColor" opacity="0.45"/>
    <circle cx="12" cy="14" r="0.5" fill="currentColor" opacity="0.5"/>
    <path d="M8,12 C8,8 11,6 14,7 C18,6 20,9 19,13 C21,16 18,19 14,18 C11,20 7,18 7,14 C6,13 7,12 8,12 Z"
          fill="var(--surface)" stroke="currentColor" stroke-width="0.6" opacity="0.95"/>
</svg>`;

const SUPERNOVA_REMNANT = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12,3 C15,3.5 16,5 18,5.5 C20,7 20.5,9 19.5,10 C21,12 21,14 19,15.5 C19.5,17.5 18,19 16,18.5 C14.5,20.5 12,21 10.5,19 C8,19.5 6,18 6.5,16 C4,15 3.5,13 5,11.5 C3.5,9.5 4.5,7 7,6.5 C7.5,4.5 10,3 12,3 Z"
          fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.55"/>
    <path d="M12,6 C14,6.5 15,8 15.5,9.5 C17,10 17.5,12 16.5,13.5 C17,15.5 15.5,17 13.5,16.5 C12,18 10,17.5 9.5,15.5 C7.5,15 7,13 8,11.5 C7.5,9.5 9,8 11,8 C11,7 11.5,6.3 12,6 Z"
          fill="none" stroke="currentColor" stroke-width="0.7" opacity="0.35"/>
    <path d="M12,12 L17.5,12 M12,12 L15.89,15.89 M12,12 L12,17.5 M12,12 L8.11,15.89 M12,12 L6.5,12 M12,12 L8.11,8.11 M12,12 L12,6.5 M12,12 L15.89,8.11"
          stroke="currentColor" stroke-width="0.6" opacity="0.4" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="1" fill="currentColor"/>
</svg>`;

const STAR = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="2.3" fill="currentColor"/>
    <path d="M12,2 L12,8 M12,16 L12,22 M2,12 L8,12 M16,12 L22,12 M5,5 L9,9 M15,15 L19,19 M19,5 L15,9 M9,15 L5,19"
          stroke="currentColor" stroke-width="0.8" opacity="0.5" stroke-linecap="round"/>
</svg>`;

const MULTIPLE_STAR = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="2" fill="currentColor"/>
    <path d="M9,3 L9,7 M9,11 L9,15 M3,9 L7,9 M11,9 L15,9" stroke="currentColor" stroke-width="0.7" opacity="0.5" stroke-linecap="round"/>
    <circle cx="16.5" cy="16.5" r="1.3" fill="currentColor" opacity="0.85"/>
    <path d="M16.5,13 L16.5,15.3 M16.5,17.7 L16.5,20 M13,16.5 L15.3,16.5 M17.7,16.5 L20,16.5" stroke="currentColor" stroke-width="0.5" opacity="0.4" stroke-linecap="round"/>
</svg>`;

const PLANET = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="12" r="6" fill="currentColor"/>
    <circle cx="19" cy="7" r="1.1" fill="currentColor" opacity="0.8"/>
    <circle cx="11" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="0.4" opacity="0.3" stroke-dasharray="1.5 1.5"/>
</svg>`;

const SUN = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="4.5" fill="currentColor"/>
    <path d="M12,2 L12,5 M12,19 L12,22 M2,12 L5,12 M19,12 L22,12 M4.9,4.9 L7,7 M17,17 L19.1,19.1 M19.1,4.9 L17,7 M7,17 L4.9,19.1"
          stroke="currentColor" stroke-width="1.2" opacity="0.6" stroke-linecap="round"/>
</svg>`;

const UNKNOWN = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <text x="12" y="17" text-anchor="middle" font-size="16" font-weight="600" fill="currentColor" opacity="0.6">?</text>
</svg>`;

// Keyed by the same raw type codes TYPE_LABELS/SOLAR_SYSTEM_TYPE_LABELS use (see
// js/typeLabels.js) - every code not listed here (including CelestialObject's own
// 'unknown' fallback for a missing type) falls back to the UNKNOWN glyph.
const TYPE_ICONS = {
    Gxy: GALAXY,
    GxyCld: GALAXY,
    OC: OPEN_CLUSTER,
    'OC+Neb': OPEN_CLUSTER,
    MWSC: OPEN_CLUSTER,
    GC: GLOBULAR_CLUSTER,
    Neb: NEBULA,
    'Neb?': NEBULA,
    HIIRgn: NEBULA,
    PN: PLANETARY_NEBULA,
    DN: DARK_NEBULA,
    SNR: SUPERNOVA_REMNANT,
    '*': STAR,
    Ast: STAR,
    '**': MULTIPLE_STAR,
    '***': MULTIPLE_STAR,
    Sun: SUN,
    Planet: PLANET,
    DwPl: PLANET,
};

export function getTypeIconSvg(type) {
    return TYPE_ICONS[type] ?? UNKNOWN;
}
