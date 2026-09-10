const COORD_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Accepts either raw "lat,lon" coordinates or a place name (geocoded via
// OpenStreetMap Nominatim). Returns { latitude, longitude, label } or null if
// the input can't be resolved to a location.
export async function geocodeLocation(query) {
    const trimmed = query.trim();
    if (!trimmed) return null;

    const coordMatch = trimmed.match(COORD_PATTERN);
    if (coordMatch) {
        const [, lat, lon] = coordMatch;
        return { latitude: Number(lat), longitude: Number(lon), label: `${lat}, ${lon}` };
    }

    const url = `${NOMINATIM_URL}?${new URLSearchParams({ q: trimmed, format: 'json', limit: 1 })}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Geocoding request failed: ${res.status}`);

    const results = await res.json();
    if (results.length === 0) return null;

    const { lat, lon, display_name } = results[0];
    return { latitude: Number(lat), longitude: Number(lon), label: display_name };
}
