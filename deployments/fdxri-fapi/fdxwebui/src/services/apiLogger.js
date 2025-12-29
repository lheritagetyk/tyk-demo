/**
 * API Call Logger - Tracks all API calls for display
 */
class ApiCallLogger {
  constructor() {
    this.calls = []
    this.listeners = []
    this.counter = 0 // Counter for unique IDs
  }

  /**
   * Log an API call
   * @param {Object} call - API call information
   */
  log(call) {
    // If call has an ID, try to update existing entry
    if (call.id) {
      const existingIndex = this.calls.findIndex(c => c.id === call.id)
      if (existingIndex !== -1) {
        // Update existing entry
        const existing = this.calls[existingIndex]
        this.calls[existingIndex] = {
          ...existing,
          ...call,
          // Preserve original timestamp
          timestamp: existing.timestamp
        }
        this.notifyListeners(this.calls[existingIndex])
        return
      }
    }

    // Create new entry
    this.counter++
    // Generate a truly unique ID using multiple sources
    // Use full UUID if available, otherwise generate multiple random components
    const timestamp = Date.now()
    const perfTime = performance.now()
    // Use crypto.randomUUID if available for guaranteed uniqueness
    let uuid
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      uuid = crypto.randomUUID()
    } else {
      // Fallback: generate multiple random components
      uuid = `${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`
    }
    // Add additional random components to ensure uniqueness even for rapid successive calls
    const random1 = Math.random().toString(36).substring(2, 11)
    const random2 = Math.random().toString(36).substring(2, 11)
    // Include method and URL hash to make it more unique per request
    const urlHash = call.url ? call.url.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0).toString(36) : ''
    const uniqueId = `${timestamp}-${this.counter}-${perfTime.toFixed(9)}-${uuid}-${random1}-${random2}-${urlHash}`
    const logEntry = {
      id: uniqueId,
      timestamp: new Date().toISOString(),
      method: call.method || 'GET',
      url: call.url || '',
      headers: call.headers || {},
      body: call.body || null,
      status: call.status || 'pending',
      statusCode: call.statusCode || null,
      response: call.response || null,
      responseHeaders: call.responseHeaders || null,
      error: call.error || null,
      dpopProof: call.dpopProof || null,
      duration: call.duration || null
    }

    this.calls.push(logEntry)
    this.notifyListeners(logEntry)
    
    // Return the ID so it can be used to update the entry later
    return uniqueId
  }

  /**
   * Register a listener for new API calls
   * @param {Function} callback - Callback function
   */
  onLog(callback) {
    this.listeners.push(callback)
  }

  /**
   * Notify all listeners of a new API call
   * @param {Object} call - API call information
   */
  notifyListeners(call) {
    this.listeners.forEach(listener => {
      try {
        listener(call)
      } catch (error) {
        console.error('Error in API logger listener:', error)
      }
    })
  }

  /**
   * Clear all logged calls
   */
  clear() {
    this.calls = []
  }

  /**
   * Get all logged calls
   * @returns {Array} Array of API calls
   */
  getAll() {
    return this.calls
  }
}

// Create and export a singleton instance
const loggerInstance = new ApiCallLogger()
export { loggerInstance as ApiCallLogger }

