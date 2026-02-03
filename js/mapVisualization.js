import { log } from './logger.js';

/**
 * Normalize string for comparison (lowercase, strip accents)
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
function normalizeString(str) {
if (!str) return '';
return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * Smart match for cities and countries
 */
function smartMatch(requested, actual, isCountry = false) {
    const r = normalizeString(requested);
    const a = normalizeString(actual);
    if (r === a) return true;
    
    // Common City Aliases
    const cityAliases = {
        'nyc': 'new york city',
        'new york': 'new york city',
        'la': 'los angeles',
        'sf': 'san francisco',
        'dc': 'washington',
        'washington dc': 'washington',
        'sao paolo': 'sao paulo'
    };
    
    // Common Country Aliases
    const countryAliases = {
        'usa': 'united states of america',
        'us': 'united states of america',
        'united states': 'united states of america',
        'uk': 'united kingdom',
        'uae': 'united arab emirates',
        'east timor': 'timor-leste'
    };

    const mappedR = cityAliases[r] || countryAliases[r] || r;
    const mappedA = cityAliases[a] || countryAliases[a] || a;

    if (mappedR === mappedA) return true;

    // For countries, allow partial matches (e.g., "United States" in "United States of America")
    if (isCountry) {
        // Special case: Hong Kong and Macao should NOT match "China" or each other via partial match
        const specialEntities = ['hong kong', 'macao', 'china', 'hong kong s.a.r.', 'macao s.a.r.'];
        if (specialEntities.includes(mappedR) || specialEntities.includes(mappedA)) {
            // Handle S.A.R. variations
            const normR = mappedR.replace(' s.a.r.', '');
            const normA = mappedA.replace(' s.a.r.', '');
            return normR === normA;
        }
        return mappedA.includes(mappedR) || mappedR.includes(mappedA);
    }

    // For cities, be stricter to avoid "NYC" matching "York"
    return false;
}

/**
 * Load GeoJSON data
 * @param {string} path - Path to GeoJSON file
 * @returns {Promise<Object>} GeoJSON data
 */
async function loadGeoJSON(path) {
log('D3', 'Loading GeoJSON', { type: path });

try {
const response = await fetch(path);
if (!response.ok) {
throw new Error(`HTTP error! status: ${response.status}`);
}
return await response.json();
} catch (error) {
log('D3', 'Error loading GeoJSON', { error, path });
throw error;
}
}

/**
 * Render map using D3
 * @param {HTMLElement} container - Container element
 * @param {Object} mapData - Map configuration
 */
export async function renderMap(container, mapData) {
log('D3', 'Starting map render', mapData);

try {
// Clear container
container.innerHTML = '';

// Load GeoJSON data
const [countries, states, countryBounds, stateBounds, citiesData, disputedBounds] = await Promise.all([
loadGeoJSON('geojson/countries.geojson'),
loadGeoJSON('geojson/US_states.geojson'),
loadGeoJSON('geojson/country_bounds.geojson'),
loadGeoJSON('geojson/US_bounds.geojson'),
loadGeoJSON('geojson/cities.geojson'),
mapData.mapType === 'world' ? loadGeoJSON('geojson/country_disputed_bounds.geojson') : null
]).catch(error => {
log('D3', 'Error loading GeoJSON', { error });
throw error;
});

if (!countries?.features || !states?.features || !countryBounds?.features || !stateBounds?.features || !citiesData?.features) {
throw new Error('Failed to load one or more GeoJSON files');
}

// Set dimensions
const width = container.clientWidth;
const height = container.clientHeight;

// Create SVG with Adobe-specific namespace declarations
const svg = d3.select(container)
.append('svg')
.attr('width', '100%')
.attr('height', '100%')
.attr('preserveAspectRatio', 'xMidYMid meet')
.attr('viewBox', `0 0 ${width} ${height}`)
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
.attr('i:layerType', 'layer')
.attr('inkscape:groupmode', 'layer')
.attr('inkscape:label', 'Regions');

const boundsLayer = svg.append('g')
.attr('id', 'bounds-layer')
.attr('i:layer', 'yes')
.attr('i:dimmedPercent', '0')
.attr('i:rgbTrio', '#4F008000FFFF')
.attr('i:layerType', 'layer')
.attr('inkscape:groupmode', 'layer')
.attr('inkscape:label', 'Boundaries');

const stateBoundsLayer = svg.append('g')
.attr('id', 'state-bounds-layer')
.attr('i:layer', 'yes')
.attr('i:dimmedPercent', '0')
.attr('i:rgbTrio', '#4F008000FFFF')
.attr('i:layerType', 'layer')
.attr('inkscape:groupmode', 'layer')
.attr('inkscape:label', 'State Boundaries');

const disputedBoundsLayer = svg.append('g')
.attr('id', 'disputed_bounds')
.attr('i:layer', 'yes')
.attr('i:dimmedPercent', '0')
.attr('i:rgbTrio', '#4F008000FFFF')
.attr('i:layerType', 'layer')
.attr('inkscape:groupmode', 'layer')
.attr('inkscape:label', 'Disputed Boundaries');

const cityDotsLayer = svg.append('g')
.attr('id', 'city-dots')
.attr('i:layer', 'yes')
.attr('i:dimmedPercent', '0')
.attr('i:rgbTrio', '#4F008000FFFF')
.attr('i:layerType', 'layer')
.attr('inkscape:groupmode', 'layer')
.attr('inkscape:label', 'City Dots');

const cityLabelsLayer = svg.append('g')
.attr('id', 'city-labels')
.attr('i:layer', 'yes')
.attr('i:dimmedPercent', '0')
.attr('i:rgbTrio', '#4F008000FFFF')
.attr('i:layerType', 'layer')
.attr('inkscape:groupmode', 'layer')
.attr('inkscape:label', 'City Labels');

const countryLabelsLayer = svg.append('g')
.attr('id', 'country-labels')
.attr('i:layer', 'yes')
.attr('i:dimmedPercent', '0')
.attr('i:rgbTrio', '#4F008000FFFF')
.attr('i:layerType', 'layer')
.attr('inkscape:groupmode', 'layer')
.attr('inkscape:label', 'Country/State Labels');

// Create projection
const projection = mapData.mapType === 'us' 
? d3.geoAlbersUsa()
.scale(width * 1.1)
.translate([width / 2, height / 2])
: d3.geoEqualEarth()
.scale(Math.min(width / 4.6, height / 2.9))
.translate([width / 2, height / 2])
.rotate([-11, 0]);  // Rotate globe 11° east to wrap Russia around

// Create path generator
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

        // Draw regions
        const hasHighlightedStates = mapData.states?.some(s => 
            /^[A-Z]{2}$/.test(s.postalCode) && mapData.highlightColors?.[s.postalCode]
        );
        
        // Force US states if USA is highlighted or cities are shown
        const shouldShowUSStates = hasHighlightedStates || 
                                 (mapData.highlightColors && mapData.highlightColors['USA']) || 
                                 (mapData.cities && mapData.cities.length > 0);
        
        // Use countries for world maps (to keep USA as one fill), states for US-only maps
        const features = mapData.mapType === 'us' ? states.features : countries.features;
        
        // Add highlighted states on top of country layer for world maps
        const stateFeatures = (mapData.mapType === 'world' && hasHighlightedStates) 
            ? states.features.filter(s => mapData.highlightColors && mapData.highlightColors[s.properties.postal])
            : [];
                
        regionsLayer.selectAll('path.country')
            .data(features)
            .join('path')
            .attr('class', 'country')
            .attr('d', path)
            .attr('fill', d => {
                const code = d.properties.postal || d.properties.ISO_A3;
                return (mapData.highlightColors && mapData.highlightColors[code]) || mapData.defaultFill;
            })
.on('mouseover', (event, d) => {
const name = d.properties.name || d.properties.NAME;
tooltip
.style('visibility', 'visible')
.html(`<strong>${name}</strong>`);
})
.on('mousemove', (event) => {
tooltip
.style('top', (event.pageY - 10) + 'px')
.style('left', (event.pageX + 10) + 'px');
})
.on('mouseout', () => {
tooltip.style('visibility', 'hidden');
});

        // Draw individual states on top if they are highlighted in world view
        regionsLayer.selectAll('path.state-highlight')
            .data(stateFeatures)
            .join('path')
            .attr('class', 'state-highlight')
            .attr('d', path)
            .attr('fill', d => mapData.highlightColors ? mapData.highlightColors[d.properties.postal] : 'none')
            .on('mouseover', (event, d) => {
const name = d.properties.name || d.properties.NAME;
tooltip
.style('visibility', 'visible')
.html(`<strong>${name}</strong>`);
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
            .data(mapData.mapType === 'us' ? stateBounds.features : countryBounds.features)
            .join('path')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', '#F9F5F1')
            .attr('stroke-width', '1');
            
        // Draw state bounds in world view
        if (mapData.mapType === 'world' && shouldShowUSStates) {
            stateBoundsLayer.selectAll('path')
                .data(stateBounds.features)
                .join('path')
                .attr('d', path)
                .attr('fill', 'none')
                .attr('stroke', '#F9F5F1')
                .attr('stroke-width', '1');
        }
            
        // Draw disputed bounds for world maps
        if (mapData.mapType === 'world' && disputedBounds?.features) {
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
        if (mapData.cities) {
            const requestedCities = citiesData.features.filter(city => 
                mapData.cities.some(c => {
                    // Use smartMatch for both name and country
                    const nameMatches = smartMatch(c.name, city.properties.NAME, false);
                    const countryMatches = smartMatch(c.country, city.properties.ADM0NAME, true);
                    
                    // For US maps, only show US cities
                    if (mapData.mapType === 'us' && !smartMatch('united states of america', city.properties.ADM0NAME, true)) {
                        return false;
                    }
                    
                    return nameMatches && countryMatches;
                })
            ).map(city => {
                // Attach isCapital property from mapData
                const cityConfig = mapData.cities.find(c => {
                    return smartMatch(c.name, city.properties.NAME, false) && 
                           smartMatch(c.country, city.properties.ADM0NAME, true);
                });
                return {
                    ...city,
                    isCapital: cityConfig ? cityConfig.isCapital : false
                };
            });

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
const starSize = 4; // Exactly 4px as requested
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
return `translate(${coords[0] - starSize / 2}, ${coords[1] - starSize / 2}) scale(${starScale})`;
});

// City labels
cityLabelsLayer.selectAll('text')
.data(requestedCities)
.join('text')
.attr('x', d => projection(d.geometry.coordinates)[0] + 3)
.attr('y', d => projection(d.geometry.coordinates)[1])
.text(d => d.properties.NAME)
.attr('font-family', 'Optima, sans-serif')
.attr('font-size', '6pt')
.attr('fill', '#000000')
.style('font-weight', 'normal');
}

        // Add country/state labels
        // For world maps, include both highlighted countries and states
        const hasHighlightedStatesForLabels = mapData.states?.some(s => 
            /^[A-Z]{2}$/.test(s.postalCode) && mapData.highlightColors?.[s.postalCode]
        );
        
        const featuresForLabels = mapData.mapType === 'us' ? states.features :
            hasHighlightedStatesForLabels ? 
                [...countries.features.filter(f => f.properties.ISO_A3 !== 'USA'), ...states.features] :
                countries.features;

        countryLabelsLayer.selectAll('text')
            .data(featuresForLabels)
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
                // Prioritize the custom label from the LLM (e.g. "CA")
                const label = mapData.states?.find(s => s.postalCode === code)?.label;
                
                // If the state is highlighted, show the label
                if (mapData.highlightColors && mapData.highlightColors[code]) {
                    return label || d.properties.name || d.properties.NAME;
                }
                
                // If it's not highlighted, but we have a custom label (like the 50-state abbreviations request), show it
                return label || '';
            })
            .attr('text-anchor', 'middle')
            .attr('font-family', 'Optima, sans-serif')
            .attr('font-size', '6pt')
            .attr('fill', '#000000')
            .style('font-weight', 'bold')
            .style('display', d => {
                const code = d.properties.postal || d.properties.ISO_A3;
                const centroid = path.centroid(d);
                
                // Show label if showLabels is true AND (it's highlighted OR it has a custom label)
                const isHighlighted = mapData.highlightColors && mapData.highlightColors[code];
                const hasCustomLabel = mapData.states?.some(s => s.postalCode === code && s.label);
                
                return mapData.showLabels && (isHighlighted || hasCustomLabel) && !isNaN(centroid[0]) && !isNaN(centroid[1]) ? 'block' : 'none';
            });

log('D3', 'Map render complete');
} catch (error) {
log('D3', 'Error rendering map', { error });
throw error;
}
}
