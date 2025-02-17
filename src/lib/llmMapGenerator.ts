import { MapData } from './types';

const getSystemPrompt = () => {
  return `You are a D3.js map visualization expert. Create map visualizations based on the user's request.

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

COLOR PREFERENCES:
- Default fill color: "#edded1"
- Default border color: "#ffffff"
- Use gentle pastels, relatively unsaturated
- Think 1977 Sunset Magazine aesthetic
- Aim for colors that are distinguishable but harmonious

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
};

const validateResponse = (jsonResponse: any): { isValid: boolean; issues: string[] } => {
  // Basic structure validation
  const requiredFields = ['mapType', 'states', 'defaultFill', 'highlightColors', 'borderColor', 'showLabels'];
  if (!requiredFields.every(field => jsonResponse.hasOwnProperty(field))) {
    return { 
      isValid: false, 
      issues: ['Missing required fields']
    };
  }

  // Map type validation
  if (!['world', 'us'].includes(jsonResponse.mapType)) {
    return {
      isValid: false,
      issues: ['Invalid map type']
    };
  }

  // States array validation
  if (!Array.isArray(jsonResponse.states) || jsonResponse.states.length === 0) {
    return {
      isValid: false,
      issues: ['Invalid or empty states array']
    };
  }

  // State objects validation
  const hasValidStates = jsonResponse.states.every((state: any) => 
    state.state && 
    state.postalCode && 
    state.label &&
    typeof state.state === 'string' &&
    typeof state.postalCode === 'string' &&
    typeof state.label === 'string'
  );

  if (!hasValidStates) {
    return {
      isValid: false,
      issues: ['Invalid state data structure']
    };
  }

  // Validate postal codes based on map type
  const isValidPostalCode = (code: string, mapType: string) => {
    return mapType === 'us' ? /^[A-Z]{2}$/.test(code) : /^[A-Z]{3}$/.test(code);
  };

  const hasValidPostalCodes = jsonResponse.states.every((state: any) =>
    state.postalCode && typeof state.postalCode === 'string' && 
    (isValidPostalCode(state.postalCode, 'us') || isValidPostalCode(state.postalCode, 'world'))
  );

  if (!hasValidPostalCodes) {
    return {
      isValid: false,
      issues: ['Invalid postal codes for map type']
    };
  }

  return { isValid: true, issues: [] };
};

export const generateMapInstructions = async (description: string, apiKey: string): Promise<MapData[]> => {
  if (!apiKey) {
    console.log('No API key provided');
    throw new Error('Claude API key required for map generation');
  }

  try {
    console.log('Sending request to Claude:', description);
    
    const variations = await Promise.all([0, 1].map(async (index) => {
      try {
        const response = await fetch('/api/claude', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apiKey,
            system: getSystemPrompt(),
            messages: [
              { role: "user", content: description }
            ]
          })
        });

        if (!response.ok) {
          const error = await response.text();
          console.error(`Claude API error for variation ${index}:`, error);
          throw new Error(`Claude API error: ${error}`);
        }

        const data = await response.json();
        const content = data.content?.[0]?.text;
        if (!content) {
          throw new Error('No response from Claude');
        }

        console.log(`Claude raw response for variation ${index}:`, content);

        let jsonResponse;
        try {
          jsonResponse = JSON.parse(content);
        } catch (e) {
          console.error('Failed to parse JSON from Claude response:', e);
          throw new Error('Invalid JSON response from Claude');
        }

        const validation = validateResponse(jsonResponse);
        if (!validation.isValid) {
          throw new Error(`Invalid response format: ${validation.issues.join(', ')}`);
        }

        return jsonResponse;
      } catch (error) {
        console.error(`Error generating variation ${index}:`, error);
        throw error;
      }
    }));

    return variations;
  } catch (error) {
    console.error('Error in generateMapInstructions:', error);
    throw error;
  }
};
