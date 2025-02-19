/**
 * Log to console and server
 * @param {string} type - Component name
 * @param {string} action - Action being performed
 * @param {Object} data - Data to log
 */
export function log(type, action, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type,
        action,
        data
    };
    
    // Console output
    console.log(`[${timestamp}] ${type} - ${action}`);
    if (data) console.log(JSON.stringify(data, null, 2));
    
    // Send to server
    fetch('/log', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(logEntry)
    }).catch(err => console.error('Logging failed:', err));
}
