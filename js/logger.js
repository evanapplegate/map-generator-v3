/**
 * Log to console
 * @param {string} type - Component name
 * @param {string} action - Action being performed
 * @param {Object} data - Data to log
 */
export function log(type, action, data) {
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] ${type} - ${action}`);
    if (data) console.log(JSON.stringify(data, null, 2));
}
