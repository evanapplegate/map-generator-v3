// JSDoc types for better IDE support

/**
 * @typedef {Object} StateData
 * @property {string} state - Full state name
 * @property {string} postalCode - ISO_A3 for countries, postal code for states
 * @property {string} label - Display name
 */

/**
 * @typedef {'us' | 'world'} MapType
 */

/**
 * @typedef {Object} MapData
 * @property {StateData[]} states - States/regions to highlight
 * @property {string} [defaultFill='#edded1'] - Default region fill color
 * @property {string} [borderColor='#ffffff'] - Border color
 * @property {Object.<string, string>} [highlightColors] - Map of postal codes to colors
 * @property {boolean} [showLabels=false] - Whether to show labels
 * @property {MapType} mapType - Type of map to render
 */

/**
 * Map configuration
 * @typedef {Object} MapData
 * @property {('us'|'world')} type - Map type
 * @property {Array<Region>} regions - List of regions to highlight
 */

/**
 * Region configuration
 * @typedef {Object} Region
 * @property {string} [state] - State name (for US maps)
 * @property {string} [country] - Country name (for world maps)
 * @property {string} color - CSS color name
 */

/**
 * @enum {string}
 */
const MapType = {
    US: 'us',
    WORLD: 'world'
};

/**
 * @param {string} description - Map description
 * @param {string} apiKey - Claude API key
 * @returns {Promise<MapData>}
 */
export async function generateMapData(description, apiKey) {
    // Implementation in llmMapGenerator.js
}

/**
 * @param {MapData} data - Map configuration
 * @param {HTMLElement} container - Container element
 * @returns {Promise<void>}
 */
export async function renderMap(data, container) {
    // Implementation in mapVisualization.js
}

/**
 * @param {MapData} data - Map configuration
 * @returns {Promise<Blob>} - ZIP file containing D3 bundle
 */
export async function exportBundle(data) {
    // Implementation in exportD3Bundle.js
}
