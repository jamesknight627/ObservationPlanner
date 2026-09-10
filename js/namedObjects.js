// Common names for well-known Messier objects. The API's own `name` field is populated
// for only ~101 of 227k records and misses most famous Messier objects (e.g. M42, M31),
// so this fills the gap as a fallback when the API record has no name of its own.
export const NAMED_OBJECTS = {
    M1: "Crab Nebula",
    M4: "Spider Globular Cluster",
    M5: "Rose Cluster",
    M6: "Butterfly Cluster",
    M7: "Ptolemy's Cluster",
    M8: "Lagoon Nebula",
    M11: "Wild Duck Cluster",
    M13: "Great Hercules Cluster",
    M15: "Great Pegasus Cluster",
    M16: "Eagle Nebula",
    M17: "Omega Nebula",
    M18: "Black Swan Cluster",
    M20: "Trifid Nebula",
    M21: "Webb's Cross Cluster",
    M22: "Great Sagittarius Cluster",
    M24: "Small Sagittarius Star Cloud",
    M27: "Dumbbell Nebula",
    M31: "Andromeda Galaxy",
    M33: "Triangulum Galaxy",
    M34: "Spiral Cluster",
    M35: "Shoe-Buckle Cluster",
    M36: "Pinwheel Cluster",
    M37: "Salt and Pepper Cluster",
    M38: "Starfish Cluster",
    M39: "Pyramid Cluster",
    M40: "Winnecke 4",
    M41: "Little Beehive Cluster",
    M42: "Orion Nebula",
    M43: "De Mairan's Nebula",
    M44: "Beehive Cluster",
    M45: "Pleiades",
    M50: "Heart-Shaped Cluster",
    M51: "Whirlpool Galaxy",
    M52: "Scorpion Cluster",
    M55: "Specter Cluster",
    M57: "Ring Nebula",
    M63: "Sunflower Galaxy",
    M64: "Black Eye Galaxy",
    M67: "King Cobra Cluster",
    M71: "Angelfish Cluster",
    M74: "Phantom Galaxy",
    M76: "Little Dumbbell Nebula",
    M77: "Cetus A",
    M81: "Bode's Galaxy",
    M82: "Cigar Galaxy",
    M83: "Southern Pinwheel Galaxy",
    M97: "Owl Nebula",
    M99: "St. Catherine's Wheel",
    M100: "Mirror Galaxy",
    M101: "Pinwheel Galaxy",
    M102: "Spindle Galaxy",
    M104: "Sombrero Galaxy",
    M107: "Crucifix Cluster",
    M108: "Surfboard Galaxy",
    M109: "Vacuum Cleaner Galaxy",
};

export function lookupName(catalog, catalogId) {
    if (!catalog || catalogId == null) return null;
    return NAMED_OBJECTS[`${catalog.toUpperCase()}${catalogId}`] ?? null;
}

// Reverse lookup: find catalog designations whose common name contains the query
// (e.g. "andromeda" -> [{ catalog: "M", catalogId: 31, name: "Andromeda Galaxy" }]).
export function searchNamedObjects(query) {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return Object.entries(NAMED_OBJECTS)
        .filter(([, name]) => name.toLowerCase().includes(needle))
        .map(([key, name]) => {
            const [, catalog, catalogId] = key.match(/^([A-Za-z]+)(\d+)$/);
            return { catalog, catalogId: Number(catalogId), name };
        });
}
