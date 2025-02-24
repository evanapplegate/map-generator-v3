/**
 * @typedef {Object} MapData
 */

import { log } from './logger.js';
import { currentMapData } from './main.js';

/**
 * Load GeoJSON data
 * @returns {Promise<Object>} GeoJSON data
 */
async function loadGeoJSON() {
    const [countries, countryBounds, states, stateBounds] = await Promise.all([
        fetch('/geojson/countries.geojson').then(r => r.json()),
        fetch('/geojson/country_bounds.geojson').then(r => r.json()),
        fetch('/geojson/US_states.geojson').then(r => r.json()),
        fetch('/geojson/US_bounds.geojson').then(r => r.json())
    ]);
    
    return {
        countries,
        countryBounds,
        states,
        stateBounds
    };
}

const HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>D3.js Map Visualization</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Optima, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
            background: #ffffff;
        }
        #map { 
            width: 100%; 
            height: 800px;
            background: #F9F5F1;
            border-radius: 4px;
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
        }
    </style>
</head>
<body>
    <div id="map"></div>
    <script src="src/visualization.js"></script>
</body>
</html>`;

const CSS = `
#map { 
    width: 100%; 
    height: 600px; 
}`;

/**
 * Generate visualization code
 * @param {MapData} config - Map configuration
 * @returns {string} JavaScript code
 */
function generateVisualizationCode(mapData) {
    return `
// Initialize map
const container = document.getElementById('map');
const width = container.clientWidth;
const height = container.clientHeight;
const aspect = width / height;

// Map data
const highlightColors = ${JSON.stringify(mapData.highlightColors)};
const defaultFill = '${mapData.defaultFill}';
const mapType = '${mapData.mapType}';
const stateList = ${JSON.stringify(mapData.states || [])};
const cities = ${JSON.stringify(mapData.cities || [])};
const showLabels = ${mapData.showLabels};
const borderColor = '${mapData.borderColor}';

// Create SVG
const svg = d3.select('#map')
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('viewBox', \`0 0 \${width} \${height}\`)
    .style('background-color', '#F9F5F1');

// Create layers
const regionsLayer = svg.append('g').attr('id', 'regions-layer');
const boundsLayer = svg.append('g').attr('id', 'bounds-layer');
const stateBoundsLayer = svg.append('g').attr('id', 'state-bounds-layer');
const disputedBoundsLayer = svg.append('g').attr('id', 'disputed_bounds');
const cityDotsLayer = svg.append('g').attr('id', 'city-dots');
const cityLabelsLayer = svg.append('g').attr('id', 'city-labels');
const countryLabelsLayer = svg.append('g').attr('id', 'country-labels');

// Create tooltip
const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip');

// Load GeoJSON data
Promise.all([
    d3.json('src/geojson/countries.geojson'),
    d3.json('src/geojson/US_states.geojson'),
    d3.json('src/geojson/country_bounds.geojson'),
    d3.json('src/geojson/US_bounds.geojson'),
    d3.json('src/geojson/cities.geojson'),
    mapType === 'world' ? d3.json('src/geojson/country_disputed_bounds.geojson') : Promise.resolve(null)
]).then(([countries, states, countryBounds, stateBounds, citiesData, disputedBounds]) => {
    if (!countries?.features || !states?.features || !countryBounds?.features || !stateBounds?.features || !citiesData?.features) {
        throw new Error('Failed to load one or more GeoJSON files');
    }

    // Create projection based on map type
    const projection = mapType === 'us'
        ? d3.geoAlbersUsa()
            .scale(width * 0.45)
            .translate([width / 2, height / 2])
        : d3.geoEqualEarth()
            .scale(Math.min(width / 4.6, height / 2.9))
            .translate([width / 2, height / 2])
            .rotate([-11, 0]);  // Rotate globe 11° east to wrap Russia around
        
    // Create path generator
    const path = d3.geoPath().projection(projection);
    
    // For US maps, only use state features
    // For world maps, check if we need to include US states
    const hasHighlightedStates = stateList?.some(s => 
        /^[A-Z]{2}$/.test(s.postalCode) && highlightColors?.[s.postalCode]
    );
    
    const features = mapType === 'us' ? states.features :
        hasHighlightedStates ? 
            [...countries.features.filter(f => f.properties.ISO_A3 !== 'USA'), ...states.features] :
            countries.features;
            
    regionsLayer.selectAll('path')
        .data(features)
        .join('path')
        .attr('d', path)
        .attr('fill', d => {
            const code = d.properties.postal || d.properties.ISO_A3;
            return highlightColors[code] || defaultFill;
        })
        .attr('stroke', 'none');  // Remove strokes from regions
    boundsLayer.selectAll('path')
        .data(mapType === 'us' ? stateBounds.features : countryBounds.features)
        .join('path')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', '#F9F5F1')
        .attr('stroke-width', '1');
        
    // Draw state bounds in world view
    if (mapType === 'world' && hasHighlightedStates) {
        stateBoundsLayer.selectAll('path')
            .data(stateBounds.features)
            .join('path')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', '#F9F5F1')
            .attr('stroke-width', '1');
    }

    // Draw disputed bounds for world maps
    if (mapType === 'world' && disputedBounds?.features) {
        disputedBoundsLayer.selectAll('path')
            .data(disputedBounds.features)
            .join('path')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', '#F9F5F1')
            .attr('stroke-width', '1')
            .attr('stroke-dasharray', '1,1');
    }

    // Add cities and labels
    if (cities) {
        const requestedCities = citiesData.features.filter(city => 
            cities.some(c => city.properties.NAME === c.name)
        );
        
        // City dots
        cityDotsLayer.selectAll('circle')
           .data(requestedCities)
           .join('circle')
           .attr('cx', d => projection(d.geometry.coordinates)[0])
           .attr('cy', d => projection(d.geometry.coordinates)[1])
           .attr('r', 1)
           .attr('fill', '#000')
           .attr('stroke', 'none');
           
        // City labels
        cityLabelsLayer.selectAll('text')
           .data(requestedCities)
           .join('text')
           .attr('x', d => projection(d.geometry.coordinates)[0] + 3)
           .attr('y', d => projection(d.geometry.coordinates)[1])
           .text(d => d.properties.NAME)
           .attr('font-size', '8px')
           .attr('fill', '#000000')
           .style('font-weight', 'normal');
    }
    
    // Add country/state labels
    if (showLabels) {
        const features = mapType === 'us' ? states.features : countries.features;
        countryLabelsLayer.selectAll('text')
            .data(features)
            .join('text')
            .attr('x', d => path.centroid(d)[0])
            .attr('y', d => path.centroid(d)[1])
            .text(d => {
                const code = d.properties.postal || d.properties.ISO_A3;
                return highlightColors[code] ? (d.properties.name || d.properties.NAME) : '';
            })
            .attr('text-anchor', 'middle')
            .attr('font-size', '8px')
            .attr('fill', '#000000')
            .style('font-weight', 'bold')
            .style('display', d => {
                const code = d.properties.postal || d.properties.ISO_A3;
                return highlightColors[code] ? 'block' : 'none';
            });
    }
        
    // Add tooltip
    regionsLayer.selectAll('path')
        .on('mouseover', (event, d) => {
            const name = d.properties.name || d.properties.NAME;
            const code = d.properties.postal || d.properties.ISO_A3;
            
            tooltip
                .style('visibility', 'visible')
                .html(\`<strong>\${name}</strong>\`);
        })
        .on('mousemove', (event) => {
            tooltip
                .style('top', (event.pageY - 10) + 'px')
                .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', () => {
            tooltip.style('visibility', 'hidden');
        });
}).catch(error => {
    console.error('Error loading GeoJSON:', error);
    document.getElementById('map').innerHTML = \`Error: \${error.message}\`;
});`;
}

/**
 * Export D3 visualization as standalone bundle
 * @param {HTMLElement} container - Map container element
 * @returns {Promise<Blob>} Bundle as zip file
 */
export async function exportBundle(container) {
    try {
        const zip = new JSZip();
        
        // Add HTML template
        zip.file('index.html', HTML_TEMPLATE);
        
        // Create src directory
        const src = zip.folder('src');
        
        // Add visualization code
        const svg = container.querySelector('svg');
        if (!svg) throw new Error('No map found to export');
        
        const mapData = {
            width: container.clientWidth,
            height: container.clientHeight,
            svg: svg.outerHTML,
            highlightColors: currentMapData.highlightColors,
            defaultFill: currentMapData.defaultFill,
            mapType: currentMapData.mapType,
            labels: currentMapData.labels,
            states: currentMapData.states,
            cities: currentMapData.cities,
            showLabels: currentMapData.showLabels,
            borderColor: currentMapData.borderColor
        };
        
        src.file('visualization.js', generateVisualizationCode(mapData));
        
        // Create src/geojson directory for GeoJSON files
        const geojsonDir = zip.folder('src/geojson');
        
        // Load and add GeoJSON files
        const [countriesGeojson, statesGeojson, countryBoundsGeojson, stateBoundsGeojson, citiesGeojson, disputedBoundsGeojson] = await Promise.all([
            fetch('/geojson/countries.geojson').then(r => r.json()),
            fetch('/geojson/US_states.geojson').then(r => r.json()),
            fetch('/geojson/country_bounds.geojson').then(r => r.json()),
            fetch('/geojson/US_bounds.geojson').then(r => r.json()),
            fetch('/geojson/cities.geojson').then(r => r.json()),
            mapData.mapType === 'world' ? fetch('/geojson/country_disputed_bounds.geojson').then(r => r.json()) : Promise.resolve(null)
        ]);
        
        // Add GeoJSON files
        geojsonDir.file('countries.geojson', JSON.stringify(countriesGeojson));
        geojsonDir.file('US_states.geojson', JSON.stringify(statesGeojson));
        geojsonDir.file('country_bounds.geojson', JSON.stringify(countryBoundsGeojson));
        geojsonDir.file('US_bounds.geojson', JSON.stringify(stateBoundsGeojson));
        geojsonDir.file('cities.geojson', JSON.stringify(citiesGeojson));
        geojsonDir.file('country_disputed_bounds.geojson', JSON.stringify(disputedBoundsGeojson));
        
        // Add README to root
        zip.file('README.md', `# Testing the bundle

To test the bundle, navigate to the folder and run a simple server with Python:

\`\`\`bash
python -m http.server 8000
\`\`\`

Then, open a web browser to http://localhost:8000/

# Embedding the map on any web site

To embed the map on any web site, simply copy the contents of this whole folder and serve it from your web server. You can then include the map in an iframe:

\`\`\`html
<iframe src="http://example.com/map/" width="100%" height="600"></iframe>
\`\`\`

# Embedding the map directly

To embed the map on any web site without using an iframe, follow these steps:

1. Copy the contents of this folder to your web server.
2. In your HTML file where you want to embed the map, add the following:

\`\`\`html
<div id="map"></div>
<script src="https://d3js.org/d3.v7.min.js"></script>
<link rel="stylesheet" href="css/styles.css">
<script src="src/visualization.js"></script>
\`\`\`

Make sure the paths to the CSS and JavaScript files are correct relative to your HTML file.

3. Adjust the size of the map container in your CSS as needed:

\`\`\`css
#map {
    width: 100%;
    height: 600px;
}
\`\`\`
`);

        // Add CSS
        const css = zip.folder('css');
        css.file('styles.css', `
            body {
                margin: 0;
                padding: 20px;
                font-family: Optima, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
                background: #ffffff;
            }
            #map { 
                width: 100%;
                height: 600px;
                background: #F9F5F1;
                border-radius: 4px;
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
            }
        `);
        
        // Generate bundle
        return await zip.generateAsync({ type: 'blob' });
        
    } catch (error) {
        log('EXPORT', 'Error exporting bundle', { error });
        throw error;
    }
}
