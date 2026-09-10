import { searchNamedObjects } from './namedObjects.js';

const BASE_URL = 'https://www.datastro.eu';
const DATASET_PATH = '/api/explore/v2.1/catalog/datasets/deep-sky-objects/records';
const DEFAULT_LIMIT = 50;

function buildUrl({ where, order_by, limit = DEFAULT_LIMIT, offset = 0 } = {}) {
    const params = new URLSearchParams({ limit, offset });
    if (where) params.set('where', where);
    if (order_by) params.set('order_by', order_by);
    return `${BASE_URL}${DATASET_PATH}?${params.toString()}`;
}

async function fetchRecords(options = {}) {
    const res = await fetch(buildUrl(options));
    if (!res.ok) {
        throw new Error(`API request failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return { results: data.results ?? [], totalCount: data.total_count ?? 0 };
}

export async function fetchObjectsByCatalogId(catalog, id) {
    const where = `cat1="${catalog}" and id1=${id}`;
    const { results } = await fetchRecords({ where, limit: 1 });
    return results[0] ?? null;
}

// Tries a catalog+ID match first (e.g. "M31", "NGC224"). Otherwise searches both the
// API's own name field (e.g. "Saturn nebula", null on most records) and the local
// Messier common-name table (e.g. "Andromeda" -> M31), merging and de-duping the results.
// `extraWhere`, if given, is ANDed onto whichever clause was built (e.g. type/magnitude
// filters). Returns { results, totalCount } so callers can paginate.
export async function searchObjects(query, { limit, offset, extraWhere } = {}) {
    const trimmed = query.trim();
    const catalogMatch = trimmed.match(/^([A-Za-z]+)\s*(\d+)$/);
    if (catalogMatch) {
        const [, catalog, id] = catalogMatch;
        let where = `cat1="${catalog.toUpperCase()}" and id1=${id}`;
        if (extraWhere) where = `(${where}) and (${extraWhere})`;
        return fetchRecords({ where, limit, offset });
    }

    const escaped = trimmed.replace(/"/g, '\\"');
    const whereClauses = [`name like "%${escaped}%"`];

    for (const { catalog, catalogId } of searchNamedObjects(trimmed)) {
        whereClauses.push(`(cat1="${catalog}" and id1=${catalogId})`);
    }

    let where = whereClauses.join(' or ');
    if (extraWhere) where = `(${where}) and (${extraWhere})`;

    const { results, totalCount } = await fetchRecords({ where, limit, offset });

    const seen = new Set();
    const deduped = results.filter((r) => {
        const key = `${r.cat1}${r.id1}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    return { results: deduped, totalCount };
}

// Returns { results, totalCount } so callers can paginate.
export async function fetchObjects(options = {}) {
    return fetchRecords(options);
}
