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

// Tries the object's proper name, then catalog-specific article naming conventions
// ("Messier 31", "NGC 224"), and returns the first Wikipedia summary found.
export async function findWikipediaSummary(object) {
    const candidates = [];
    if (object.properName) candidates.push(object.properName);
    if (object.catalog === 'M' && object.catalogId != null) {
        candidates.push(`Messier ${object.catalogId}`);
    }
    if (object.catalog && object.catalogId != null) {
        candidates.push(`${object.catalog} ${object.catalogId}`);
    }

    for (const title of candidates) {
        const summary = await fetchSummary(title);
        if (summary) return summary;
    }
    return null;
}
