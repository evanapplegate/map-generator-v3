import { generateMapData } from './llmMapGenerator.js';
import { renderMap } from './mapVisualization.js';
import { exportBundle } from './exportD3Bundle.js';
import { log } from './logger.js';

// Store current map data
export let currentMapData = null;

// Initialize UI elements
const mapContainer1 = document.getElementById('map1');
const mapContainer2 = document.getElementById('map2');
const generateButton = document.getElementById('generate');
const descriptionInput = document.getElementById('description');
const exportSvgButton = document.getElementById('export-svg');
const exportD3Button = document.getElementById('export-d3');
const exportSvgButton2 = document.getElementById('export-svg2');
const exportD3Button2 = document.getElementById('export-d3-2');

// Ensure map container has dimensions
mapContainer1.style.width = '100%';
mapContainer1.style.height = '400px';
mapContainer2.style.width = '100%';
mapContainer2.style.height = '400px';

// Initialize app
log('APP', 'Initializing application');

try {
    if (!mapContainer1 || !mapContainer2 || !generateButton || !descriptionInput) {
        throw new Error('Required UI elements not found');
    }
    
    log('APP', 'Found UI elements');
    
    // Generate map on button click
    generateButton.addEventListener('click', async () => {
        try {
            const description = descriptionInput.value;
            if (!description) return;
            
            log('APP', 'Starting map generation', { description });
            
            // Clear both containers and hide export buttons
            mapContainer1.innerHTML = 'Generating first map...';
            mapContainer2.innerHTML = 'Generating second map...';
            document.getElementById('export-buttons').style.display = 'none';
            document.getElementById('export-buttons2').style.display = 'none';
            exportSvgButton.disabled = true;
            exportD3Button.disabled = true;
            exportSvgButton2.disabled = true;
            exportD3Button2.disabled = true;
            
            const apiKey = document.getElementById('api-key').value;
            
            // Start first request immediately
            const req1Promise = generateMapData(description, apiKey)
                .then(async mapData => {
                    log('APP', 'First map data generated');
                    currentMapData = mapData; // Store for first map's export
                    mapContainer1.innerHTML = 'Rendering...';
                    await renderMap(mapContainer1, mapData);
                    document.getElementById('export-buttons').style.display = 'flex';
                    exportSvgButton.disabled = false;
                    exportD3Button.disabled = false;
                });

            // Start second request after 3s delay
            const req2Promise = new Promise(resolve => setTimeout(resolve, 3000))
                .then(() => generateMapData(description, apiKey))
                .then(async mapData => {
                    log('APP', 'Second map data generated');
                    mapContainer2.innerHTML = 'Rendering...';
                    await renderMap(mapContainer2, mapData);
                    
                    // Store mapData when exporting second map
                    exportD3Button2.addEventListener('click', async () => {
                        currentMapData = mapData;
                        try {
                            const bundle = await exportBundle(mapContainer2);
                            downloadFile(bundle, 'map2-visualization.zip', 'application/zip');
                        } catch (error) {
                            log('APP', 'Error exporting bundle', { error: error.message });
                        }
                    }, { once: true });
                    
                    document.getElementById('export-buttons2').style.display = 'flex';
                    exportSvgButton2.disabled = false;
                    exportD3Button2.disabled = false;
                });

            // Wait for both to complete
            await Promise.all([req1Promise, req2Promise]);
            
        } catch (error) {
            log('APP', 'Error generating map', { error: error.message });
            mapContainer1.innerHTML = `Error: ${error.message}`;
            mapContainer2.innerHTML = `Error: ${error.message}`;
        }
    });
    
    // Export SVG on button click
    exportSvgButton.addEventListener('click', () => {
        const svg = mapContainer1.querySelector('svg');
        if (!svg) return;
        
        const svgData = new XMLSerializer().serializeToString(svg);
        downloadFile(svgData, 'map.svg', 'image/svg+xml');
    });
    
    exportSvgButton2.addEventListener('click', () => {
        const svg = mapContainer2.querySelector('svg');
        if (!svg) return;
        
        const svgData = new XMLSerializer().serializeToString(svg);
        downloadFile(svgData, 'map2.svg', 'image/svg+xml');
    });
    
    // Export D3 bundle on button click
    exportD3Button.addEventListener('click', async () => {
        try {
            const bundle = await exportBundle(mapContainer1);
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
