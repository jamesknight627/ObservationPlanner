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

export function getTypeLabel(type) {
    return TYPE_LABELS[type] ?? type;
}
