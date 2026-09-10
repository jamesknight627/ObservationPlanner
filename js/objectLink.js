// Shared query-param contract between the detail panel's "More details" link
// and object.html, so the object page reopens with the same location/date context.
export function buildDetailUrl(object, location, date) {
    const params = new URLSearchParams({
        cat: object.catalog ?? '',
        id: object.catalogId ?? '',
    });
    if (location) {
        params.set('lat', location.latitude);
        params.set('lon', location.longitude);
        if (location.label) params.set('label', location.label);
    }
    if (date) params.set('date', date.toISOString());
    return `object.html?${params.toString()}`;
}

export function parseDetailParams(searchParams) {
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    return {
        catalog: searchParams.get('cat'),
        catalogId: searchParams.get('id') ? Number(searchParams.get('id')) : null,
        location: lat && lon
            ? { latitude: Number(lat), longitude: Number(lon), label: searchParams.get('label') ?? undefined }
            : null,
        date: searchParams.get('date') ? new Date(searchParams.get('date')) : null,
    };
}
