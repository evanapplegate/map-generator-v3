import { log } from './logger.js';

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
 * Load bounds GeoJSON data
 * @param {string} type - Map type ('us' or 'world')
 * @param {Object} mapData - Map configuration data
 * @returns {Promise<Object>} Bounds GeoJSON data
 */
async function loadBoundsGeoJSON(type, mapData) {
    // Always load both datasets to handle mixed queries
    const [countryBounds, stateBounds] = await Promise.all([
        loadGeoJSON('geojson/country_bounds.geojson'),
        loadGeoJSON('geojson/US_bounds.geojson')
    ]);
    
    // For US maps, only return state bounds
    // For world maps or mixed queries, merge bounds
    if (type === 'us') {
        return stateBounds;
    } else {
        // Find any US states that are highlighted
        const hasHighlightedStates = mapData.states?.some(s => 
            /^[A-Z]{2}$/.test(s.postalCode) && mapData.highlightColors?.[s.postalCode]
        );
        
        if (hasHighlightedStates) {
            // Merge US bounds with country bounds, excluding USA
            const nonUSABounds = countryBounds.features.filter(f => 
                f.properties.ISO_A3 !== 'USA'
            );
            return {
                type: 'FeatureCollection',
                features: [...nonUSABounds, ...stateBounds.features]
            };
        }
        
        return countryBounds;
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
        const aspect = width / height;
        
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
        
        const features = mapData.mapType === 'us' ? states.features :
            hasHighlightedStates ? 
                [...countries.features.filter(f => f.properties.ISO_A3 !== 'USA'), ...states.features] :
                countries.features;
                
        regionsLayer.selectAll('path')
            .data(features)
            .join('path')
            .attr('d', path)
            .attr('fill', d => {
                const code = d.properties.postal || d.properties.ISO_A3;
                return mapData.highlightColors[code] || mapData.defaultFill;
            })
            .on('mouseover', (event, d) => {
                const name = d.properties.name || d.properties.NAME;
                const code = d.properties.postal || d.properties.ISO_A3;
                
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
        if (mapData.mapType === 'world' && hasHighlightedStates) {
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
                mapData.cities.some(c => city.properties.NAME === c.name) &&
                // For US maps, only show US cities
                (mapData.mapType === 'us' ? city.properties.COUNTRY === 'United States' : true)
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
        if (mapData.showLabels) {
            // For world maps, include both highlighted countries and states
            const hasHighlightedStates = mapData.states?.some(s => 
                /^[A-Z]{2}$/.test(s.postalCode) && mapData.highlightColors?.[s.postalCode]
            );
            
            const features = mapData.mapType === 'us' ? states.features :
                hasHighlightedStates ? 
                    [...countries.features.filter(f => f.properties.ISO_A3 !== 'USA'), ...states.features] :
                    countries.features;

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
                    return mapData.highlightColors[code] ? (d.properties.name || d.properties.NAME) : '';
                })
                .attr('text-anchor', 'middle')
                .attr('font-size', '8px')
                .attr('fill', '#000000')
                .style('font-weight', 'bold')
                .style('display', d => {
                    const code = d.properties.postal || d.properties.ISO_A3;
                    const centroid = path.centroid(d);
                    return mapData.highlightColors[code] && !isNaN(centroid[0]) && !isNaN(centroid[1]) ? 'block' : 'none';
                });
        }
        
        log('D3', 'Map render complete');
    } catch (error) {
        log('D3', 'Error rendering map', { error });
        throw error;
    }
}
