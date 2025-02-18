import { generateMapData } from './llmMapGenerator.js';
import { renderMap } from './mapVisualization.js';
import { exportBundle } from './exportD3Bundle.js';
import { log } from './logger.js';

// Store current map data
let currentMapData = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    log('APP', 'Initializing application');
    
    const apiKeyInput = document.getElementById('api-key');
    const descriptionInput = document.getElementById('map-description');
    const generateButton = document.getElementById('generate');
    const exportSvgButton = document.getElementById('export-svg');
    const exportBundleButton = document.getElementById('export-bundle');
    const mapContainer = document.getElementById('map-container');
    
    log('APP', 'Found UI elements');
    
    // Generate map
    generateButton.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value;
        const description = descriptionInput.value;
        
        if (!apiKey || !description) {
            log('APP', 'Missing input', { hasApiKey: !!apiKey, hasDescription: !!description });
            alert('Please enter both API key and map description');
            return;
        }
        
        try {
            log('APP', 'Starting map generation', { description });
            generateButton.disabled = true;
            
            currentMapData = await generateMapData(description, apiKey);
            log('APP', 'Map data generated', { mapData: currentMapData });
            
            await renderMap(currentMapData, mapContainer);
            log('APP', 'Map rendered');
            
            // Enable export buttons
            exportSvgButton.disabled = false;
            exportBundleButton.disabled = false;
        } catch (error) {
            log('APP', 'Error generating map', { error: error.message });
            alert('Error generating map: ' + error.message);
        } finally {
            generateButton.disabled = false;
        }
    });
    
    // Export SVG
    exportSvgButton.addEventListener('click', () => {
        log('APP', 'Starting SVG export');
        const svg = mapContainer.querySelector('svg');
        if (!svg) {
            log('APP', 'No SVG found to export');
            return;
        }
        
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        
        log('APP', 'SVG serialized', { 
            sizeBytes: blob.size,
            type: blob.type
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'map.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        log('APP', 'SVG export complete');
    });
    
    // Export D3 bundle
    exportBundleButton.addEventListener('click', async () => {
        if (!currentMapData) {
            log('APP', 'No map data to export');
            return;
        }
        
        try {
            log('APP', 'Starting bundle export');
            exportBundleButton.disabled = true;
            
            const blob = await exportBundle(currentMapData);
            log('APP', 'Bundle generated', {
                sizeBytes: blob.size,
                type: blob.type
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'map-visualization.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            log('APP', 'Bundle export complete');
        } catch (error) {
            log('APP', 'Error exporting bundle', { error: error.message });
            alert('Error exporting bundle: ' + error.message);
        } finally {
            exportBundleButton.disabled = false;
        }
    });
    
    // Disable export buttons initially
    exportSvgButton.disabled = true;
    exportBundleButton.disabled = true;
    
    log('APP', 'Application initialized');
});
