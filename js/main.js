import { generateMapData } from './llmMapGenerator.js';
import { renderMap } from './mapVisualization.js';
import { exportBundle } from './exportD3Bundle.js';
import { exportPptx } from './exportPptx.js';
import { log } from './logger.js';

// Store current map data
export let currentMapData = null;

// Initialize UI elements
const mapContainer1 = document.getElementById('map1');
const mapContainer2 = document.getElementById('map2');
const mapContainer3 = document.getElementById('map3');
const generateButton = document.getElementById('generate');
const descriptionInput = document.getElementById('description');
const exportSvgButton = document.getElementById('export-svg');
const exportPptxButton = document.getElementById('export-pptx');
const exportD3Button = document.getElementById('export-d3');
const exportSvgButton2 = document.getElementById('export-svg2');
const exportPptxButton2 = document.getElementById('export-pptx2');
const exportD3Button2 = document.getElementById('export-d3-2');
const exportSvgButton3 = document.getElementById('export-svg3');
const exportPptxButton3 = document.getElementById('export-pptx3');
const exportD3Button3 = document.getElementById('export-d3-3');

// Ensure map container has dimensions
mapContainer1.style.width = '100%';
mapContainer1.style.height = '400px';
mapContainer2.style.width = '100%';
mapContainer2.style.height = '400px';
mapContainer3.style.width = '100%';
mapContainer3.style.height = '400px';

// Store map data for each container
const mapDataStore = new Map();

// Global error handlers for verbose logging
window.addEventListener('error', (event) => {
    const errorDetails = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? {
            name: event.error.name,
            message: event.error.message,
            stack: event.error.stack
        } : null
    };
    log('APP', 'Unhandled error', errorDetails);
    console.error('UNHANDLED ERROR:', errorDetails);
});

window.addEventListener('unhandledrejection', (event) => {
    const errorDetails = {
        reason: event.reason,
        promise: event.promise,
        error: event.reason instanceof Error ? {
            name: event.reason.name,
            message: event.reason.message,
            stack: event.reason.stack
        } : event.reason
    };
    log('APP', 'Unhandled promise rejection', errorDetails);
    console.error('UNHANDLED PROMISE REJECTION:', errorDetails);
});

// Initialize app
log('APP', 'Initializing application');

try {
    if (!mapContainer1 || !mapContainer2 || !mapContainer3 || !generateButton || !descriptionInput) {
        throw new Error('Required UI elements not found');
    }
    
    log('APP', 'Found UI elements');
    
    // Generate map on button click
    generateButton.addEventListener('click', async () => {
        try {
            const description = descriptionInput.value;
            if (!description) return;
            
            log('APP', 'Starting map generation', { description });
            
            // Clear containers and hide export buttons
            mapContainer1.innerHTML = 'Generating first map...<div class="spinner"></div>';
            mapContainer2.innerHTML = 'Generating second map...<div class="spinner"></div>';
            mapContainer3.innerHTML = 'Generating third map...<div class="spinner"></div>';
            document.getElementById('export-buttons').style.display = 'none';
            document.getElementById('export-buttons2').style.display = 'none';
            document.getElementById('export-buttons3').style.display = 'none';
            exportSvgButton.disabled = true;
            exportPptxButton.disabled = true;
            exportD3Button.disabled = true;
            exportSvgButton2.disabled = true;
            exportPptxButton2.disabled = true;
            exportD3Button2.disabled = true;
            exportSvgButton3.disabled = true;
            exportPptxButton3.disabled = true;
            exportD3Button3.disabled = true;
            
            // Start first request immediately
            const req1Promise = generateMapData(description)
                .then(async mapData => {
                    log('APP', 'First map data generated');
                    mapDataStore.set(mapContainer1, mapData);
                    mapContainer1.innerHTML = 'Rendering...<div class="spinner"></div>';
                    await renderMap(mapContainer1, mapData);
                    document.getElementById('export-buttons').style.display = 'flex';
                    exportSvgButton.disabled = false;
                    exportPptxButton.disabled = false;
                    exportD3Button.disabled = false;
                })
                .catch(error => {
                    log('APP', 'Error generating first map', { error: error.message });
                    mapContainer1.innerHTML = `Error: ${error.message}`;
                });

            // Start second request after 3s delay
            const req2Promise = new Promise(resolve => setTimeout(resolve, 3000))
                .then(() => generateMapData(description))
                .then(async mapData => {
                    log('APP', 'Second map data generated');
                    mapDataStore.set(mapContainer2, mapData);
                    mapContainer2.innerHTML = 'Rendering...<div class="spinner"></div>';
                    await renderMap(mapContainer2, mapData);
                    document.getElementById('export-buttons2').style.display = 'flex';
                    exportSvgButton2.disabled = false;
                    exportPptxButton2.disabled = false;
                    exportD3Button2.disabled = false;
                })
                .catch(error => {
                    log('APP', 'Error generating second map', { error: error.message });
                    mapContainer2.innerHTML = `Error: ${error.message}`;
                });

            // Start third request after 6s delay
            const req3Promise = new Promise(resolve => setTimeout(resolve, 6000))
                .then(() => generateMapData(description))
                .then(async mapData => {
                    log('APP', 'Third map data generated');
                    mapDataStore.set(mapContainer3, mapData);
                    mapContainer3.innerHTML = 'Rendering...<div class="spinner"></div>';
                    await renderMap(mapContainer3, mapData);
                    document.getElementById('export-buttons3').style.display = 'flex';
                    exportSvgButton3.disabled = false;
                    exportPptxButton3.disabled = false;
                    exportD3Button3.disabled = false;
                })
                .catch(error => {
                    log('APP', 'Error generating third map', { error: error.message });
                    mapContainer3.innerHTML = `Error: ${error.message}`;
                });

            // Wait for all to complete, but don't throw errors since they're handled per-request
            await Promise.allSettled([req1Promise, req2Promise, req3Promise]);
            
        } catch (error) {
            log('APP', 'Error generating map', { error: error.message });
            mapContainer1.innerHTML = `Error: ${error.message}`;
            mapContainer2.innerHTML = `Error: ${error.message}`;
            mapContainer3.innerHTML = `Error: ${error.message}`;
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

    exportSvgButton3.addEventListener('click', () => {
        const svg = mapContainer3.querySelector('svg');
        if (!svg) return;
        
        const svgData = new XMLSerializer().serializeToString(svg);
        downloadFile(svgData, 'map3.svg', 'image/svg+xml');
    });

    // Export PPTX on button click
    exportPptxButton.addEventListener('click', async () => {
        try {
            await exportPptx(mapContainer1, 'map.pptx');
        } catch (error) {
            log('APP', 'Error exporting PPTX', { error: error.message });
        }
    });

    exportPptxButton2.addEventListener('click', async () => {
        try {
            await exportPptx(mapContainer2, 'map2.pptx');
        } catch (error) {
            log('APP', 'Error exporting PPTX', { error: error.message });
        }
    });

    exportPptxButton3.addEventListener('click', async () => {
        try {
            await exportPptx(mapContainer3, 'map3.pptx');
        } catch (error) {
            log('APP', 'Error exporting PPTX', { error: error.message });
        }
    });
    
    // Export D3 bundle on button click
    exportD3Button.addEventListener('click', async () => {
        try {
            const mapData = mapDataStore.get(mapContainer1);
            if (!mapData) throw new Error('No map data found');
            const bundle = await exportBundle(mapContainer1, mapData);
            downloadFile(bundle, 'map-visualization.zip', 'application/zip');
        } catch (error) {
            log('APP', 'Error exporting bundle', { error: error.message });
        }
    });
    
    exportD3Button2.addEventListener('click', async () => {
        try {
            const mapData = mapDataStore.get(mapContainer2);
            if (!mapData) throw new Error('No map data found');
            const bundle = await exportBundle(mapContainer2, mapData);
            downloadFile(bundle, 'map2-visualization.zip', 'application/zip');
        } catch (error) {
            log('APP', 'Error exporting bundle', { error: error.message });
        }
    });
    
    exportD3Button3.addEventListener('click', async () => {
        try {
            const mapData = mapDataStore.get(mapContainer3);
            if (!mapData) throw new Error('No map data found');
            const bundle = await exportBundle(mapContainer3, mapData);
            downloadFile(bundle, 'map3-visualization.zip', 'application/zip');
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
