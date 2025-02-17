import { MapData } from './types';
import JSZip from 'jszip';

export async function generateD3Bundle(data: MapData, geojsonData: any): Promise<Blob> {
  const zip = new JSZip();

  // Create directory structure
  const srcDir = zip.folder("src");
  const dataDir = zip.folder("data");
  const cssDir = zip.folder("css");
  const docsDir = zip.folder("docs");

  // Core visualization code
  const visualizationCode = `
const renderMap = async (config, geojsonPath) => {
  const width = 960;
  const height = 600;
  const isUSMap = config.mapType === 'us';

  // Load GeoJSON data
  const [regionsResponse, boundsResponse] = await Promise.all([
    fetch(isUSMap ? 'data/US_states.geojson' : 'data/countries.geojson'),
    fetch(isUSMap ? 'data/US_bounds.geojson' : 'data/country_bounds.geojson')
  ]);

  const regions = await regionsResponse.json();
  const bounds = await boundsResponse.json();

  const svg = d3.select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height].join(" "))
    .attr("style", "max-width: 100%; height: auto;")
    .style("background-color", "#F9F5F1");

  const projection = isUSMap 
    ? d3.geoAlbersUsa().scale(1000).translate([width / 2, height / 2])
    : d3.geoEqualEarth().scale(180).translate([width / 2, height / 2]);

  const path = d3.geoPath().projection(projection);

  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip");

  // Draw regions
  svg.append("g")
    .selectAll("path")
    .data(regions.features)
    .join("path")
    .attr("d", path)
    .attr("fill", (d) => {
      const code = isUSMap 
        ? d.properties?.postal 
        : (d.properties?.ISO_A3 || d.properties?.iso_a3);
      return config.highlightColors?.[code] || config.defaultFill || "#f3f3f3";
    })
    .attr("stroke", "none")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      const name = d.properties?.NAME || d.properties?.name || 'Unknown';
      const code = isUSMap 
        ? d.properties?.postal 
        : (d.properties?.ISO_A3 || d.properties?.iso_a3 || 'Unknown');
      tooltip.style("visibility", "visible")
        .html("<strong>" + name + "</strong> (" + code + ")");
    })
    .on("mousemove", (event) => {
      tooltip.style("top", (event.pageY - 10) + "px")
        .style("left", (event.pageX + 10) + "px");
    })
    .on("mouseout", () => tooltip.style("visibility", "hidden"));

  // Draw bounds
  svg.append("path")
    .datum(bounds)
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "#F9F5F1")
    .attr("stroke-width", "1");

  // Add labels
  if (config.showLabels) {
    svg.append("g")
      .selectAll("text")
      .data(regions.features)
      .join("text")
      .attr("transform", (d) => {
        const centroid = path.centroid(d);
        if (isNaN(centroid[0]) || isNaN(centroid[1])) return null;
        return "translate(" + centroid[0] + "," + centroid[1] + ")";
      })
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .text((d) => {
        const code = isUSMap 
          ? d.properties?.postal 
          : (d.properties?.ISO_A3 || d.properties?.iso_a3);
        const name = isUSMap ? code : (d.properties?.NAME || d.properties?.name || code);
        return config.highlightColors?.[code] ? name : "";
      })
      .attr("fill", "#000000")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .style("pointer-events", "none");
  }
};`;

  // HTML template
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>D3.js Map Visualization</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <div id="map"></div>
  <script src="src/visualization.js"></script>
  <script>
    // Configuration for the map
    const config = ${JSON.stringify(data, null, 2)};
    
    // Load and render map
    renderMap(config);
  </script>
</body>
</html>`;

  // CSS
  const css = `
body {
  background-color: #F9F5F1;
  color: #8d7a69;
  font-family: Optima, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  margin: 0;
  padding: 20px;
}
#map {
  max-width: 960px;
  margin: 0 auto;
}
.tooltip {
  position: absolute;
  visibility: hidden;
  background-color: #ffffff;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  font-size: 14px;
  pointer-events: none;
}`;

  // Add files to their directories
  zip.file("index.html", html);
  cssDir?.file("styles.css", css);
  srcDir?.file("visualization.js", visualizationCode);

  // Split the combined geojsonData into separate files
  if (data.mapType === 'us') {
    dataDir?.file('US_states.geojson', JSON.stringify(geojsonData.regions, null, 2));
    dataDir?.file('US_bounds.geojson', JSON.stringify(geojsonData.bounds, null, 2));
  } else {
    dataDir?.file('countries.geojson', JSON.stringify(geojsonData.regions, null, 2));
    dataDir?.file('country_bounds.geojson', JSON.stringify(geojsonData.bounds, null, 2));
  }

  // Add documentation
  zip.file("README.md", `# D3.js Map Visualization Bundle

A self-contained, embeddable map visualization generated with D3.js.

## Directory Structure

\`\`\`
map-bundle/
├── index.html          # Demo page
├── css/               
│   └── styles.css      # Map styles
├── src/
│   └── visualization.js # D3.js visualization code
├── data/              # GeoJSON data files
│   ├── US_states.geojson
│   ├── US_bounds.geojson
│   ├── countries.geojson
│   └── country_bounds.geojson
└── docs/
    ├── embedding.md    # Embedding guide
    └── api.md          # API documentation
\`\`\`

## Quick Start

1. Extract the zip file
2. Serve the directory with a local server:
   - Python: \`python -m http.server\`
   - Node.js: \`npx serve\`
   - PHP: \`php -S localhost:8000\`
3. Open \`index.html\` in your browser

## Embedding in Your Website

### Method 1: Full Integration

1. Copy the entire directory structure to your project
2. Add these tags to your HTML:

\`\`\`html
<link rel="stylesheet" href="path/to/css/styles.css">
<div id="map"></div>
<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="path/to/src/visualization.js"></script>
<script>
  const config = {
    mapType: 'us',                    # or 'world'
    defaultFill: '#f3f3f3',          # default region color
    highlightColors: {               # region-specific colors
      'CA': '#ff0000',              # e.g., California in red
      'NY': '#00ff00'               # New York in green
    },
    showLabels: true                 # show region labels
  };
  
  renderMap(config);
</script>
\`\`\`

## GeoJSON Files

The bundle includes these GeoJSON files:

1. US Maps:
   - \`US_states.geojson\`: Individual state polygons
   - \`US_bounds.geojson\`: US boundary outline

2. World Maps:
   - \`countries.geojson\`: Individual country polygons
   - \`country_bounds.geojson\`: Country boundary outlines

The visualization automatically loads the correct files based on \`config.mapType\`.

## CORS Considerations

The GeoJSON data is loaded via fetch(), so you'll need to:

1. Serve the files from the same domain, OR
2. Enable CORS on your server, OR
3. Host the GeoJSON files on a CORS-enabled CDN

Example CORS headers for your server:
\`\`\`
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
Access-Control-Allow-Headers: Content-Type
\`\`\`

## Dependencies

- D3.js v7.x

## Support

https://github.com/evanapplegate/map-generator-v2.`);

  // Add embedding.md and api.md with the same content as before
  docsDir?.file("embedding.md", `# Embedding Guide

## Basic Integration

The simplest way to embed the map is to include the necessary files and initialize the visualization:

\`\`\`html
<link rel="stylesheet" href="css/styles.css">
<div id="map"></div>
<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="src/visualization.js"></script>
<script>
  const config = {
    mapType: 'us',
    defaultFill: '#f3f3f3',
    highlightColors: {
      'CA': '#ff0000'
    },
    showLabels: true
  };
  
  renderMap(config);
</script>
\`\`\`

## Advanced Integration

### 1. Custom Styling

You can override the default styles by adding your own CSS:

\`\`\`css
#map {
  max-width: 1200px;  # Wider map
}

.tooltip {
  background: rgba(0,0,0,0.8);  # Dark tooltips
  color: white;
}
\`\`\`

### 2. Multiple Maps

To show multiple maps on the same page:

\`\`\`html
<div id="map1"></div>
<div id="map2"></div>

<script>
  const config1 = { mapType: 'us', /* ... */ };
  const config2 = { mapType: 'world', /* ... */ };
  
  renderMap(config1);
  renderMap(config2);
</script>
\`\`\`

### 3. Dynamic Updates

The map can be updated dynamically:

\`\`\`javascript
# Update colors
config.highlightColors['CA'] = '#0000ff';
renderMap(config);

# Toggle labels
config.showLabels = !config.showLabels;
renderMap(config);
\`\`\`

### 4. Event Handling

Add custom event handlers:

\`\`\`javascript
d3.select('#map')
  .selectAll('path')
  .on('click', (event, d) => {
    console.log('Clicked region:', d.properties.name);
  });
\`\`\`

## Troubleshooting

### Common Issues

1. **Map not showing**
   - Check if all files are properly served
   - Verify paths in your HTML
   - Check browser console for errors

2. **CORS errors**
   - Serve files from same domain
   - Enable CORS on your server
   - Use a CORS proxy

3. **Styling issues**
   - Ensure CSS file is properly loaded
   - Check for CSS conflicts
   - Use browser dev tools to inspect

### Best Practices

1. Always serve files from a web server
2. Minify files for production
3. Use relative paths
4. Handle errors gracefully
5. Test across browsers`);

  docsDir?.file("api.md", `# API Documentation

## Core Functions

### renderMap(config, geojsonPath)

Renders the map visualization.

#### Parameters

\`\`\`typescript
interface MapConfig {
  mapType: 'us' | 'world';
  defaultFill?: string;
  highlightColors?: {
    [code: string]: string;
  };
  showLabels?: boolean;
}

geojsonPath: string  # Path to GeoJSON file
\`\`\`

#### Example

\`\`\`javascript
const config = {
  mapType: 'us',
  defaultFill: '#f3f3f3',
  highlightColors: {
    'CA': '#ff0000',
    'NY': '#00ff00'
  },
  showLabels: true
};

renderMap(config);
\`\`\`

## GeoJSON Format

The map expects GeoJSON in this format:

\`\`\`typescript
interface GeoJSONData {
  regions: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      properties: {
        NAME?: string;
        name?: string;
        postal?: string;    # US states
        ISO_A3?: string;    # Countries
        iso_a3?: string;    # Countries (alternate)
      };
      geometry: {
        type: 'MultiPolygon' | 'Polygon';
        coordinates: number[][][];
      };
    }>;
  };
  bounds: {
    type: 'Feature';
    geometry: {
      type: 'MultiPolygon' | 'Polygon';
      coordinates: number[][][];
    };
  };
}
\`\`\`

## Styling Reference

### CSS Classes

1. \`#map\`
   - Container for the visualization
   - Controls map size and positioning

2. \`.tooltip\`
   - Popup tooltips on hover
   - Styling for region information

3. \`text\`
   - Region labels
   - Font and positioning

### D3.js Configuration

1. Projections
   - US: Albers USA
   - World: Equal Earth

2. Dimensions
   - Width: 960px
   - Height: 600px
   - Responsive scaling

## Events

The visualization emits these events:

1. \`mouseover\`
   - When hovering over a region
   - Provides region data

2. \`mouseout\`
   - When leaving a region
   - Hides tooltip

3. \`mousemove\`
   - While moving over a region
   - Updates tooltip position

## Browser Support

Requires browsers with support for:

1. ES6+ JavaScript
2. Fetch API
3. SVG
4. CSS Grid/Flexbox`);

  return await zip.generateAsync({ type: "blob" });
}
