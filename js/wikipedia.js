const REST_SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

async function fetchSummary(title) {
    const res = await fetch(`${REST_SUMMARY_URL}${encodeURIComponent(title.replace(/ /g, '_'))}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === 'disambiguation') return null;
    return {
        title: data.title,
        extract: data.extract ?? null,
        imageUrl: data.thumbnail?.source ?? data.originalimage?.source ?? null,
        pageUrl: data.content_urls?.desktop?.page ?? null,
    };
}

// Tries each of the object's candidate article titles (see getWikipediaCandidates on
// CelestialObject / SolarSystemBody) and returns the first Wikipedia summary found.
export async function findWikipediaSummary(object) {
    for (const title of object.getWikipediaCandidates()) {
        const summary = await fetchSummary(title);
        if (summary) return summary;
    }
    return null;
}
