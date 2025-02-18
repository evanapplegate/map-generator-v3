/**
 * @typedef {Object} MapData
 */

import { log } from './logger.js';

const HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>D3.js Map Visualization</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        #map { width: 100%; height: 600px; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script src="visualization.js"></script>
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
    return `
const width = document.getElementById('map').clientWidth;
const height = document.getElementById('map').clientHeight;

const svg = d3.select('#map')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .attr('style', 'max-width: 100%; height: auto;');

const projection = d3.geoMercator()
    .scale(width / 6)
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

// Load required data
const dataPromises = [];
if (config.mapType === 'world') {
    dataPromises.push(
        d3.json('data/countries.geojson'),
        d3.json('data/country_bounds.geojson')
    );
}

// Only load states if it's a US map or if specific states are highlighted
const hasHighlightedStates = config.states?.some(s => 
    /^[A-Z]{2}$/.test(s.postalCode) && config.highlightColors?.[s.postalCode]
);
if (config.mapType === 'us' || hasHighlightedStates) {
    dataPromises.push(
        d3.json('data/US_states.geojson'),
        d3.json('data/US_bounds.geojson')
    );
}

Promise.all(dataPromises).then(geoData => {
    let dataIndex = 0;
    const countries = config.mapType === 'world' ? geoData[dataIndex++] : null;
    const countryBounds = config.mapType === 'world' ? geoData[dataIndex++] : null;
    const states = (config.mapType === 'us' || hasHighlightedStates) ? geoData[dataIndex++] : null;
    const stateBounds = (config.mapType === 'us' || hasHighlightedStates) ? geoData[dataIndex++] : null;

    // Draw base regions
    if (config.mapType === 'world') {
        svg.append('g')
            .attr('id', 'countries')
            .selectAll('path')
            .data(countries.features)
            .join('path')
            .attr('d', path)
            .attr('fill', d => {
                const code = d.properties?.ISO_A3 || d.properties?.iso_a3;
                return config.highlightColors?.[code] || config.defaultFill || '#edded1';
            });
    }

    // Draw states for US maps or when specific states are highlighted
    if (config.mapType === 'us' || hasHighlightedStates) {
        svg.append('g')
            .attr('id', 'US_states')
            .selectAll('path')
            .data(states.features)
            .join('path')
            .attr('d', path)
            .attr('fill', d => {
                const code = d.properties?.postal;
                // Only show states that are highlighted in world maps
                if (config.mapType !== 'us' && !config.highlightColors?.[code]) return 'none';
                return config.highlightColors?.[code] || config.defaultFill || '#edded1';
            });
    }

    // Draw boundaries
    if (config.mapType === 'world') {
        svg.append('g')
            .attr('id', 'country_bounds')
            .selectAll('path')
            .data(countryBounds.features)
            .join('path')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', '1px');
    }

    if (config.mapType === 'us' || hasHighlightedStates) {
        svg.append('g')
            .attr('id', 'US_bounds')
            .selectAll('path')
            .data(stateBounds.features)
            .join('path')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', config.mapType === 'us' ? '1px' : '0.5px');
    }

    // Add labels if enabled
    if (config.showLabels) {
        svg.append('g')
            .attr('id', 'labels')
            .selectAll('text')
            .data(config.mapType === 'us' ? states.features : [...countries.features, ...states.features])
            .join('text')
            .attr('transform', d => {
                const centroid = path.centroid(d);
                return centroid ? \`translate(\${centroid})\` : null;
            })
            .attr('text-anchor', 'middle')
            .attr('dy', '.35em')
            .style('font-size', '12px')
            .style('fill', '#333')
            .text(d => {
                const code = d.properties?.postal || d.properties?.ISO_A3;
                const matchingState = config.states.find(s => s.postalCode === code);
                return matchingState?.label || '';
            });
    }
});

// Map configuration
const config = ${JSON.stringify(config, null, 2)};`;
}

/**
 * Export map as D3 bundle
 * @param {MapData} data - Map configuration
 * @returns {Promise<Blob>} ZIP file containing D3 bundle
 */
export async function exportBundle(data) {
    log('BUNDLE', 'Starting bundle export', { config: data });
    
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
