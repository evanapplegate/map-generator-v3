/**
 * @typedef {Object} MapData
 */

import { log } from './logger.js';

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
function generateVisualizationCode(config) {
    return `// D3.js Map Visualization
const width = document.getElementById('map').clientWidth;
const height = document.getElementById('map').clientHeight;
const aspect = width / height;

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
const labelsLayer = svg.append('g').attr('id', 'labels-layer');

// Create projection
const projection = '${config.mapType}' === 'us'
    ? d3.geoAlbersUsa()
        .scale(width * 1.3)
        .translate([width / 2, height / 2])
    : d3.geoEqualEarth()
        .scale(Math.min(width / 6.5, height / 4))
        .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

// Create tooltip
const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('visibility', 'hidden')
    .style('background-color', '#ffffff')
    .style('padding', '10px')
    .style('border-radius', '5px')
    .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)');

// Load required data
const dataPromises = [];
if ('${config.mapType}' === 'world') {
    dataPromises.push(
        d3.json('data/countries.geojson'),
        d3.json('data/country_bounds.geojson')
    );
}

// Only load states if it's a US map or if specific states are highlighted
const hasHighlightedStates = ${JSON.stringify(config.states?.some(s => 
    /^[A-Z]{2}$/.test(s.postalCode) && config.highlightColors?.[s.postalCode]
))};

if ('${config.mapType}' === 'us' || hasHighlightedStates) {
    dataPromises.push(
        d3.json('data/US_states.geojson'),
        d3.json('data/US_bounds.geojson')
    );
}

Promise.all(dataPromises).then(geoData => {
    let dataIndex = 0;
    const countries = '${config.mapType}' === 'world' ? geoData[dataIndex++] : null;
    const countryBounds = '${config.mapType}' === 'world' ? geoData[dataIndex++] : null;
    const states = ('${config.mapType}' === 'us' || hasHighlightedStates) ? geoData[dataIndex++] : null;
    const stateBounds = ('${config.mapType}' === 'us' || hasHighlightedStates) ? geoData[dataIndex++] : null;

    // Merge features for world map with highlighted states
    let regions = null;
    let bounds = null;

    if ('${config.mapType}' === 'us') {
        regions = states;
        bounds = stateBounds;
    } else if ('${config.mapType}' === 'world') {
        if (hasHighlightedStates) {
            // Merge US states with countries, excluding USA
            const nonUSACountries = countries.features.filter(f => 
                f.properties.ISO_A3 !== 'USA'
            );
            regions = {
                type: 'FeatureCollection',
                features: [...nonUSACountries, ...states.features]
            };
            
            // Merge bounds
            const nonUSABounds = countryBounds.features.filter(f => 
                f.properties.ISO_A3 !== 'USA'
            );
            bounds = {
                type: 'FeatureCollection',
                features: [...nonUSABounds, ...stateBounds.features]
            };
        } else {
            regions = countries;
            bounds = countryBounds;
        }
    }

    // Draw regions
    regionsLayer.selectAll('path')
        .data(regions.features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('fill', d => {
            const code = d.properties.postal || d.properties.ISO_A3;
            return ${JSON.stringify(config.highlightColors)}[code] || '${config.defaultFill}';
        })
        .on('mouseover', (event, d) => {
            const name = d.properties.name || d.properties.NAME;
            const code = d.properties.postal || d.properties.ISO_A3;
            
            tooltip
                .style('visibility', 'visible')
                .html(\`<strong>\${name}</strong> (\${code})\`);
        })
        .on('mousemove', (event) => {
            tooltip
                .style('top', (event.pageY - 10) + 'px')
                .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', () => {
            tooltip.style('visibility', 'hidden');
        });
        
    // Draw bounds
    boundsLayer.selectAll('path')
        .data(bounds.features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', '#F9F5F1')
        .attr('stroke-width', '1');
        
    // Add labels (always show for highlighted regions)
    labelsLayer.selectAll('text')
        .data(regions.features)
        .enter()
        .append('text')
        .attr('transform', d => {
            const centroid = path.centroid(d);
            if (isNaN(centroid[0]) || isNaN(centroid[1])) {
                return null;
            }
            return \`translate(\${centroid})\`;
        })
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .style('font-size', '12px')
        .style('fill', '#333')
        .style('font-weight', 'bold')
        .style('pointer-events', 'none')
        .text(d => {
            const code = d.properties.postal || d.properties.ISO_A3;
            
            // Show label if region is highlighted
            if (${JSON.stringify(config.highlightColors)}[code]) {
                return d.properties.name || d.properties.NAME;
            }
            return '';
        });
});`;
}

/**
 * Export map as D3 bundle
 * @param {MapData} data - Map configuration
 * @returns {Promise<Blob>} ZIP file containing D3 bundle
 */
export async function exportBundle(data) {
    log('BUNDLE', 'Starting bundle export', { config: data });
    
    // Load GeoJSON data
    const geojsonData = await loadGeoJSON();
    
    const zip = new JSZip();
    
    // Create directory structure
    const srcDir = zip.folder('src');
    const cssDir = zip.folder('css');
    const dataDir = zip.folder('data');
    
    log('BUNDLE', 'Created ZIP structure');
    
    // Add template files
    zip.file('index.html', HTML_TEMPLATE);
    cssDir?.file('styles.css', CSS);
    srcDir?.file('visualization.js', generateVisualizationCode(data));
    
    log('BUNDLE', 'Added template files');
    
    // Only include needed datasets
    if (data.mapType === 'world') {
        log('BUNDLE', 'Adding world map data');
        dataDir?.file('countries.geojson', JSON.stringify(geojsonData.countries, null, 2));
        dataDir?.file('country_bounds.geojson', JSON.stringify(geojsonData.countryBounds, null, 2));
    }
    
    if (data.mapType === 'us' || data.states?.some(s => 
        /^[A-Z]{2}$/.test(s.postalCode) && data.highlightColors?.[s.postalCode]
    )) {
        log('BUNDLE', 'Adding US map data');
        dataDir?.file('US_states.geojson', JSON.stringify(geojsonData.states, null, 2));
        dataDir?.file('US_bounds.geojson', JSON.stringify(geojsonData.stateBounds, null, 2));
    }
    
    // Add documentation
    zip.file('README.md', `# D3.js Map Visualization Bundle
    
This bundle contains a self-contained D3.js map visualization.

## Files
- \`index.html\`: Main HTML file
- \`css/styles.css\`: Basic styling
- \`src/visualization.js\`: D3.js visualization code
- \`data/*.geojson\`: Map data files

## Usage
1. Unzip the bundle
2. Serve the files using a local web server
3. Open index.html in your browser`);
    
    log('BUNDLE', 'Added documentation');
    
    // Generate ZIP
    log('BUNDLE', 'Generating final ZIP');
    const blob = await zip.generateAsync({ type: 'blob' });
    log('BUNDLE', 'Bundle export complete', { 
        sizeBytes: blob.size,
        type: blob.type
    });
    
    return blob;
}
