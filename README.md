# Detroit Food Source

A map of where Metro Detroit's food comes from: urban farms, orchards, dairies, markets and food banks around the region, Michigan growing regions, and sources from farther away. It runs on GitHub Pages as plain HTML, CSS and JavaScript, so there's no build step.

## Files

| File | What it is |
|---|---|
| `data/sources.csv` | **The data.** One row per food source. This is what you edit when you update the site. |
| `config.js` | The "last updated" date, plus an optional Google Sheet link. |
| `index.html`, `style.css`, `app.js` | The page itself. You shouldn't need to touch these when updating. |

## Updating the site (every month or two)

1. On GitHub, open `data/sources.csv` and click the pencil icon. GitHub shows it as a table, and the editor lets you change rows.
2. Add, change or remove rows.
3. Open `config.js` and change `updated` to the current month, e.g. `"2026-12"`.
4. Commit the changes. The site updates within a minute or two.

### Columns in `sources.csv`

| Column | Example | Notes |
|---|---|---|
| `name` | `Eastern Market` | |
| `type` | `Market` | Sets the dot color. Built-in types: Urban farm, Farm, Dairy, Meat, Market, Wholesale, Food rescue, Growing region, Port of entry. A new type works too and shows in gray. |
| `scope` | `Metro Detroit` | `Metro Detroit`, `Michigan`, or `Beyond Michigan`. Anything outside Metro Detroit gets a line drawn to Detroit. |
| `lat`, `lng` | `42.3477`, `-83.0418` | In Google Maps, right-click a spot and click the numbers to copy them. |
| `place` | `Royal Oak` | Town or area shown under the name. |
| `products` | `Apples, cider` | |
| `season` | `Jun-Oct` | `Year-round`, a range like `Jun-Oct` or `Nov-Apr`, or several like `May-Jun, Sep-Oct`. Used by the "in season" filter. |
| `website` | `https://easternmarket.org` | Optional. Must start with `https://`. |
| `notes` | | A sentence or two about the place. |

If a value contains a comma, wrap it in double quotes, like `"Apples, cider"`. GitHub's editor and spreadsheet apps do this for you.

### Using a Google Sheet instead (optional)

1. Import `data/sources.csv` into a Google Sheet. Keep the same column names in row 1.
2. In the sheet, go to **File → Share → Publish to web**, pick the sheet, choose **Comma-separated values (.csv)**, and publish.
3. Paste the link into `sheetCsvUrl` in `config.js`.

After that, edits in the sheet show up on the site without touching GitHub. Google can take a few minutes to refresh the published copy.

## Turning on GitHub Pages

1. In the repo on GitHub, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**, pick the branch (`main`) and the `/ (root)` folder, and save.
3. After a minute the site is live at `https://mpioszak.github.io/detroitfoodsource/`.

## Previewing on your computer

The page loads its data with a web request, so opening `index.html` directly from your files won't show any pins. Run a small local web server in this folder instead, for example the Live Server extension in VS Code.

## Credits

Map: [Leaflet](https://leafletjs.com), map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. CSV parsing: [Papa Parse](https://www.papaparse.com).
