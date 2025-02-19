import { generateMapData } from './llmMapGenerator.js';
import { renderMap } from './mapVisualization.js';
import { exportBundle } from './exportD3Bundle.js';
import { log } from './logger.js';

// Store current map data
export let currentMapData = null;

// Initialize UI elements
const mapContainer = document.getElementById('map');
const generateButton = document.getElementById('generate');
const descriptionInput = document.getElementById('description');
const exportSvgButton = document.getElementById('export-svg');
const exportD3Button = document.getElementById('export-d3');

// Ensure map container has dimensions
mapContainer.style.width = '100%';
mapContainer.style.height = '600px';

// Initialize app
log('APP', 'Initializing application');

try {
    if (!mapContainer || !generateButton || !descriptionInput) {
        throw new Error('Required UI elements not found');
    }
    
    log('APP', 'Found UI elements');
    
    // Generate map on button click
    generateButton.addEventListener('click', async () => {
        try {
            const description = descriptionInput.value;
            if (!description) return;
            
            log('APP', 'Starting map generation', { description });
            
            // Clear previous map
            mapContainer.innerHTML = 'Loading map...';
            
            // Generate map data
            const apiKey = document.getElementById('api-key').value;
            const mapData = await generateMapData(description, apiKey);
            currentMapData = mapData;  // Set the current map data
            log('APP', 'Map data generated', { mapData });
            
            // Clear loading text
            mapContainer.innerHTML = '';
            
            // Render map
            await renderMap(mapContainer, mapData);
            
            // Enable export buttons
            exportSvgButton.disabled = false;
            exportD3Button.disabled = false;
            
        } catch (error) {
            log('APP', 'Error generating map', { error: error.message });
            mapContainer.innerHTML = `Error: ${error.message}`;
        }
    });
    
    // Export SVG on button click
    exportSvgButton.addEventListener('click', () => {
        const svg = mapContainer.querySelector('svg');
        if (!svg) return;
        
        const svgData = new XMLSerializer().serializeToString(svg);
        downloadFile(svgData, 'map.svg', 'image/svg+xml');
    });
    
    // Export D3 bundle on button click
    exportD3Button.addEventListener('click', async () => {
        try {
            const bundle = await exportBundle(mapContainer);
            downloadFile(bundle, 'map-visualization.zip', 'application/zip');
        } catch (error) {
            log('APP', 'Error exporting bundle', { error: error.message });
        }
    });
    
    log('APP', 'Application initialized');
    
} catch (error) {
    log('APP', 'Error initializing application', { error: error.message });
}

/**
 * Download file with given content and type
 * @param {string} content - File content
 * @param {string} filename - File name
 * @param {string} type - File MIME type
 */
function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
