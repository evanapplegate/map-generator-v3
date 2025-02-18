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
        const geoData = await loadGeoJSON(mapData.mapType);
        
        // Set dimensions
        const width = container.clientWidth;
        const height = container.clientHeight || 600;
        
        // Create SVG
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);
        
        // Create projection
        const projection = mapData.mapType === 'us' 
            ? d3.geoAlbersUsa().fitSize([width, height], geoData)
            : d3.geoMercator().fitSize([width, height], geoData);
        
        // Create path generator
        const path = d3.geoPath().projection(projection);
        
        // Draw regions
        svg.selectAll('path')
            .data(geoData.features)
            .enter()
            .append('path')
            .attr('d', path)
            .attr('fill', d => {
                // Get region code
                const code = mapData.mapType === 'us' 
                    ? d.properties.postal
                    : d.properties.ISO_A3;
                
                // Use highlight color if available
                return mapData.highlightColors[code] || mapData.defaultFill;
            })
            .attr('stroke', mapData.borderColor)
            .attr('stroke-width', 0.5);
            
        // Add labels if enabled
        if (mapData.showLabels) {
            svg.selectAll('text')
                .data(geoData.features)
                .enter()
                .append('text')
                .attr('transform', d => {
                    const centroid = path.centroid(d);
                    return `translate(${centroid})`;
                })
                .attr('text-anchor', 'middle')
                .attr('dy', '.35em')
                .style('font-size', '12px')
                .style('fill', '#333')
                .text(d => {
                    const code = mapData.mapType === 'us'
                        ? d.properties.postal
                        : d.properties.ISO_A3;
                    
                    const state = mapData.states.find(s => s.postalCode === code);
                    return state ? state.label : '';
                });
        }
        
        log('D3', 'Map rendered successfully');
        
    } catch (error) {
        log('D3', 'Error rendering map', { error: error.message });
        throw error;
    }
}
