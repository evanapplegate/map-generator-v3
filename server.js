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
        ...data && { data }
    };
    
    // Console output
    console.log(`[${timestamp}] ${type} - ${action}`);
    
    // File output - one file per day
    const today = new Date().toISOString().split('T')[0];
    const logPath = join(logsDir, `${today}.log`);
    
    // Trim data for storage
    const trimmedData = { ...data };
    if (trimmedData.headers) {
        // Only keep essential headers
        trimmedData.headers = {
            'user-agent': trimmedData.headers['user-agent'],
            'referer': trimmedData.headers['referer']
        };
    }
    
    const storedEntry = {
        timestamp,
        type,
        action,
        ...trimmedData && { data: trimmedData }
    };
    
    fs.appendFileSync(logPath, JSON.stringify(storedEntry) + '\n');
    
    // Cleanup old logs (keep last 7 days)
    try {
        const files = fs.readdirSync(logsDir);
        const oldFiles = files
            .filter(f => f.endsWith('.log'))
            .map(f => ({ name: f, date: f.split('.')[0] }))
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(7);
            
        oldFiles.forEach(f => {
            try {
                fs.unlinkSync(join(logsDir, f.name));
            } catch (err) {
                console.error(`Failed to delete old log ${f.name}:`, err);
            }
        });
    } catch (err) {
        console.error('Failed to cleanup logs:', err);
    }
}

const app = express();
const port = process.env.PORT || 3000;

// Force HTTPS
app.enable('trust proxy');
app.use((req, res, next) => {
    if (req.secure || process.env.NODE_ENV !== 'production') {
        next();
    } else {
        res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
});

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
                model: 'claude-3-5-haiku-20241022',
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
