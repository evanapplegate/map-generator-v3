# Map Generator v3

An LLM-mediated map generator: describe a map in plain language, and get a vector map you can export as SVG, PPTX, or an embeddable D3.js bundle.

![Map Generator screenshot](https://github.com/user-attachments/assets/711bae76-e459-4307-8096-79106d524089)

## What it does

1. **Describe the map** — e.g. “world map with Australia and the U.S. labeled, color them green” or “mark all ASEAN countries green, Utah in red, Texas in gold, label NYC and Tokyo”.
2. **Claude interprets it** — The app sends your text to Claude (Anthropic). Claude returns a structured JSON spec: which countries/states to highlight, colors, which cities to show, whether to show region labels, etc.
3. **D3 renders it** — The spec is passed to D3.js, which draws a world or US map from GeoJSON, with fills, borders, city dots (and stars for capitals), and Optima 10pt labels.
4. **Export** — You can download:
   - **SVG** — Layered vector map to clean up in Illustrator (or similar).
   - **PPTX** — Slide with the map as an image; in PowerPoint use “Convert to Shape” to make it editable.
   - **D3.js bundle** — Self-contained HTML + JS + GeoJSON for embedding the interactive map elsewhere.

## What it uses

### Backend

- **Cloudflare Pages** — Static file serving, plus one Pages Function.
- **Anthropic Claude API** — LLM calls are proxied through a Cloudflare Pages Function (`POST /api/claude`, `functions/api/claude.js`) so the API key stays in `CLAUDE_API_KEY` and is never exposed to the browser.

### Frontend

- **D3.js v7** — Map projection, GeoJSON rendering, SVG output.
- **PptxGenJS** — Builds the PPTX and embeds the map image.
- **JSZip** — Used for the D3 bundle export.
- **Vanilla JS modules** — No framework; `main.js` wires the UI to `llmMapGenerator.js`, `mapVisualization.js`, `exportPptx.js`, and `exportD3Bundle.js`.

### Data

- **GeoJSON** in `geojson/` (and mirrored under `public/` for the bundle): countries, US states, country/US boundaries, disputed boundaries, cities. The LLM is prompted with field names (e.g. `NAME`, `ISO_A3`, `postal`, `ADM0NAME`) so it can target the right features.

### LLM flow

- The Pages Function sends the user’s description to Claude Opus 5.5 with a long system prompt (map rules, color palette, region/city handling, few-shot examples) and a **tool**: `render_map` with a JSON schema. The prompt tells Claude to always respond with a `render_map` call; that JSON is what the frontend uses to drive D3. Each **Generate Map** makes two calls and shows two maps.

## Run locally

```bash
echo "CLAUDE_API_KEY=your_key" > .dev.vars
npm run dev
```

App runs at `http://localhost:8788`. Open the page, type a map description, click **Generate Map**, then use the export buttons once a map is rendered.

## Deploy

Hosted on Cloudflare Pages. `npm run deploy` copies the site into `dist/` and uploads it with Wrangler. `CLAUDE_API_KEY` is a Pages secret (`npx wrangler pages secret put CLAUDE_API_KEY`), and the `RATE_LIMIT` KV namespace in `wrangler.toml` backs the limits in `functions/api/claude.js`.
