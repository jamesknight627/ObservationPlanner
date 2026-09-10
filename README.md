# Sky Tonight — Observation Planner

A single-page app that lets amateur astronomers, students, and hobbyists answer
"what can I see tonight?" without learning a specialized query language. Pick a
date and location, browse or search deep-sky objects, see when they rise, peak,
and set from your sky, and save favorites for next time.


## Features

- **Observation planner** — browse the Messier catalog (or the full ~227k-object
  database) filtered by date/location, type, magnitude, "visible now," peak
  altitude, and time-at-apex window, paginated 20 at a time.
- **Object search** — search by catalog ID (`M31`, `NGC224`) or common name
  (`Andromeda`, `Orion Nebula`).
- **Object details** — magnitude, angular size, RA/Dec, and computed rise time,
  transit ("time at apex"), max altitude, set time, and time above the horizon,
  for the currently selected date and location.
- **Observing guide** — on the full object page (`object.html`), a second panel
  estimates the home constellation, minimum recommended magnification, minimum
  equipment, and darkest-sky (Bortle scale) tolerance for that object, plus a
  Wikipedia summary and photo when one is available.
- **Saved objects** — a favorites tab backed by `localStorage`, so a returning
  visitor doesn't have to re-search objects they cared about.
- **Persisted session** — last-used location and date are remembered between
  visits.

## Running it

This is a static site with ES module `<script type="module">` imports, which
most browsers block from loading over the `file://` protocol. Serve the folder
with any local static server, for example:

```bash
npx serve .
```

or use an editor extension like VS Code's **Live Server**. Then open
`index.html` (not `object.html` directly — it expects a `cat`/`id` query
string, which the planner supplies when you click "More details").

No build step, no dependencies, no `npm install` — everything is plain
HTML/CSS/JS.

## Project structure

```
index.html              Planner page (search, filters, results grid, detail panel)
object.html              Full object detail page (photo, description, observing guide)
style.css                All styling
js/
  api.js                 fetch() wrapper around the datastro.eu Explore API
  CelestialObject.js      Core model: coordinate math, visibility, observing guide
  app.js                  Planner page controller: state, event wiring, pagination
  object.js               Object detail page controller
  render.js               DOM rendering for cards, lists, and the detail panel
  storage.js               localStorage helpers (favorites, last location/date)
  geocode.js               Place-name -> lat/lon via OpenStreetMap Nominatim
  wikipedia.js             Wikipedia REST summary lookup (photo + description)
  format.js                Display formatting (times, coordinates, durations, units)
  typeLabels.js             Raw type codes ("Gxy", "PN", ...) -> readable labels
  constellations.js         IAU constellation abbreviations -> full names
  namedObjects.js           Static Messier common-name table + reverse search
  observingGuide.js         Heuristics behind the observing guide estimates
  objectLink.js             Shared URL contract between the detail panel and object.html
```

## Data sources

- **[datastro.eu Explore API](https://www.datastro.eu/api/explore/v2.1/catalog/datasets/deep-sky-objects)**
  — the deep-sky object catalog (position, magnitude, size, type, constellation).
- **[OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/)** — geocodes
  a typed place name into coordinates.
- **[Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/)** — photo and
  summary text on the object detail page.

All three are called directly from the browser; no server or API key required.

## How the astronomy works

`CelestialObject` converts each record's RA/Dec into altitude/azimuth for a
given location and time (standard spherical trig), then derives:

- **Rise time** — steps forward in 5-minute increments looking for the moment
  altitude crosses from below to above the horizon.
- **Transit ("time at apex")** — solved directly from hour angle = 0, since the
  sky rotates at a very close to constant rate; no stepping needed.
- **Set time / time above horizon** — derived from rise and transit rather than
  stepped separately, using the fact that the altitude curve is symmetric
  around the meridian (time from rise to transit equals time from transit to
  set).
- **Max altitude** — the altitude at the transit moment.

The **observing guide** (constellation aside) is different: magnification,
equipment, and Bortle tolerance aren't in the dataset at all, so they're
heuristic estimates derived from magnitude and angular size (see
`observingGuide.js` for the exact thresholds and reasoning). They're a
starting point for a beginner, not authoritative advice.

## Known limitations

- The observing-guide numbers are estimates from magnitude/size alone — they
  don't account for surface brightness, so small-but-bright objects (like the
  Ring Nebula) can get an optimistic equipment recommendation.
- "Visible now" and "apex between" filters can only be evaluated per-object
  (the API has no concept of horizon altitude), so they run against a capped
  batch of 100 server-side matches rather than the entire matching set. On the
  Messier catalog this covers everything; on "all catalogs" with a broad
  filter, a small number of qualifying objects outside that batch could be
  missed.
- The Messier common-name table and Wikipedia lookups only reliably cover
  well-known objects; obscure NGC/IC/PGC entries usually won't have a photo or
  common name available.
