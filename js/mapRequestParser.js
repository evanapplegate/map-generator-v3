/**
 * Parse user input to determine map type and regions
 * @param {string} input - User's map description
 * @returns {Object} Parsed map request
 */
export function parseMapRequest(input) {
    const lowercased = input.toLowerCase();
    
    // Detect map type
    const isUSMap = lowercased.includes('us') || 
                   lowercased.includes('united states') ||
                   lowercased.includes('america');
    
    // Extract state/country names and colors
    const colorMatches = input.match(/([A-Za-z\s]+)\s+in\s+([a-z]+)/g) || [];
    const regions = colorMatches.map(match => {
        const [_, region, color] = match.match(/([A-Za-z\s]+)\s+in\s+([a-z]+)/);
        return {
            name: region.trim(),
            color: color.trim()
        };
    });
    
    return {
        mapType: isUSMap ? 'us' : 'world',
        regions
    };
}
