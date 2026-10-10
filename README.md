# Sky Tonight — Observation Planner

A single-page app that lets amateur astronomers, students, and hobbyists answer
"what can I see tonight?" without learning a specialized query language. Pick a
date and location, browse or search deep-sky objects, see when they rise, peak,
and set from your sky, and save favorites for next time.

When hosted on an Evans & Sutherland Digistar 7 planetarium system, it can also
show any Messier or supported NGC object in the planner on the dome, with a
marker and label, with one click.


## Features

- **How To page** (`howto.html`) — a short, six-step walkthrough of planning a
  night of observations with this app (set location/date, find objects,
  favorite them, check the Plan tab, fine-tune the schedule, optionally
  preview on a dome), linked from the header. Deliberately brief; this
  README is where the detail lives.
- **Observation planner** — browse the Messier catalog, the full ~227k-object
  deep-sky database, or the Solar System (the Sun, planets, and Pluto), filtered by date/location, type, magnitude, peak
  altitude, a time-at-apex window, and an "up between" window, paginated 20
  at a time. "Up between" has an "Altitude above" filter paired with it
  (only usable once both window times are set) that finds objects above a
  given altitude at *some point* during that window - not just at their
  daily peak, which is what "Peaks above" answers on its own.
- **Object search** — search by catalog ID (`M31`, `NGC224`) or common name
  (`Andromeda`, `Orion Nebula`). With the Solar System catalog selected,
  search by planet name (`Jupiter`).
- **Type icons** — every object card (Results and Saved Objects) shows a small
  glyph for its type in the lower-right corner - a spiral for a galaxy, a
  scatter of dots for a cluster, a ring for a planetary nebula, and so on. One
  glyph covers several related raw type codes (every open-cluster-like code
  shares one icon, for instance) rather than drawing a unique icon for every
  rare code in the dataset. See `js/typeIcons.js` for the full glyph set and
  which codes map to which.
- **Object details** — magnitude, angular size, RA/Dec, and computed rise time,
  transit ("time at apex"), max altitude, set time, and time above the horizon,
  for the currently selected date and location. Solar-system bodies also show
  their distance from Earth, diameter, gravity, orbital period, and moon count.
  The panel can be minimized to a narrow strip along the side of the screen
  (the › button next to its close button) so the results column can reclaim
  the space while still showing which object is selected; it re-expands on
  click, or automatically when a different object is selected.
- **Observing guide** — on the full object page (`object.html`), a second panel
  estimates the home constellation, minimum recommended magnification, minimum
  equipment, and darkest-sky (Bortle scale) tolerance for that object, plus a
  Wikipedia summary and photo when one is available.
- **Saved objects** — a favorites tab backed by `localStorage`, so a returning
  visitor doesn't have to re-search objects they cared about.
- **Plan** — a third tab that lays your saved objects out as a schedule for
  the selected date: each favorite that's up that night gets its own row on
  a shared timeline, as a bar spanning its natural rise-to-set window. Drag
  either edge of a bar (or use the arrow keys when it's focused) to narrow
  or shift that object's observing window; drag the middle of a bar (or use
  the arrow keys when the bar itself, not an edge, is focused) to move the
  whole window instead, keeping its duration fixed while its start and end
  both shift together. Either way, the dragged edge snaps to another row's
  current start or end time when it's dragged close to one — pointer drags
  snap within a small pixel radius of the target, and keyboard nudges within
  a fixed time radius, since there's no cursor position to derive a pixel
  radius from — making it easy to line two objects up back-to-back. The
  original rise/set span stays visible behind the bar as a grayed "ghost,"
  and a reset button appears on any row you've adjusted. Each row's track is also plotted with
  that object's altitude over the course of the timeline, on a fixed
  fixed -20°-to-90° scale shared by every row, so how tall a curve stands
  is directly comparable from one object to the next - not just how high
  each one gets on its own. The range dips below the horizon so the 0°
  reference line each row keeps sits clearly inside the chart rather than
  flush against its bottom edge. Sunset, sunrise, and the start/end of civil twilight are
  marked as vertical lines running the full height of the timeline, from a
  time-labeled flag above the ruler down through every row (including
  through each row's own bar and altitude curve), so it's easy to see which
  part of an object's window falls in full darkness. All five lines - the
  four twilight/sun markers plus the horizon reference - have their own
  distinct color and pattern (solid, dashed, dotted, dash-dot...), with a
  legend underneath the schedule as a key. Changes are remembered per date,
  so they're still there if you switch tabs or reload. A circumpolar favorite
  (never sets that night) gets a bar spanning the whole timeline instead of
  a rise/set-derived one. Favorites that aren't up at all that date are
  named separately rather than silently dropped. Click a row's name to open
  its detail panel, same as a result card.
- **Persisted session** — last-used location and date are remembered between
  visits.
- **Text size controls** — the A-/A+ buttons in the header (on the planner and
  object detail pages) scale the whole page's text up or down, 10% per click
  between 80% and 160% of the default. The setting is shared across pages via
  `localStorage` (`js/fontSize.js`), so it carries over whichever page is
  opened next.
- **Planetarium dome control (Digistar 7)** — when the site is served by
  Digistar's built-in web server, the detail panel gains **Show on dome** and
  **Reset dome view** buttons. Show on dome sets the dome's sky to the
  planner's location and the object's next rise time, then adds the object with
  its marker and label — for objects in Digistar's built-in library (Messier
  and a set of NGC objects; see [How the dome control
  works](#how-the-dome-control-works)). The Saved Objects tab has its own
  **Add all to dome**/**Reset dome view** pair that does the same for every
  favorite in one go. Anywhere else, these buttons simply don't appear.

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

## Sharing via the Digistar Cloud Library

Digistar's Cloud Library is built around specific, typed Library items - media
(images, models, slidesets, audio, video), scripts/shows, and Control Panel
Pages (`.dscp`)/Workspaces (`.dsws`). Sky Tonight doesn't fit any of those
categories: it's a plain multi-file web app, not a native Digistar object. So
rather than trying to force it into one of those types, share it as a generic
**Content Package** - but as a *bundled* copy, not the raw `js/` module
sources. Digistar's packaging step doesn't handle ES module `import`
statements correctly (confirmed by direct testing - see "Known risks to
watch for" below), so the modules need to be bundled into plain,
import-free scripts first.

### Packaging it

1. Bundle the two entry-point scripts with [esbuild](https://esbuild.github.io/)
   (no install needed, `npx` fetches it on first use):
   ```bash
   npx esbuild js/app.js --bundle --format=iife --outfile=dist/app.js
   npx esbuild js/object.js --bundle --format=iife --outfile=dist/object.js
   ```
   This is the same bundling command already used as a fallback in "If the
   setup check fails" above, for a different reason (Digistar mislabeling
   `.js` files for module scripts). Here it also happens to produce exactly
   what Cloud Library packaging needs: a single self-contained script per
   page with no `import` statements left for Digistar to mishandle, and no
   `js/` subfolder that needs to exist in the shared package at all.
2. Make temporary copies of `index.html` and `object.html` with their
   script tags pointed at the bundled files, loaded as plain scripts
   instead of ES modules, sitting right next to the HTML (no subfolder):
   - `index.html`: `<script type="module" src="js/app.js"></script>` →
     `<script src="app.js" defer></script>`
   - `object.html`: `<script type="module" src="js/object.js"></script>` →
     `<script src="object.js" defer></script>`
3. In Digistar's Library, right-click and choose **Add Files to Library...**,
   then add: the two edited HTML files (as `index.html`/`object.html`),
   `howto.html`, `check.html`, `style.css`, and the two bundled files from
   `dist/` (renamed to sit at the top level: `app.js`, `object.js`). Leave
   out `README.md` and everything under the original `js/` folder - see
   "Known risks to watch for" below for why.
4. Right-click the resulting item and choose **Share Item via Content
   Package** (safer than uploading straight to the live Cloud Library, since
   you get a file you can test yourself first) or **Share Item to Cloud
   Library** once you're confident it's right.
5. Click **Advanced** and double-check the file list has both `app.js` and
   `object.js`, not just one of them.
6. Paste the description from the next section in as the package's
   description field, then **Share**/**Save**.

### Package description text

```
Sky Tonight — observation planner with Digistar dome integration

A static web-based tool for planning deep-sky and solar-system observing
sessions: search ~227k objects (Messier + full NGC/IC/etc. catalog) or the
Solar System, filter by visibility/altitude/time windows, save favorites, and
lay out a night's schedule on a draggable timeline with sunset/twilight
markers. On a Digistar 7 system it can also push objects directly to the
dome.

INSTALLATION (manual - this is a plain web app, not a native Digistar Library
item, so Digistar's automatic path rewriting doesn't apply to it):

1. After installing this package, find the downloaded files under
   $Content\User\Downloads\<source site>\<this item's name>\ - both of
   those folder names come from the shared package itself (the site that
   shared it, and its Display Name), not anything chosen on this system.
2. Confirm that folder directly contains index.html, object.html,
   howto.html, check.html, style.css, app.js, and object.js, all in that
   one folder (no subfolders).
3. Open http://localhost/content/User/Downloads/<source site>/<item
   name>/check.html in a browser on the Digistar Host (substitute the real
   folder names from step 1) to confirm Digistar's web interface is
   reachable and JavaScript files are served correctly.
4. For a fixed, predictable address instead of the downloads folder, move or
   copy the whole folder to $Content\User\SkyTonight\ and use
   http://localhost/content/User/SkyTonight/index.html.

No further configuration is needed - every file reference in the app is
already relative to its own folder, except the two that intentionally stay
root-relative to reach Digistar's own web interface.
```

### Known risks to watch for

- **Digistar corrupts ES module `import` paths during packaging.** Confirmed
  by direct testing: sharing the raw `js/` folder (ES modules, each
  `import`ing others by relative path, e.g. `render.js`'s
  `import { ... } from './format.js'`) resulted in that import resolving on
  the *installed* copy to an absolute path from the *original sharing
  computer's own* local Library installation
  (`\User\Packages\<Site>\<ItemName>\Scripts\format.js`-style), not a
  portable relative path and not the receiving site's own install location.
  Every module import breaks as a result, on every site except (by
  coincidence) the one that originally shared it. This is why the packaging
  steps above bundle the app into two import-free scripts first, rather
  than sharing `js/` directly - there's nothing left for Digistar's
  packaging step to miscorrect once there are no `import` statements left
  to rewrite.
- **Relatedly, a shared `.js`-containing subfolder gets renamed to
  `Scripts`.** Confirmed separately: Digistar keeps a folder of `.js` files
  together on install (good), but renames it to `Scripts` regardless of its
  original name. Bundling to `app.js`/`object.js` at the top level (no
  subfolder at all) sidesteps this too, rather than needing a manual
  rename-back step after every install.
- **`.md` isn't supported.** Confirmed by trying it: `style.css` adds to a
  package fine (despite not being in Digistar's documented list of extra
  file types) but `README.md` can't be added at all. `.md` was never on that
  documented list (`.html`, `.htm`, `.txt`, `.xml`, `.pdf`, `.js`, `.py`,
  `.dscp`, `.dsws`) - `.txt` is, `.md` isn't. Leave `README.md` out of the
  package. The How To page's "see the README" link points at the GitHub
  repo rather than the local file for exactly this reason, so it keeps
  working on an installed copy that doesn't have `README.md` bundled with
  it (it just needs internet access, same as the catalog/geocoding/Wikipedia
  lookups already do).

## Project structure

```
index.html              Planner page (search, filters, results grid, detail panel)
object.html              Full object detail page (photo, description, observing guide)
howto.html               Short step-by-step guide to planning a night with this app
check.html               Setup check for Digistar installs (web interface, JS serving, internet)
style.css                All styling
js/
  api.js                 fetch() wrapper around the datastro.eu Explore API
  CelestialObject.js      Core model: coordinate math, visibility, observing guide
  SolarSystemBody.js      CelestialObject subclass for the Sun/planets (moving positions)
  ephemeris.js            Computes Sun/planet RA/Dec, distance, and magnitude for a date
  objectFactory.js        Picks the right class per dataset (lookups, saved favorites)
  app.js                  Planner page controller: state, event wiring, pagination
  object.js               Object detail page controller
  howto.js                 How To page controller (just wires up the text-size buttons)
  fontSize.js              Site-wide text size controls, shared across every page
  render.js               DOM rendering for cards, lists, and the detail panel
  scheduler.js             Plan tab's draggable timeline (rendering, resize/move/snap interactions)
  digistar.js             Digistar dome control: builds and sends commands, dome buttons
  storage.js               localStorage helpers (favorites, last location/date, plan overrides)
  geocode.js               Place-name -> lat/lon via OpenStreetMap Nominatim
  wikipedia.js             Wikipedia REST summary lookup (photo + description)
  format.js                Display formatting (times, coordinates, durations, units)
  typeLabels.js             Raw type codes ("Gxy", "PN", ...) -> readable labels
  typeIcons.js               Raw type codes -> a small inline-SVG glyph for object cards
  constellations.js         IAU constellation abbreviations -> full names
  namedObjects.js           Static Messier common-name table + reverse search
  observingGuide.js         Heuristics behind the observing guide estimates
  objectLink.js             Shared URL contract between the detail panel and object.html
```

## Data sources

- **[datastro.eu Explore API](https://www.datastro.eu/api/explore/v2.1/catalog/datasets/deep-sky-objects)**
  — the deep-sky object catalog (position, magnitude, size, type, constellation),
  ~220k objects (mostly galaxies, plus all known NGC/IC objects) drawn from:
  - **M** — Messier (bright objects of all types)
  - **NGC** — New General Catalogue (all types)
  - **IC** — Index Catalogue (all types)
  - **C** — Caldwell (bright objects of all types)
  - **Col** — Collinder (open clusters and associations)
  - **PK** — Perek + Kohoutek (planetary nebulas)
  - **PGC** — Principal Galaxy Catalog
  - **UGC** — Uppsala Galaxy Catalog
  - **ESO** — European Southern Observatory Catalogue (galaxies)
  - **Ter** — Terzian (globular clusters)
  - **Pal** — Palomar (globular clusters)

  Each record's `cat1`/`id1` (used throughout this app, e.g. `js/CelestialObject.js`)
  is the object's primary/most-commonly-used catalog and ID; `cat2`/`id2` is a
  secondary one (e.g. an NGC number for a Messier object). A `dupcat`/`dupid`
  pair means the object is better known under that *other* designation - not
  currently filtered out here, but worth knowing about if duplicate-looking
  entries ever turn up.
- **[datastro.eu Solar System data](https://www.datastro.eu/explore/dataset/donnees-systeme-solaire-solar-system-data/)**
  — physical facts for the Sun and planets (from NASA's Planetary Fact Sheets).
  The field names used are listed in `SOLAR_FIELDS` in `SolarSystemBody.js`.
- **[JPL approximate planetary positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html)**
  — the orbital elements built into `ephemeris.js` (no network request).
- **[OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/)** — geocodes
  a typed place name into coordinates. Its usage policy allows light use (about
  one request per second); Sky Tonight only geocodes when a location is typed.
- **[Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/)** — photo and
  summary text on the object detail page.

All are called directly from the browser; no server or API key required.
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
- **Sunset, sunrise, and civil dusk/dawn** (the Plan tab's twilight lines) —
  the Sun's altitude is scanned the same way, in 5-minute steps across the
  timeline, recording the moment it first crosses −0.833° (sunset/sunrise,
  accounting for atmospheric refraction and the Sun's apparent radius) and
  −6° (civil twilight). See `findSunMarks()` in `js/app.js`.

Every displayed time is shown in the **observing location's** approximate
local time, not the viewing device's own system timezone - otherwise picking
a location far from wherever the device's clock is set (a common case on
Digistar, and when testing far-off locations like Australia from elsewhere)
would show correct underlying times translated into the wrong timezone,
turning an evening sunset into something like "3 AM". Since there's no
timezone lookup, this is approximated from longitude as a fixed whole-hour
UTC offset (one 15°-wide slice per hour, via `Etc/GMT` in
`timeZoneForLongitude()`, `js/format.js`) - it can be off by up to roughly an
hour near a timezone boundary or during DST, which is an acceptable tradeoff
for an observing-planning estimate, consistent with the rest of the app's
approximate ephemeris.

Planets are different: they move against the stars, so the solar-system
dataset has no RA/Dec at all. `ephemeris.js` computes their positions from
JPL's Keplerian orbital elements (valid 1800–2050, accurate to a few
arcminutes): it places each planet and Earth on their orbits, subtracts to get
the view from Earth, and converts to RA/Dec. It also estimates apparent
magnitude (from distances and phase angle) and apparent size.
`SolarSystemBody` overrides a single method, `getEquatorialCoords(time)`, so
the rise/transit/set code above works on planets unchanged; the transit
search simply refines its estimate once to account for the planet's drift.

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

**Show on dome** doesn't slew the dome's view or zoom in — it adds the object
as one of Digistar's own built-in system objects, and turns on its marker and
label, wherever it happens to be in the current sky. The first click of a
Digistar session also creates two on-dome text labels (see below). Clicking it
for the Hercules Cluster (M13) sends:

```
navigation location 40.7128 -74.006 ground 20 180 duration 0
scene date 2026-09-24 21:22:50
sky on
skyTonightDateTime is textClass
skyTonightDateTime origin "center"
skyTonightDateTime alignment "center"
skyTonightDateTime text "{0%b %d, %Y %T}"
skyTonightDateTime parameter size 1
skyTonightDateTime parameter 0 scene date
skyTonightDateTime color white
skyTonightDateTime intensity 100
skyTonightDateTime position spherical 0 8 1 m
eye add skyTonightDateTime
skyTonightLocation is textClass
skyTonightLocation origin "center"
skyTonightLocation alignment "center"
skyTonightLocation color white
skyTonightLocation intensity 100
skyTonightLocation position spherical 0 4 1 m
eye add skyTonightLocation
skyTonightLocation text "New York, NY"
scene add M13
M13 on
M13Marker on
M13Marker daylight off
M13Label on
M13Label daylight off
```

- The first three lines move the dome's observer to the planner's location and
  set the scene date to the object's next rise, so it's right at the horizon
  at the start of the chosen night (rather than mid-transit, or below the
  horizon). `sky on` redisplays the sky for that location and date.
  **Show on dome** refuses to run at all (no commands sent) if the object's
  apex doesn't clear the horizon there - Digistar would otherwise zoom to a
  point below the horizon, which its documentation notes produces a "black
  hole" effect on the opposite side of the dome.
- The `skyTonightDateTime`/`skyTonightLocation` block (see [On-dome date/time
  and location labels](#on-dome-datetime-and-location-labels)) only runs once
  per Digistar session - later clicks just refresh `skyTonightLocation`'s text
  in case the planner's location changed, then skip straight to `scene add`.
- `scene add` adds the object's image to the scene, then `M13 on` displays it.
  `M13Marker on` and `M13Label on` turn on its paired marker and label system
  objects (confirmed on real hardware that the marker needs no separate
  `scene add`; the label is assumed to behave the same way since it's the same
  kind of paired object, but that specific case hasn't been tested). Each gets
  `daylight off` right after so it stays visible even when the sun is up in
  the scene - by default a daylight-enabled text object darkens for the night
  sky. `daylight off` goes *after* `on`, not before: confirmed on real
  hardware that setting it first didn't stick, likely because `on` applies the
  object's preference defaults (including daylight) whenever it runs.
- `scene date` is sent without a trailing time-scale keyword. The User's Guide
  documents one (e.g. `ut`), but some Digistar 7 installs reject it as an
  unexpected token; UT is the default time scale either way, so the date/time
  sent is unaffected. The `scene date` command's own reference confirms this
  same human-readable format is the correct input - the Julian date shown in
  its example (`# JD=2455208.2048`) is just a comment on what that calendar
  string converts to internally, not an alternate input format.

**Reset dome view** turns off every object shown on the dome this page
session *except* the one whose detail panel it was clicked from - so
browsing through several objects without resetting in between doesn't leave
every one of them lit up at once, but clicking reset while looking at an
object doesn't hide the very thing you're looking at. It always sends
`<name>Marker off` and `<name>Label off`; whether it also sends `<name> off`
for the base image depends on whether the app was the one that turned it on
(see the planets table below for when that's *not* the case) -
`js/digistar.js`'s `shownDigistarNames` tracks what's been shown, and how to
hide it, per object. It doesn't touch the date/time/location labels - they're
a persistent on-dome display, not tied to any one object.

Only objects Digistar has as built-in named system objects can be shown this
way: Messier M1–M110, a fixed set of about 200 NGC objects (see
`SUPPORTED_NGC_NUMBERS` in `js/digistar.js`, from the Digistar 7 User's
Guide's system object list), and the Sun/planets. Everything else — the rest
of the deep-sky catalog — isn't in Digistar's built-in library, so the
button shows a clear "isn't in Digistar's object library" message instead of
attempting anything.

Planets need less than Messier/NGC objects for their base image, but the
same as Messier/NGC objects for their marker/label - confirmed on real
hardware, e.g. `SaturnMarker`/`SaturnLabel` work exactly like `M13Marker`/
`M13Label`:

| Planets | Base image | Marker/label |
| --- | --- | --- |
| Mercury, Venus, Mars, Jupiter, Saturn | Nothing - `sky on` (already part of the location/date sync) shows them automatically. | `<name>Marker on`/`<name>Label on` (+ `daylight off` each), same as any other object. |
| Uranus, Neptune | `<name> on` | Same as above. |
| Pluto, Sun | Untested - `js/digistar.js` assumes they need `<name> on` like Uranus/Neptune, since they're not in the confirmed auto-visible set. Move `AUTO_VISIBLE_PLANET_KEYS`/`EXPLICIT_ON_PLANET_KEYS` if that turns out wrong. | Assumed to work the same way; untested. |

None of these send `scene add` (unlike Messier/NGC objects) - planets are
assumed to already be in the scene, just not always displayed. **Reset dome
view** always turns a planet's marker/label back off, but only turns its
base image off for Uranus/Neptune/Pluto/Sun - Mercury/Venus/Mars/Jupiter/
Saturn's image is never something the app turned on itself (it's part of
the normal sky via `sky on`), so reset leaves it alone rather than hiding
something the operator didn't ask it to hide.

Behavior can be adjusted in the `DOME_SETTINGS` block at the top of
`js/digistar.js`:

| Setting | Default | Effect |
| --- | --- | --- |
| `syncSky` | `true` | Match the dome's location and date to the planner before showing the object, and create/update the date/time and location labels. Turn off to leave the current sky alone. |

Object names sent to Digistar always come from the `SUPPORTED_NGC_NUMBERS`
allow-list or the M1–M110 range check — never from arbitrary user input. The
location label's text is stripped of any `"` characters before being sent,
since Digistar string arguments are double-quoted.

### Adding every favorite to the dome

The Saved Objects tab's **Add all to dome** button (`addAllFavoritesToDome()`
in `js/app.js`) syncs the dome's location/date *once*, to a moment one
minute before the *earliest* of the favorites sets — there's no single
correct dome date for a batch of objects that each rise at a different time,
unlike the per-object button (which syncs to that one object's own next
rise), but syncing just before the first one sets means as many favorites as
possible are already above the horizon without risking landing after one of
them has set. Circumpolar favorites don't constrain this (they have no set
time that day); if none of the favorites have one, this falls back to the
planner's selected date. It then adds every favorite that's both in
Digistar's object library and above the horizon that day, skipping the
rest, and reports a one-line summary such as "Added 3 favorites; skipped 2
(NGC1234, Never Rises)."

This is built on two pieces `js/digistar.js` exports for exactly this split:
`syncDomeSky()` (the location/date/label sync alone) and `addObjectToDome()`
(adding one object, given an already-known `apexBelowHorizon`). The
per-object `sendToDome()` is just those two called back to back. Its
**Reset dome view** counterpart (`resetAllDome()`) turns off *every* object
shown this session with no exclusion, unlike the per-object detail panel's
reset — there's no single "current" object in a batch context to spare.

### On-dome date/time and location labels

Two custom `textClass` objects (`js/digistar.js`'s `ensureLabelObjectsExist()`),
parented to `eye` rather than `scene` so they act as a fixed on-screen display
rather than sitting at a point in the sky:

- `skyTonightDateTime` — its `text` binds to `parameter 0`, which is tied to
  the `scene` object's own `date` attribute (`parameter 0 scene date`), so it
  keeps itself current as the scene date changes rather than needing to be
  re-sent. The `{0%b %d, %Y %T}` format specifiers are `strftime`-style, per
  the `textClass` reference's formatted-text support.
- `skyTonightLocation` — a plain static label, refreshed with the planner's
  location string (e.g. "New York, NY") on every **Show on dome** click.

Both are created once per Digistar session (a module-level flag in
`js/digistar.js` tracks this, not anything persisted) using Digistar's
`<name> is <class>` object-creation syntax, confirmed working on real
hardware. Re-running that creation command isn't attempted on later clicks
within the same page load - except from a **Reset dome view** button (either
one), which always forces both labels to be recreated and the location text
reapplied, regardless of that flag. This is the recovery path if an operator
clears the scene from Digistar's own console: that deletes the label objects
without the page knowing, so every later sync keeps skipping their setup
commands (the flag still thinks they exist) until a reset forces it. See
[Known limitations](#known-limitations) for what happens on a page reload.

## Known limitations

- The observing-guide numbers are estimates from magnitude/size alone — they
  don't account for surface brightness, so small-but-bright objects (like the
  Ring Nebula) can get an optimistic equipment recommendation.
- The "peaks above," "apex between," "up between," and "altitude above"
  filters can only be evaluated per-object (the API has no concept of
  horizon altitude), so they run against a capped batch of 100 server-side
  matches rather than the entire matching set. On the Messier catalog this
  covers everything; on "all catalogs" with a broad filter, a small number
  of qualifying objects outside that batch could be missed.
- Planet positions ignore precession, nutation, and light-time (like the
  deep-sky coordinates, they're J2000), and Saturn's magnitude ignores its
  rings, so it can read up to ~1 mag dimmer than reality. The Moon isn't
  included: it isn't in the solar-system dataset, and it moves too fast for
  this simple orbital model.
- The time-window filters ("apex between," "up between") only check whether
  an object is above the horizon during that window, not whether the sky is
  actually dark then, so a planet can match a daytime window just as easily
  as a nighttime one.
- Displayed times are shown in the observing location's *approximate* local
  time - a fixed whole-hour UTC offset estimated from longitude, not a real
  timezone/DST lookup (see [How the astronomy works](#how-the-astronomy-works)).
  It can be off by up to roughly an hour near a timezone boundary or during
  DST.
- The Messier common-name table and Wikipedia lookups only reliably cover
  well-known objects; obscure NGC/IC/PGC entries usually won't have a photo or
  common name available.
- `sky on` briefly fades the dome to black and back. If that's distracting
  during a show, set `syncSky` to `false`.
- Digistar's embedded browser was Chromium 84 as of the release notes, so the
  code avoids newer JavaScript syntax (such as `??=`) *and* newer CSS - the
  `inset` shorthand property (`inset: 0;` for `top/right/bottom/left: 0;`)
  didn't ship until Chrome 87, and was the cause of a real bug: the Plan
  tab's altitude graphs, sunset/sunrise/twilight lines, and draggable bars
  all depend on elements positioned with `inset: 0` in `style.css`, and on
  Digistar's browser that property is simply unrecognized and ignored -
  leaving those elements with no actual top/right/bottom/left, so they
  collapsed instead of filling their container. Fixed by spelling out
  `top`/`right`/`bottom`/`left` individually instead. There's also a
  second confirmed real-hardware bug, this one about *text* rather than
  code: the Prev/Next buttons and the "Back to planner" links (all typed
  directly into static HTML, e.g. `← Prev` in `index.html`) rendered as
  garbled text, while the identical `→` character used the identical way
  in "More details" and "View on Wikipedia" - built as JS template-literal
  strings and inserted via `innerHTML` at runtime, rather than sitting in
  the HTML file itself - rendered correctly. The UTF-8 charset meta tag is
  already the first thing in every page's `<head>`, and the same codepoint
  survives fine once it's JS rather than raw HTML, so this doesn't look
  like a missing font glyph after all - more likely something in however
  the `.html` files specifically reach Digistar (its web server, or a
  deployment/copy step) re-encodes them along the way. Fixed by switching
  the static-HTML arrows to plain ASCII (`<`/`>`) rather than chasing the
  transcoding itself, and the two JS-built ones were changed to match for
  consistency even though they weren't broken. If another non-ASCII
  character typed directly into an `.html` file (★, ↺, ‹, ›, em/en dashes,
  prime marks, °, …) turns up broken on the dome, this is the first thing
  to suspect - the same fix applies (ASCII in, ASCII out), and whether
  that same character is fine when it instead comes from a JS string is a
  useful data point for narrowing down where the real re-encoding happens.
  Keep this in mind (JS and CSS compatibility, *and* which characters you
  type directly into `.html` files) when making changes - test newer-
  looking CSS properties against [caniuse.com](https://caniuse.com) for
  Chrome 84 support, and prefer plain ASCII in the `.html` files for
  anything Digistar will render, since this sandbox can't run Digistar's
  actual browser or web server to catch either kind of problem directly.
- The Digistar User's Guide uses `/digistar/execute` in its HTTP command
  reference but `/software/execute` in its sample page. Sky Tonight uses the
  former; if commands fail with HTTP 404, change `EXECUTE_PATH` in
  `js/digistar.js`.
- Favorites and the last location are stored per site address, so favorites
  saved on a public copy of Sky Tonight won't appear on the Digistar-hosted
  one, and vice versa.
- Inside a Digistar control panel, the "View on Wikipedia" link opens in a new
  window, which will likely be the Host computer's regular browser.
- The "labels created once per Digistar session" tracking in
  `ensureLabelObjectsExist()` is a page-load-scoped JS variable, not anything
  Digistar-side, so reloading the planner page makes it try to re-create
  `skyTonightDateTime`/`skyTonightLocation` even though Digistar's own object
  state outlives the page. Confirmed on real hardware that Digistar errors on
  `<name> is <class>` for a name already in use, so those specific setup
  commands are sent with errors swallowed rather than surfaced, precisely so
  this can't block showing the actual object on the dome.
