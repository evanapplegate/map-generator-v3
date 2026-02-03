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
        'sao paolo': 'sao paulo',
        'macao': 'macau'  // Normalize Macao -> Macau spelling
    };
    
    // Common Country Aliases
    const countryAliases = {
        'usa': 'united states of america',
        'us': 'united states of america',
        'united states': 'united states of america',
        'uk': 'united kingdom',
        'uae': 'united arab emirates',
        'east timor': 'timor-leste',
        'macao': 'macau'  // Normalize Macao -> Macau spelling
    };

    const mappedR = cityAliases[r] || countryAliases[r] || r;
    const mappedA = cityAliases[a] || countryAliases[a] || a;

    if (mappedR === mappedA) return true;

    // For countries, allow partial matches (e.g., "United States" in "United States of America")
    if (isCountry) {
        // Special case: Hong Kong and Macau should NOT match "China" or each other via partial match
        const specialEntities = ['hong kong', 'macau', 'china', 'hong kong s.a.r.', 'hong kong s.a.r', 'macau s.a.r.', 'macau s.a.r'];
        if (specialEntities.includes(mappedR) || specialEntities.includes(mappedA)) {
            // Handle S.A.R. variations (with or without period)
            const normR = mappedR.replace(/ s\.a\.r\.?$/i, '');
            const normA = mappedA.replace(/ s\.a\.r\.?$/i, '');
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
            let requestedCities = citiesData.features.filter(city => 
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

            // Deduplicate capitals: Ensure only one capital per US state
            if ((mapData.mapType === 'us' || shouldShowUSStates) && states?.features) {
                const capitals = requestedCities.filter(c => c.isCapital);
                const nonCapitals = requestedCities.filter(c => !c.isCapital);
                const capitalsByState = {};
                const unmappedCapitals = [];

                // Map capitals to states
                capitals.forEach(city => {
                    const coords = city.geometry.coordinates;
                    const state = states.features.find(s => d3.geoContains(s, coords));
                    if (state) {
                        const stateName = state.properties.name;
                        if (!capitalsByState[stateName]) capitalsByState[stateName] = [];
                        capitalsByState[stateName].push(city);
                    } else {
                        unmappedCapitals.push(city);
                    }
                });

                const filteredCapitals = [...unmappedCapitals];

                // Resolve conflicts
                Object.entries(capitalsByState).forEach(([stateName, candidates]) => {
                    if (candidates.length === 1) {
                        filteredCapitals.push(candidates[0]);
                    } else {
                        // Count occurrences of each name in the full set to find "uniqueness"
                        const nameCounts = {};
                        requestedCities.forEach(c => {
                            const name = c.properties.NAME;
                            nameCounts[name] = (nameCounts[name] || 0) + 1;
                        });

                        // Sort by frequency (lowest first) -> most unique name wins
                        candidates.sort((a, b) => {
                            const countA = nameCounts[a.properties.NAME] || 0;
                            const countB = nameCounts[b.properties.NAME] || 0;
                            return countA - countB;
                        });

                        const winner = candidates[0];
                        filteredCapitals.push(winner);
                        
                        log('D3', 'Resolved capital conflict', {
                            state: stateName,
                            kept: winner.properties.NAME,
                            dropped: candidates.slice(1).map(c => c.properties.NAME)
                        });
                    }
                });

                requestedCities = [...nonCapitals, ...filteredCapitals];
            }

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

// City labels - initial render to measure bounding boxes
const cityLabelElements = cityLabelsLayer.selectAll('text')
.data(requestedCities)
.join('text')
.attr('x', d => projection(d.geometry.coordinates)[0] + 3)
.attr('y', d => projection(d.geometry.coordinates)[1])
.text(d => d.properties.NAME)
.attr('font-family', 'Optima, sans-serif')
.attr('font-size', '6pt')
.attr('fill', '#000000')
.style('font-weight', 'normal');

// Prepare data for label collision avoidance
const cityLabelData = [];
const cityAnchorData = [];

cityLabelElements.each(function(d, i) {
    const bbox = this.getBBox();
    const coords = projection(d.geometry.coordinates);
    if (coords) {
        // Tight gap from marker
        const gap = 0;
        const markerR = d.isCapital ? 2 : 1; 
        const offset = (gap + markerR) * 0.8; // Tight horizontal spacing
        
        // Use fixed vertical offsets for 6pt font to ensure tightness without overlap
        // 6pt font is approx 8px high (6px ascent + 2px descent)
        // Marker is approx 4px high (extends 2px up/down)
        
        // Baseline 4px above center -> Bottom of text (descent) is at ~2px above center (touching top of marker)
        const aboveY = coords[1] - 4; 
        
        // Baseline 8px below center -> Top of text (ascent) is at ~2px below center (touching bottom of marker)
        const belowY = coords[1] + 8;
        
        // 8 candidate positions with consistent distance from marker
        const candidatePositions = [
            // Horizontal: label baseline aligned with marker
            { x: coords[0] + offset + 1, y: coords[1] + 3 },                        // right (baseline shifted down slightly to center vertically)
            { x: coords[0] - bbox.width - offset - 1, y: coords[1] + 3 },           // left
            // Above marker
            { x: coords[0] + offset, y: aboveY },                                   // top-right
            { x: coords[0] - bbox.width - offset, y: aboveY },                      // top-left
            { x: coords[0] - bbox.width / 2, y: aboveY },                           // centered above
            // Below marker  
            { x: coords[0] + offset, y: belowY },                                   // bottom-right
            { x: coords[0] - bbox.width - offset, y: belowY },                      // bottom-left
            { x: coords[0] - bbox.width / 2, y: belowY }                            // centered below
        ];
        
        cityLabelData.push({
            x: candidatePositions[0].x,
            y: candidatePositions[0].y,
            width: bbox.width,
            height: bbox.height,
            name: d.properties.NAME,
            candidates: candidatePositions
        });
        cityAnchorData.push({
            x: coords[0],
            y: coords[1],
            r: d.isCapital ? 4 : 2,
            // Store marker bbox to prevent self-overlap
            bbox: {
                x: coords[0] - (d.isCapital ? 4 : 2),
                y: coords[1] - (d.isCapital ? 4 : 2),
                width: (d.isCapital ? 8 : 4),
                height: (d.isCapital ? 8 : 4)
            }
        });
    }
});

// Will collect state/country label bounding boxes after they are rendered
// Store for later use in collision detection
container._pendingCityLabels = {
    labelData: cityLabelData,
    anchorData: cityAnchorData,
    elements: cityLabelElements,
    width: width,
    height: height
};
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

        // Run label collision avoidance after all labels are rendered
        if (container._pendingCityLabels && container._pendingCityLabels.labelData.length > 0) {
            const { labelData, anchorData, elements, width, height } = container._pendingCityLabels;
            
            // Collect fixed anchors (state/country labels that are visible)
            const fixedAnchors = [];
            countryLabelsLayer.selectAll('text').each(function() {
                const el = d3.select(this);
                if (el.style('display') !== 'none' && el.text()) {
                    const bbox = this.getBBox();
                    fixedAnchors.push({
                        x: bbox.x,
                        y: bbox.y,
                        width: bbox.width,
                        height: bbox.height
                    });
                }
            });
            
            // Only run labeler if we have city labels
            if (labelData.length > 0) {
                try {
                    // Smart placement: for each label, try all candidate positions
                    // and pick the one with lowest overlap with fixed anchors
                    labelData.forEach((lab, idx) => {
                        if (lab.candidates && lab.candidates.length > 0) {
                            let bestPos = lab.candidates[0];
                            let bestScore = Infinity;
                            
                            lab.candidates.forEach((pos, posIdx) => {
                                let score = 0;
                                const labRect = {
                                    x1: pos.x,
                                    y1: pos.y - lab.height,
                                    x2: pos.x + lab.width,
                                    y2: pos.y
                                };
                                
                                // Heavily penalize overlap with fixed anchors (state labels)
                                fixedAnchors.forEach(fa => {
                                    const faRect = {
                                        x1: fa.x,
                                        y1: fa.y,
                                        x2: fa.x + fa.width,
                                        y2: fa.y + fa.height
                                    };
                                    const xOverlap = Math.max(0, Math.min(labRect.x2, faRect.x2) - Math.max(labRect.x1, faRect.x1));
                                    const yOverlap = Math.max(0, Math.min(labRect.y2, faRect.y2) - Math.max(labRect.y1, faRect.y1));
                                    score += xOverlap * yOverlap * 100; // High penalty
                                });
                                
                                // Light penalty for overlap with other city labels
                                labelData.forEach((other, otherIdx) => {
                                    if (otherIdx !== idx && otherIdx < idx) { // Only check already-placed labels
                                        const otherRect = {
                                            x1: other.x,
                                            y1: other.y - other.height,
                                            x2: other.x + other.width,
                                            y2: other.y
                                        };
                                        const xOverlap = Math.max(0, Math.min(labRect.x2, otherRect.x2) - Math.max(labRect.x1, otherRect.x1));
                                        const yOverlap = Math.max(0, Math.min(labRect.y2, otherRect.y2) - Math.max(labRect.y1, otherRect.y1));
                                        score += xOverlap * yOverlap * 5; // Low penalty
                                    }
                                });
                                
                                // Penalize "centered above" (idx 4) and "centered below" (idx 7) positions
                                // These place labels directly above/below which looks worse
                                if (posIdx === 4 || posIdx === 7) {
                                    score += 50; // Discourage these positions
                                }
                                
                                // Small penalty for distance from marker
                                const dx = pos.x + lab.width / 2 - anchorData[idx].x;
                                const dy = pos.y - lab.height / 2 - anchorData[idx].y;
                                score += Math.sqrt(dx * dx + dy * dy) * 0.5; // Increased penalty for distance
                                
                                if (score < bestScore) {
                                    bestScore = score;
                                    bestPos = pos;
                                    bestPosIdx = posIdx;
                                }
                            });
                            
                            lab.x = bestPos.x;
                            lab.y = bestPos.y;
                            lab.posIdx = bestPosIdx;
                        }
                    });
                    
                    // Update city label positions
                    elements.each(function(d, i) {
                        if (labelData[i]) {
                            d3.select(this)
                                .attr('x', labelData[i].x)
                                .attr('y', labelData[i].y)
                                .attr('data-pos-idx', labelData[i].posIdx);
                        }
                    });
                    
                    log('D3', 'Label collision avoidance complete', { 
                        cityLabels: labelData.length,
                        fixedAnchors: fixedAnchors.length
                    });
                } catch (err) {
                    log('D3', 'Label collision avoidance error', { error: err.message });
                }
            }
            
            // Clean up
            delete container._pendingCityLabels;
        }

log('D3', 'Map render complete');
} catch (error) {
log('D3', 'Error rendering map', { error });
throw error;
}
}
