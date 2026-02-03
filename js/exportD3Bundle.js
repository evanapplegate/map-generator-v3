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
        }
        #map { 
            width: 100%; 
            height: 800px;
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
(async function() {
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

    // Load GeoJSON data
    const countries = await fetch('src/geojson/countries.geojson').then(r => r.json());
    const states = await fetch('src/geojson/US_states.geojson').then(r => r.json());
    const countryBounds = await fetch('src/geojson/country_bounds.geojson').then(r => r.json());
    const stateBounds = await fetch('src/geojson/US_bounds.geojson').then(r => r.json());
    const citiesData = await fetch('src/geojson/cities.geojson').then(r => r.json());
    let disputedBounds = null;
    if (mapType === 'world') {
        disputedBounds = await fetch('src/geojson/country_disputed_bounds.geojson').then(r => r.json());
    }

    // Create SVG with Adobe-specific namespace declarations
    const svg = d3.select('#map')
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .attr('viewBox', \`0 0 \${width} \${height}\`)
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('xmlns:i', 'http://ns.adobe.com/AdobeIllustrator/10.0/')
        .attr('xmlns:x', 'adobe:ns:meta/')
        .attr('version', '1.1');

    // Create layers with Adobe-specific metadata
    const regionsLayer = svg.append('g')
        .attr('id', 'regions-layer')
        .attr('i:layer', 'yes')
        .attr('i:dimmedPercent', '0')
        .attr('i:rgbTrio', '#4F008000FFFF')
        .attr('i:layerType', 'layer');

    const boundsLayer = svg.append('g')
        .attr('id', 'bounds-layer')
        .attr('i:layer', 'yes')
        .attr('i:dimmedPercent', '0')
        .attr('i:rgbTrio', '#4F008000FFFF')
        .attr('i:layerType', 'layer');

    const stateBoundsLayer = svg.append('g')
        .attr('id', 'state-bounds-layer')
        .attr('i:layer', 'yes')
        .attr('i:dimmedPercent', '0')
        .attr('i:rgbTrio', '#4F008000FFFF')
        .attr('i:layerType', 'layer');

    const disputedBoundsLayer = svg.append('g')
        .attr('id', 'disputed_bounds')
        .attr('i:layer', 'yes')
        .attr('i:dimmedPercent', '0')
        .attr('i:rgbTrio', '#4F008000FFFF')
        .attr('i:layerType', 'layer');

    const cityDotsLayer = svg.append('g')
        .attr('id', 'city-dots')
        .attr('i:layer', 'yes')
        .attr('i:dimmedPercent', '0')
        .attr('i:rgbTrio', '#4F008000FFFF')
        .attr('i:layerType', 'layer');

    const cityLabelsLayer = svg.append('g')
        .attr('id', 'city-labels')
        .attr('i:layer', 'yes')
        .attr('i:dimmedPercent', '0')
        .attr('i:rgbTrio', '#4F008000FFFF')
        .attr('i:layerType', 'layer');

    const countryLabelsLayer = svg.append('g')
        .attr('id', 'country-labels')
        .attr('i:layer', 'yes')
        .attr('i:dimmedPercent', '0')
        .attr('i:rgbTrio', '#4F008000FFFF')
        .attr('i:layerType', 'layer');

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
        .attr('stroke-width', '0.5');
            
    // Draw state bounds in world view
    if (mapType === 'world' && hasHighlightedStates) {
        stateBoundsLayer.selectAll('path')
            .data(stateBounds.features)
            .join('path')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', '#F9F5F1')
            .attr('stroke-width', '0.5');
    }

    // Draw disputed bounds for world maps
    if (mapType === 'world' && disputedBounds?.features) {
        disputedBoundsLayer.selectAll('path')
            .data(disputedBounds.features)
            .join('path')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', '#F9F5F1')
            .attr('stroke-width', '0.5')
            .attr('stroke-dasharray', '1,1');
    }

    // Add cities and labels
    if (cities) {
        const requestedCities = citiesData.features.filter(city => 
            cities.some(c => {
                // For US maps, only show US cities
                if (mapType === 'us' && city.properties.ADM0NAME !== 'United States of America') {
                    return false;
                }
                return city.properties.NAME === c.name;
            })
        );
            
        // City markers (dots or stars)
        // Regular dots
        cityDotsLayer.selectAll('circle')
            .data(requestedCities.filter(d => !d.isCapital))
            .join('circle')
            .attr('cx', d => projection(d.geometry.coordinates)[0])
            .attr('cy', d => projection(d.geometry.coordinates)[1])
            .attr('r', 1)
            .attr('fill', '#000')
            .attr('stroke', 'none');

        // Capital stars
        const starSize = 4;
        const starPath = "M12.307,18.891c-.169.006-.338.055-.488.147l-6.84,4.209c-.019.011-.024.015-.047,0-.022-.011-.031-.038-.021-.06l1.86-7.85c.086-.363-.037-.745-.32-.989L.363,9.099c-.015-.012-.029-.024-.016-.062s.023-.034.041-.036l7.99-.645c.374-.032.698-.27.84-.618L12.296.286c.01-.021.014-.031.044-.031h.004c.03,0,.034.01.044.031l3.078,7.451c.142.347.466.585.84.618l7.99.645c.019.003.029-.002.041.036s-.001.05-.016.062l-6.088,5.25c-.283.244-.406.625-.32.989l1.86,7.85c.01.022,0,.049-.021.06-.024.015-.029.011-.047,0l-6.84-4.209c-.15-.092-.319-.142-.489-.148h-.067Z";
        const starOriginalWidth = 24.69;
        const starScale = starSize / starOriginalWidth;

        cityDotsLayer.selectAll('path.capital-star')
            .data(requestedCities.filter(d => d.isCapital))
            .join('path')
            .attr('class', 'capital-star')
            .attr('d', starPath)
            .attr('fill', '#000')
            .attr('stroke', 'none')
            .attr('transform', d => {
                const coords = projection(d.geometry.coordinates);
                if (!coords) return 'translate(0,0)';
                return \`translate(\${coords[0] - starSize / 2}, \${coords[1] - starSize / 2}) scale(\${starScale})\`;
            });
               
        // City labels
        cityLabelsLayer.selectAll('text')
            .data(requestedCities)
            .join('text')
            .attr('x', d => projection(d.geometry.coordinates)[0] + 3)
            .attr('y', d => projection(d.geometry.coordinates)[1])
            .text(d => d.properties.NAME)
                .attr('font-size', '6pt')
            .attr('fill', '#000000')
            .style('font-weight', 'normal');
    }
        
    // Add country/state labels
    if (showLabels) {
        countryLabelsLayer.selectAll('text')
            .data(features)
            .join('text')
            .attr('x', d => {
                const centroid = path.centroid(d);
                return !isNaN(centroid[0]) ? centroid[0] : 0;
            })
            .attr('y', d => {
                const centroid = path.centroid(d);
                return !isNaN(centroid[1]) ? centroid[1] : 0;
            })
            .text(d => {
                const code = d.properties.postal || d.properties.ISO_A3;
                return highlightColors[code] ? (d.properties.name || d.properties.NAME) : '';
            })
            .attr('text-anchor', 'middle')
                .attr('font-size', '6pt')
            .attr('fill', '#000000')
            .style('font-weight', 'bold')
            .style('display', d => {
                const code = d.properties.postal || d.properties.ISO_A3;
                const centroid = path.centroid(d);
                return highlightColors[code] && !isNaN(centroid[0]) && !isNaN(centroid[1]) ? 'block' : 'none';
            });
    }
            
    // Add tooltip
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip');

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
})().catch(error => {
    console.error('Error:', error);
    document.getElementById('map').innerHTML = \`Error: \${error.message}\`;
});`;
}

/**
 * Export D3 visualization as standalone bundle
 * @param {HTMLElement} container - Map container element
 * @param {Object} mapData - Map configuration data
 * @returns {Promise<Blob>} Bundle as zip file
 */
export async function exportBundle(container, mapData) {
    try {
        const zip = new JSZip();
        
        // Add HTML template
        zip.file('index.html', HTML_TEMPLATE);
        
        // Create src directory
        const src = zip.folder('src');
        
        // Add visualization code
        const svg = container.querySelector('svg');
        if (!svg) throw new Error('No map found to export');
        
        const visualData = {
            width: container.clientWidth,
            height: container.clientHeight,
            svg: svg.outerHTML,
            highlightColors: mapData.highlightColors,
            defaultFill: mapData.defaultFill,
            mapType: mapData.mapType,
            labels: mapData.labels,
            states: mapData.states,
            cities: mapData.cities,
            showLabels: mapData.showLabels,
            borderColor: mapData.borderColor
        };
        
        src.file('visualization.js', generateVisualizationCode(visualData));
        
        // Create src/geojson directory for GeoJSON files
        const geojsonDir = zip.folder('src/geojson');
        
        // Load and add GeoJSON files
        const countriesGeojson = await fetch('/geojson/countries.geojson').then(r => r.json());
        const statesGeojson = await fetch('/geojson/US_states.geojson').then(r => r.json());
        const countryBoundsGeojson = await fetch('/geojson/country_bounds.geojson').then(r => r.json());
        const stateBoundsGeojson = await fetch('/geojson/US_bounds.geojson').then(r => r.json());
        const citiesGeojson = await fetch('/geojson/cities.geojson').then(r => r.json());
        let disputedBoundsGeojson = null;
        if (mapData.mapType === 'world') {
            disputedBoundsGeojson = await fetch('/geojson/country_disputed_bounds.geojson').then(r => r.json());
        }
        
        // Add GeoJSON files
        geojsonDir.file('countries.geojson', JSON.stringify(countriesGeojson));
        geojsonDir.file('US_states.geojson', JSON.stringify(statesGeojson));
        geojsonDir.file('country_bounds.geojson', JSON.stringify(countryBoundsGeojson));
        geojsonDir.file('US_bounds.geojson', JSON.stringify(stateBoundsGeojson));
        geojsonDir.file('cities.geojson', JSON.stringify(citiesGeojson));
        if (disputedBoundsGeojson) {
            geojsonDir.file('country_disputed_bounds.geojson', JSON.stringify(disputedBoundsGeojson));
        }
        
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
