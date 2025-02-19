import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create logs directory
const logsDir = join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Server-side logger
function log(type, action, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type,
        action,
        data
    };
    
    // Console output
    console.log(`[${timestamp}] ${type} - ${action}`);
    if (Object.keys(data).length > 0) {
        console.log(JSON.stringify(data, null, 2));
    }
    
    // File output
    const logPath = join(logsDir, `${type}_${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
    fs.appendFileSync(logPath, JSON.stringify(logEntry, null, 2) + '\n');
}

const app = express();
const port = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Log requests
app.use((req, res, next) => {
    log('SERVER', 'Incoming request', {
        method: req.method,
        url: req.url,
        headers: req.headers
    });
    next();
});

// Logging endpoint
app.post('/log', (req, res) => {
    const { type, action, data } = req.body;
    log(type, action, data);
    res.sendStatus(200);
});

// Claude API proxy
app.post('/api/claude', async (req, res) => {
    try {
        const { description, apiKey } = req.body;
        
        log('SERVER', 'Proxying Claude request', { description });
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-opus-20240229',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: description
                }],
                system: req.body.system
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            log('SERVER', 'Claude API error', error);
            res.status(response.status).json(error);
            return;
        }
        
        const data = await response.json();
        log('SERVER', 'Claude response received', data);
        res.json(data);
        
    } catch (error) {
        log('SERVER', 'Error proxying Claude request', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Serve static files
app.use(express.static(__dirname));

app.listen(port, () => {
    log('SERVER', 'Server started', { port });
    console.log(`Server running at http://localhost:${port}`);
});
