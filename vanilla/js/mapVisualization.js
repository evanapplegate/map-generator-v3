import { log } from './logger.js';

/**
 * Load GeoJSON data for map
 * @param {string} type - Map type ('us' or 'world')
 * @returns {Promise<Object>} GeoJSON data
 */
async function loadGeoJSON(type) {
    log('D3', 'Loading GeoJSON', { type });
    
    const filename = type === 'us' ? 'US_states.geojson' : 'countries.geojson';
    const response = await fetch(`/geojson/${filename}`);
    
    if (!response.ok) {
        throw new Error(`Failed to load ${filename}`);
    }
    
    const data = await response.json();
    log('D3', 'GeoJSON loaded', { 
        features: data.features.length,
        type: data.type
    });
    
    return data;
}

/**
 * Load bounds GeoJSON data
 * @param {string} type - Map type ('us' or 'world')
 * @returns {Promise<Object>} Bounds GeoJSON data
 */
async function loadBoundsGeoJSON(type) {
    const filename = type === 'us' ? 'US_bounds.geojson' : 'country_bounds.geojson';
    const response = await fetch(`/geojson/${filename}`);
    
    if (!response.ok) {
        throw new Error(`Failed to load ${filename}`);
    }
    
    return response.json();
}

/**
 * Render map using D3
 * @param {Object} mapData - Map configuration
 * @param {HTMLElement} container - Container element
 */
export async function renderMap(mapData, container) {
    log('D3', 'Starting map render', mapData);
    
    try {
        // Clear container
        container.innerHTML = '';
        
        // Load GeoJSON
        const [geoData, boundsData] = await Promise.all([
            loadGeoJSON(mapData.mapType),
            loadBoundsGeoJSON(mapData.mapType)
        ]);
        
        // Set dimensions
        const width = container.clientWidth;
        const height = container.clientHeight;
        const aspect = width / height;
        
        // Create SVG with layers
        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .style('background-color', '#F9F5F1');
            
        // Create layers
        const regionsLayer = svg.append('g').attr('id', 'regions-layer');
        const boundsLayer = svg.append('g').attr('id', 'bounds-layer');
        const labelsLayer = svg.append('g').attr('id', 'labels-layer');
        
        // Create projection
        const projection = mapData.mapType === 'us' 
            ? d3.geoAlbersUsa()
                .scale(width * 1.3)
                .translate([width / 2, height / 2])
            : d3.geoEqualEarth()
                .scale(Math.min(width / 6.5, height / 4))
                .translate([width / 2, height / 2]);
        
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
        regionsLayer.selectAll('path')
            .data(geoData.features)
            .enter()
            .append('path')
            .attr('d', path)
            .attr('fill', d => {
                const code = mapData.mapType === 'us' 
                    ? d.properties.postal
                    : d.properties.ISO_A3;
                return mapData.highlightColors[code] || mapData.defaultFill;
            })
            .on('mouseover', (event, d) => {
                const name = d.properties.NAME || d.properties.name || 'Unknown';
                const code = mapData.mapType === 'us' 
                    ? d.properties.postal 
                    : d.properties.ISO_A3;
                
                tooltip
                    .style('visibility', 'visible')
                    .html(`<strong>${name}</strong> (${code})`);
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
            .data(boundsData.features)
            .enter()
            .append('path')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', '#F9F5F1')
            .attr('stroke-width', '1');
            
        // Add labels (always show for highlighted regions)
        labelsLayer.selectAll('text')
            .data(geoData.features)
            .enter()
            .append('text')
            .attr('transform', d => {
                const centroid = path.centroid(d);
                if (isNaN(centroid[0]) || isNaN(centroid[1])) {
                    log('D3', 'Invalid centroid', { feature: d });
                    return null;
                }
                return `translate(${centroid})`;
            })
            .attr('text-anchor', 'middle')
            .attr('dy', '.35em')
            .style('font-size', '12px')
            .style('fill', '#333')
            .style('font-weight', 'bold')
            .style('pointer-events', 'none')
            .text(d => {
                const code = mapData.mapType === 'us'
                    ? d.properties.postal
                    : d.properties.ISO_A3;
                
                // Show label if region is highlighted
                if (mapData.highlightColors[code]) {
                    return mapData.mapType === 'us'
                        ? d.properties.name
                        : d.properties.NAME;
                }
                return '';
            });
        
        log('D3', 'Map rendered successfully');
        
    } catch (error) {
        log('D3', 'Error rendering map', { error: error.message });
        throw error;
    }
}
