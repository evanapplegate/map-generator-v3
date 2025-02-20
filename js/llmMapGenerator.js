import { log } from './logger.js';

const SYSTEM_PROMPT = `You are a D3.js map visualization expert. Create map visualizations based on the user's request.

AVAILABLE GEOJSON FILES AND THEIR FIELDS:
1. countries.geojson:
   - Field "NAME": Full country name
   - Field "ISO_A3": 3-letter ISO code (e.g. USA, GBR)
   - Example: { "properties": { "NAME": "United States", "ISO_A3": "USA" } }

2. US_states.geojson:
   - Field "name": Full state name
   - Field "postal": 2-letter postal code (e.g. CA, NY)
   - Example: { "properties": { "name": "California", "postal": "CA" } }

3. Boundary files:
   - country_bounds.geojson: World boundaries
   - US_bounds.geojson: US state boundaries

4. city files:
 - cities.geojson: field NAME has the full name; you'll have to do some unicode handling, if user asks for "Sao Paulo," the file has NAME = "São Paulo", so you'll mark it "São Paulo". This also has field "ADM0NAME" for the country so you can disambiguate; if user asks for "Sao Paulo, Brazil" just mark the city name "São Paulo"

REGION HANDLING:
- For world maps: Only include US states if explicitly mentioned
- For US maps: Only include states, no countries
- Example world map: "India in purple, france in teal"
- Example world map with states: "world map, france in blue, texas in red"
- Example US-only map: "california and nevada in green"

COLOR PREFERENCES:
- Default fill color: "#edded1"; any country not specifically colored by user gets this color
- Default border color: "#ffffff"
- Use gentle pastels for fills; no fill color above 30% saturation (in HSB color space)
- Think 1977 Sunset Magazine aesthetic
- Aim for colors that are distinguishable but harmonious.

RESPOND ONLY WITH A VALID JSON OBJECT. NO OTHER TEXT OR FORMATTING.

The JSON must follow this format:
{
  "mapType": "world" | "us",
  "states": [
    {
      "state": "Full Name",
      "postalCode": "ISO_A3 or postal code",
      "label": "Display Name"
    }
  ],
  "defaultFill": "#hexColor",
  "highlightColors": {
    "postalCode": "#hexColor"
  },
  "borderColor": "#hexColor",
  "showLabels": boolean
}`;

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * Sleep for specified milliseconds
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate map data using Claude API
 * @param {string} description - User's map description
 * @returns {Promise<Object>} Map configuration
 */
export async function generateMapData(description) {
    log('CLAUDE', 'Generating map data', { description });
    
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch('/api/claude', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description,
                    system: SYSTEM_PROMPT
                })
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Extract content from Claude's response
            try {
                const content = data.content[0].text;
                const mapData = JSON.parse(content);
                
                // Validate response structure
                if (!mapData.mapType || !mapData.states) {
                    throw new Error('Invalid response structure from Claude');
                }
                
                if (!['us', 'world'].includes(mapData.mapType)) {
                    throw new Error('Invalid map type from Claude');
                }
                
                if (!Array.isArray(mapData.states)) {
                    throw new Error('States must be an array');
                }
                
                for (const state of mapData.states) {
                    if (!state.state || !state.postalCode || !state.label) {
                        throw new Error('Missing required state fields');
                    }
                }
                
                if (!mapData.defaultFill || !mapData.highlightColors || !mapData.borderColor) {
                    throw new Error('Missing required color fields');
                }
                
                log('CLAUDE', 'Validated map data', mapData);
                
                // Force showLabels to true
                mapData.showLabels = true;
                
                return mapData;
                
            } catch (parseError) {
                log('CLAUDE', 'JSON parse error', { 
                    error: parseError.message,
                    content: data.content[0].text,
                    attempt 
                });
                
                if (attempt === MAX_RETRIES) {
                    throw new Error(`Failed to parse Claude's response after ${MAX_RETRIES} attempts: ${parseError.message}`);
                }
                
                // Wait before retrying
                await sleep(RETRY_DELAY);
                continue;
            }
            
        } catch (error) {
            lastError = error;
            log('CLAUDE', 'Request error', { 
                error: error.message,
                attempt 
            });
            
            if (attempt === MAX_RETRIES) {
                throw new Error(`Failed after ${MAX_RETRIES} attempts: ${error.message}`);
            }
            
            // Wait before retrying
            await sleep(RETRY_DELAY);
        }
    }
    
    throw lastError;
}
