# Sky Tonight — Observation Planner

A single-page app that lets amateur astronomers, students, and hobbyists answer
"what can I see tonight?" without learning a specialized query language. Pick a
date and location, browse or search deep-sky objects, see when they rise, peak,
and set from your sky, and save favorites for next time.

When hosted on an Evans & Sutherland Digistar 7 planetarium system, it can also
point the dome at any object in the planner with one click.


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
- **Planetarium dome control (Digistar 7)** — when the site is served by
  Digistar's built-in web server, the detail panel gains **Show on dome** and
  **Reset dome view** buttons. Show on dome sets the dome's sky to the
  planner's location and the object's transit time, slews to the object, and
  zooms in to frame it. Anywhere else, these buttons simply don't appear.

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

## Running it on a Digistar 7 planetarium

Digistar 7 includes a web server that serves files from its `$Content` folder
and accepts script commands over HTTP (see the Digistar User's Guide, section
*JavaScript Web Scripting*). Sky Tonight is hosted on that server, so the page
and Digistar's command interface share the same address and the page can
control the dome directly. No extra software is needed.

### Install

1. Copy the project folder to `$Content\SkyTonight\` on the Digistar Host
   computer. Use exactly this folder name so the addresses below work at every
   site.
2. Make sure Digistar's web command interface is on by running this in the
   Command Console:
   ```
   system webInterface on
   ```
   (It's on by default.)
3. Open the setup check at `http://localhost/content/SkyTonight/check.html`.
   It confirms that Digistar's web interface is answering, that JavaScript
   files are served in a form browsers will run, and that the computer can
   reach the catalog and Wikipedia over the internet.
4. Before the first live use, try the dome commands by hand in the Command
   Console (see [How the dome control works](#how-the-dome-control-works)) to
   confirm the dome behaves as expected.

### Add it to a control panel

Sky Tonight can run inside the Digistar interface, so operators only need
Digistar open.

1. In the Control Panel, click **New Group** (for example, "Sky Tonight"),
   then **New Control Panel Page**.
2. Select the **embedded web page** control from the toolbar and drag it out as
   large as the page allows.
3. Set its address to:
   ```
   http://localhost/content/SkyTonight/index.html
   ```
4. Click **Interact Directly with Controls** (the pointing-finger button) to
   leave edit mode. Control panel changes save automatically when the Digistar
   interface closes.

Use the `http://` address rather than a file path. A page loaded straight from
disk isn't on the same address as Digistar's command interface, so the dome
buttons won't work, and browsers block module scripts loaded from disk.

`localhost` works at every site because the Digistar User Interface and the
Host application run on the same computer.

### Addresses

| Where | Address |
| --- | --- |
| Control panel on the Host computer | `http://localhost/content/SkyTonight/index.html` |
| Tablet or laptop on the planetarium network | `http://<Host IP address>/content/SkyTonight/index.html` |
| Setup check | Replace `index.html` with `check.html` in either address |

The Host's IP address is `192.168.2.99` by default but varies by site; run
`ipconfig` in a Windows command prompt on the Host to find it. If a site has
changed Digistar's web server port from 80 (in
`$Software/site/NetConfig.xml`), add the port after the host, for example
`http://localhost:8080/content/SkyTonight/index.html`.

### If the setup check fails

- **Digistar web interface fails:** confirm `system webInterface on`, and check
  the web server port as described above.
- **JavaScript files check fails:** Digistar's server isn't labeling `.js`
  files in a way browsers accept for module scripts. Bundle the modules into
  ordinary scripts:
  ```bash
  npx esbuild js/app.js --bundle --format=iife --outfile=dist/app.js
  npx esbuild js/object.js --bundle --format=iife --outfile=dist/object.js
  ```
  Then change the script tags to `<script src="dist/app.js" defer></script>`
  in `index.html` and `<script src="dist/object.js" defer></script>` in
  `object.html`.
- **Internet checks fail:** the catalog, geocoding, and Wikipedia requests come
  from the computer or device running the page, not from Digistar itself, so
  that device needs internet access as well as access to the Digistar
  network.

## Project structure

```
index.html              Planner page (search, filters, results grid, detail panel)
object.html              Full object detail page (photo, description, observing guide)
check.html               Setup check for Digistar installs (web interface, JS serving, internet)
style.css                All styling
js/
  api.js                 fetch() wrapper around the datastro.eu Explore API
  CelestialObject.js      Core model: coordinate math, visibility, observing guide
  app.js                  Planner page controller: state, event wiring, pagination
  object.js               Object detail page controller
  render.js               DOM rendering for cards, lists, and the detail panel
  digistar.js             Digistar dome control: builds and sends commands, dome buttons
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
  a typed place name into coordinates. Its usage policy allows light use (about
  one request per second); Sky Tonight only geocodes when a location is typed.
- **[Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/)** — photo and
  summary text on the object detail page.

All three are called directly from the browser; no server or API key required.
On a planetarium, dome commands go to Digistar's own web interface on the Host.

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

## How the dome control works

`js/digistar.js` sends Digistar script commands one at a time to
`/digistar/execute?command=...` on the server that delivered the page. Digistar
replies in XML: empty on success, or an error message such as
`Error: 'bad' is not defined`. Commands stop at the first error, and the
message appears under the dome buttons.

On page load it reads a harmless attribute (`/digistar/objects/eye/intensity`)
to check that Digistar is answering. If it isn't, the dome buttons stay hidden,
which is why the same files work as a plain planner on any other host.

Clicking **Show on dome** for the Andromeda Galaxy on September 10, 2026, viewed
from New York (the planner's default location), sends:

```
navigation location 40.7128 -74.006 ground 20 180 duration 0
scene date 2026-09-10 06:21:32 ut
sky on
telescope zoom position celestial 0.71231 41.26900 1000 ly duration 5
zoomTarget on
scene zoomFOV 12.67 duration 10 1 8
```

- The first three lines move the dome's observer to the planner's location and
  set the scene date to the object's next transit, so it appears at its highest
  point on the chosen night. `sky on` redisplays the sky for that location and
  date.
- The last three slew to the object, show Digistar's zoom-target marker, and
  zoom to about four times the object's angular size (between 0.5° and 30°).
- Digistar takes right ascension in **hours**, so the planner's degrees are
  divided by 15. Digistar also requires a distance; the catalog has none, and
  from Earth only direction matters, so a nominal 1000 ly is used.

**Reset dome view** sends `telescope zoom stop`, `zoomTarget off`, and
`scene zoomFOV 180`, returning to the full dome.

The dome buttons don't appear for objects that never rise above the horizon
from the chosen location. Digistar's documentation notes that zooming to a
position below the horizon produces a "black hole" effect on the opposite side
of the dome.

Behavior can be adjusted in the `DOME_SETTINGS` block at the top of
`js/digistar.js`:

| Setting | Default | Effect |
| --- | --- | --- |
| `syncSky` | `true` | Match the dome's location and date to the planner. Turn off to leave the current sky alone and only point and zoom. |
| `zoomIn` | `true` | Zoom in to frame the object after pointing at it. |
| `slewSeconds` | `5` | Time to swing to the object (and to zoom back out on reset). |
| `zoomSeconds` | `10` | Time to zoom in. |

Only validated numbers are ever placed into commands; object names are not
sent to Digistar.

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
- `sky on` briefly fades the dome to black and back. If that's distracting
  during a show, set `syncSky` to `false`.
- Digistar's embedded browser was Chromium 84 as of the release notes, so the
  code avoids newer JavaScript syntax (such as `??=`). Keep this in mind when
  making changes.
- The Digistar User's Guide uses `/digistar/execute` in its HTTP command
  reference but `/software/execute` in its sample page. Sky Tonight uses the
  former; if commands fail with HTTP 404, change `EXECUTE_PATH` in
  `js/digistar.js`.
- Favorites and the last location are stored per site address, so favorites
  saved on a public copy of Sky Tonight won't appear on the Digistar-hosted
  one, and vice versa.
- Inside a Digistar control panel, the "View on Wikipedia" link opens in a new
  window, which will likely be the Host computer's regular browser.
