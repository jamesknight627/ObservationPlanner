// Maps the dataset's raw `type` codes to accessible, human-readable labels.
// Codes and their record counts were pulled from the API's own facet listing
// (not guessed) to make sure every value actually present is covered.
export const TYPE_LABELS = {
    Gxy: 'Galaxy',
    OC: 'Open Cluster',
    PN: 'Planetary Nebula',
    '*': 'Star',
    Neb: 'Nebula',
    GC: 'Globular Cluster',
    '**': 'Double Star',
    'OC+Neb': 'Open Cluster with Nebulosity',
    '?': 'Uncertain',
    NF: 'Not Found',
    Ast: 'Asterism',
    '***': 'Multiple Star',
    GxyCld: 'Galaxy Cloud',
    MWSC: 'Milky Way Star Cloud',
    HIIRgn: 'HII Region',
    SNR: 'Supernova Remnant',
    DN: 'Dark Nebula',
    'Neb?': 'Possible Nebula',
    PD: 'Photographic Plate Defect',
};

// Type codes for solar-system bodies. These aren't in the deep-sky dataset (the
// solar-system dataset has no type field), so they're kept separate and only offered in
// the type filter when the Solar System dataset is selected.
export const SOLAR_SYSTEM_TYPE_LABELS = {
    Sun: 'The Sun',
    Planet: 'Planet',
    DwPl: 'Dwarf Planet',
};

export function getTypeLabel(type) {
    return TYPE_LABELS[type] ?? SOLAR_SYSTEM_TYPE_LABELS[type] ?? type;
}
