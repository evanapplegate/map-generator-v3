const MAX_DESCRIPTION_CHARS = 10000;
const MAX_SYSTEM_CHARS = 25000;
const MAX_REQUESTS_PER_IP_PER_HOUR = 60;
const MAX_REQUESTS_PER_DAY = 300;

const RENDER_MAP_TOOL = {
    name: "render_map",
    description: "Render a map visualization based on user request",
    input_schema: {
        type: "object",
        properties: {
            mapType: {
                type: "string",
                enum: ["world", "us"],
                description: "The type of map to render"
            },
            states: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        state: { type: "string", description: "Full name of the state or country" },
                        postalCode: { type: "string", description: "2-letter state code or 3-letter ISO country code. CRITICAL: Never use 'USA' here for states." },
                        label: { type: "string", description: "Display label" }
                    },
                    required: ["state", "postalCode", "label"]
                }
            },
            defaultFill: {
                type: "string",
                description: "Default hex color for non-highlighted regions"
            },
            highlightColors: {
                type: "object",
                additionalProperties: { type: "string" },
                description: "Mapping of postalCode/ISO_A3 to hex color"
            },
            borderColor: {
                type: "string",
                description: "Hex color for borders"
            },
            showLabels: {
                type: "boolean",
                description: "Whether to show country and state labels. Set to false if the user says 'dont label countries' or similar."
            },
            cities: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Name of the city" },
                        country: { type: "string", description: "Full name of the country where the city is located (for disambiguation)" },
                        isCapital: { type: "boolean", description: "Whether this city is a national capital" }
                    },
                    required: ["name", "country", "isCapital"]
                },
                description: "CRITICAL: You must include EVERY requested city and EVERY capital city for the requested groups (e.g. all 55 African Union capitals). Do not summarize or provide a partial list. Be exhaustive."
            }
        },
        required: ["mapType", "states", "defaultFill", "highlightColors", "borderColor", "showLabels", "cities"]
    }
};

// KV is eventually consistent, so these limits are approximate
async function isOverLimit(kv, key, limit, ttlSeconds) {
    const count = Number(await kv.get(key)) || 0;
    if (count >= limit) return true;
    await kv.put(key, String(count + 1), { expirationTtl: ttlSeconds }).catch(() => {});
    return false;
}

// Claude API proxy
export async function onRequestPost({ request, env }) {
    // Only accept calls made from this site's own pages
    if (request.headers.get('Origin') !== new URL(request.url).origin) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { description, system } = await request.json().catch(() => ({}));
    if (typeof description !== 'string' || description.length > MAX_DESCRIPTION_CHARS ||
        typeof system !== 'string' || system.length > MAX_SYSTEM_CHARS) {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const ip = request.headers.get('CF-Connecting-IP');
    if (await isOverLimit(env.RATE_LIMIT, `ip:${ip}:${now.slice(0, 13)}`, MAX_REQUESTS_PER_IP_PER_HOUR, 2 * 3600) ||
        await isOverLimit(env.RATE_LIMIT, `day:${now.slice(0, 10)}`, MAX_REQUESTS_PER_DAY, 2 * 86400)) {
        return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': env.CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-opus-4-5',
                max_tokens: 4000,
                messages: [{
                    role: 'user',
                    content: description
                }],
                system: [
                    {
                        type: "text",
                        text: system,
                        cache_control: { type: "ephemeral" }
                    }
                ],
                tools: [RENDER_MAP_TOOL],
                tool_choice: { type: "tool", name: "render_map" }
            })
        });

        return new Response(response.body, {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error proxying Claude request:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
