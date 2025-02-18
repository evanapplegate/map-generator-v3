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
const labelsLayer = svg.append('g').attr('id', 'labels-layer');

// Create tooltip
const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip');

// Load GeoJSON data
Promise.all([
    d3.json('data/countries.geojson'),
    d3.json('data/US_states.geojson'),
    d3.json('data/country_bounds.geojson'),
    d3.json('data/US_bounds.geojson')
]).then(([countries, states, countryBounds, stateBounds]) => {
    if (!countries || !states || !countryBounds || !stateBounds) {
        throw new Error('Failed to load one or more GeoJSON files');
    }

    // Create projection based on map type
    const projection = mapType === 'us'
        ? d3.geoAlbersUsa()
            .scale(width * 0.45)
            .translate([width / 2, height / 2])
        : d3.geoEqualEarth()
            .scale(Math.min(width / 4.6, height / 2.9))
            .translate([width / 2, height / 2]);
        
    // Create path generator
    const path = d3.geoPath().projection(projection);
    
    // For US maps, only use state features
    // For world maps, check if we need to include US states
    const hasHighlightedStates = stateList?.some(s => 
        /^[A-Z]{2}$/.test(s.postalCode) && highlightColors[s.postalCode]
    );
    
    const features = mapType === 'us' 
        ? states.features 
        : hasHighlightedStates
            ? [...countries.features.filter(f => f.properties.ISO_A3 !== 'USA'), ...states.features]
            : countries.features;
    
    // Draw regions
    regionsLayer.selectAll('path')
        .data(features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('fill', d => {
            const code = d.properties.postal || d.properties.ISO_A3;
            return highlightColors[code] || defaultFill;
        })
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
        
    // Draw bounds
    const boundFeatures = mapType === 'us'
        ? stateBounds.features
        : hasHighlightedStates
            ? [...countryBounds.features.filter(f => f.properties.ISO_A3 !== 'USA'), ...stateBounds.features]
            : countryBounds.features;
        
    boundsLayer.selectAll('path')
        .data(boundFeatures)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', '#F9F5F1')
        .attr('stroke-width', '1');
        
    // Add labels
    labelsLayer.selectAll('text')
        .data(features)
        .enter()
        .append('text')
        .attr('transform', d => {
            const centroid = path.centroid(d);
            if (isNaN(centroid[0]) || isNaN(centroid[1])) {
                console.error('Invalid centroid for feature:', d);
                return null;
            }
            return \`translate(\${centroid})\`;
        })
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .style('font-size', '10px')
        .style('fill', '#333')
        .style('font-weight', 'bold')
        .style('pointer-events', 'none')
        .text(d => {
            const code = d.properties.postal || d.properties.ISO_A3;
            // Only show label if region is highlighted
            return highlightColors[code] ? (d.properties.name || d.properties.NAME) : '';
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
            states: currentMapData.states
        };
        
        src.file('visualization.js', generateVisualizationCode(mapData));
        
        // Create data directory
        const data = zip.folder('data');
        
        // Add GeoJSON files
        const [countries, states, countryBounds, stateBounds] = await Promise.all([
            fetch('/geojson/countries.geojson').then(r => r.json()),
            fetch('/geojson/US_states.geojson').then(r => r.json()),
            fetch('/geojson/country_bounds.geojson').then(r => r.json()),
            fetch('/geojson/US_bounds.geojson').then(r => r.json())
        ]);
        
        data.file('countries.geojson', JSON.stringify(countries));
        data.file('US_states.geojson', JSON.stringify(states));
        data.file('country_bounds.geojson', JSON.stringify(countryBounds));
        data.file('US_bounds.geojson', JSON.stringify(stateBounds));
        
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
