import axios from 'axios'
import { DPoPService } from './dpopService'
import { ApiCallLogger } from './apiLogger'

// Default to Tyk Gateway endpoints
// In development, use proxy to avoid CORS issues
const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV

// Helper function to convert full URLs to proxy paths in dev mode
const getProxyPath = (envVar, defaultProxyPath, defaultFullUrl) => {
  if (isDev) {
    // In dev mode, always use proxy path, even if env var is a full URL
    return defaultProxyPath
  }
  // In production, use env var if set, otherwise default full URL
  return import.meta.env[envVar] || defaultFullUrl
}

const FDX_CORE_API_URL = getProxyPath('VITE_FDX_CORE_API_URL', '/fdxfapi', 'http://tyk-gateway.localhost:8080/fdxfapi')
const FDX_CUSTOMER_API_URL = getProxyPath('VITE_FDX_CUSTOMER_API_URL', '/fdxapi', 'http://tyk-gateway.localhost:8080/fdxapi')

/**
 * FDX API Service - Handles all FDX API calls with DPoP
 */
export class FDXApiService {
  /**
   * Make an authenticated FDX API request with DPoP
   * @param {string} method - HTTP method
   * @param {string} url - API endpoint URL
   * @param {string} accessToken - DPoP-bound access token
   * @param {Object} options - Additional options (body, headers, etc.)
   * @returns {Promise<Object>} API response
   */
  static async makeRequest(method, url, accessToken, options = {}) {
    const startTime = Date.now()
    
    // Debug logging - URL construction
    console.log(`🔧 Building request URL:`)
    console.log('  - Input URL:', url)
    console.log('  - FDX_CORE_API_URL:', FDX_CORE_API_URL)
    console.log('  - FDX_CUSTOMER_API_URL:', FDX_CUSTOMER_API_URL)
    
    let fullUrl
    if (url.startsWith('http')) {
      // Already a full URL - use as-is
      fullUrl = url
      console.log('  - Using full URL as-is')
    } else if (url.startsWith('/')) {
      // Proxy path (like /fdxapi/customers) - convert to full URL using current origin
      // This ensures the Vite proxy handles the request and CORS
      fullUrl = `${window.location.origin}${url}`
      console.log('  - Converted proxy path to full URL:', fullUrl)
    } else {
      // Relative path - prepend CORE API URL
      const baseUrl = FDX_CORE_API_URL.endsWith('/') ? FDX_CORE_API_URL.slice(0, -1) : FDX_CORE_API_URL
      const path = url.startsWith('/') ? url : `/${url}`
      fullUrl = `${baseUrl}${path}`
      // If result is a proxy path, convert to full URL
      if (fullUrl.startsWith('/')) {
        fullUrl = `${window.location.origin}${fullUrl}`
      }
      console.log('  - Constructed from base + path:', fullUrl)
    }
    console.log('  - Final URL:', fullUrl)

    // Generate DPoP proof
    // For DPoP proof, we need the actual target URL (what Tyk Gateway sees)
    // If we're using a proxy, the proxy rewrites the path, so we need the target URL
    // Also need to include query parameters in the DPoP proof's htu claim
    let dpopTargetUrl = fullUrl
    
    // Build query string from params if provided
    let queryString = ''
    if (options.params && Object.keys(options.params).length > 0) {
      const params = new URLSearchParams()
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          params.append(key, value)
        }
      })
      queryString = params.toString()
      if (queryString) {
        queryString = '?' + queryString
      }
    }
    
    if (isDev && fullUrl.includes('/fdxapi')) {
      // Proxy rewrites /fdxapi to /fdxapi on target, so use tyk-gateway URL
      dpopTargetUrl = fullUrl.replace(window.location.origin, 'http://tyk-gateway.localhost:8080') + queryString
    } else if (isDev && fullUrl.includes('/fdxfapi')) {
      // Proxy rewrites /fdxfapi to /fdxfapi on target
      dpopTargetUrl = fullUrl.replace(window.location.origin, 'http://tyk-gateway.localhost:8080') + queryString
    } else if (isDev && fullUrl.includes('/account-information')) {
      // Proxy rewrites /account-information to /account-information on target
      dpopTargetUrl = fullUrl.replace(window.location.origin, 'http://tyk-gateway.localhost:8080') + queryString
    } else {
      // For non-proxy URLs, append query string
      dpopTargetUrl = fullUrl + queryString
    }
    
    console.log(`🔐 Generating DPoP proof:`)
    console.log('  - Request URL (for HTTP):', fullUrl)
    console.log('  - Query params:', options.params)
    console.log('  - Query string:', queryString)
    console.log('  - DPoP Target URL (htu claim):', dpopTargetUrl)
    let dpopProof = null
    try {
      dpopProof = await DPoPService.generateProof(method, dpopTargetUrl, accessToken)
      console.log('✅ DPoP proof generated successfully')
    } catch (error) {
      console.error('❌ Failed to generate DPoP proof:', error)
      ApiCallLogger.log({
        method,
        url: fullUrl,
        status: 'error',
        error: `Failed to generate DPoP proof: ${error.message}`,
        duration: Date.now() - startTime
      })
      throw error
    }

    // Prepare headers
    // For DPoP-bound tokens, use "DPoP" scheme in Authorization header
    // The DPoP proof goes in a separate "DPoP" header
    const headers = {
      'Authorization': `DPoP ${accessToken}`,
      'DPoP': dpopProof,
      'Content-Type': 'application/json',
      'x-fapi-interaction-id': crypto.randomUUID(),
      ...options.headers
    }

    // Log request with full DPoP proof for UI display
    // Store the ID so we can update this entry when the request completes
    const callId = ApiCallLogger.log({
      method,
      url: fullUrl,
      headers: { ...headers }, // Include full headers including DPoP
      body: options.body,
      status: 'pending',
      dpopProof: dpopProof // Store full DPoP proof for display
    })

    // Debug logging - Full request details
    console.group(`🔵 FDX API Request: ${method} ${fullUrl}`)
    console.log('📤 Request Headers:', {
      ...headers,
      'DPoP': dpopProof.substring(0, 100) + '... (full proof logged below)'
    })
    console.log('📤 Full DPoP Proof:', dpopProof)
    console.log('📤 Request Body:', options.body)
    console.log('📤 Request Params:', options.params)
    console.log('📤 Full URL:', fullUrl)
    console.groupEnd()

    try {
      // Log exactly what we're about to send
      console.log('🚀 Sending actual request (not preflight):')
      console.log('  Method:', method)
      console.log('  URL:', fullUrl)
      console.log('  Headers being sent:', Object.keys(headers))
      console.log('  Authorization header present:', !!headers['Authorization'])
      console.log('  DPoP header present:', !!headers['DPoP'])
      
      const response = await axios({
        method,
        url: fullUrl,
        headers,
        data: options.body,
        params: options.params,
        // Ensure credentials are sent for CORS
        withCredentials: false // Don't send cookies, but ensure headers are sent
      })

      const duration = Date.now() - startTime

      // Debug logging - Full response details
      console.group(`🟢 FDX API Response: ${method} ${fullUrl}`)
      console.log('📥 Response Status:', response.status, response.statusText)
      console.log('📥 Response Headers:', response.headers)
      console.log('📥 Response Data:', response.data)
      console.log('📥 Duration:', duration, 'ms')
      console.groupEnd()

      // Update the existing log entry with response
      ApiCallLogger.log({
        id: callId, // Use the same ID to update the pending entry
        method,
        url: fullUrl,
        status: 'success',
        statusCode: response.status,
        response: response.data,
        responseHeaders: response.headers,
        duration
      })

      return response.data
    } catch (error) {
      const duration = Date.now() - startTime

      // Debug logging - Full error details
      console.group(`🔴 FDX API Error: ${method} ${fullUrl}`)
      console.error('❌ Error Message:', error.message)
      console.error('❌ Error Code:', error.code)
      console.error('❌ Error Name:', error.name)
      if (error.response) {
        console.error('❌ Response Status:', error.response.status, error.response.statusText)
        console.error('❌ Response Headers:', error.response.headers)
        console.error('❌ Response Data:', error.response.data)
      } else if (error.request) {
        console.error('❌ Request made but no response received')
        console.error('❌ Request:', error.request)
      }
      console.error('❌ Full Error Object:', error)
      console.error('❌ Duration:', duration, 'ms')
      console.groupEnd()

      // Update the existing log entry with error
      ApiCallLogger.log({
        id: callId, // Use the same ID to update the pending entry
        method,
        url: fullUrl,
        status: 'error',
        statusCode: error.response?.status || null,
        error: error.message,
        response: error.response?.data || null,
        responseHeaders: error.response?.headers || null,
        duration
      })

      throw error
    }
  }

  /**
   * Get customers
   * @param {string} accessToken - DPoP-bound access token
   * @returns {Promise<Object>} Customers response
   */
  static async getCustomers(accessToken) {
    // Use Customer API URL for customer endpoints
    // Pass the full URL (including base) to makeRequest
    const baseUrl = FDX_CUSTOMER_API_URL.endsWith('/') ? FDX_CUSTOMER_API_URL.slice(0, -1) : FDX_CUSTOMER_API_URL
    const customerUrl = `${baseUrl}/customers`
    // If it's a proxy path (starts with /), makeRequest will convert it to full URL
    // If it's already a full URL, makeRequest will use it as-is
    return this.makeRequest('GET', customerUrl, accessToken)
  }

  /**
   * Get current customer info
   * @param {string} accessToken - DPoP-bound access token
   * @returns {Promise<Object>} Customer response
   */
  static async getCurrentCustomer(accessToken) {
    // Use Customer API URL for customer endpoints
    const baseUrl = FDX_CUSTOMER_API_URL.endsWith('/') ? FDX_CUSTOMER_API_URL.slice(0, -1) : FDX_CUSTOMER_API_URL
    const customerUrl = `${baseUrl}/customers/current`
    return this.makeRequest('GET', customerUrl, accessToken)
  }

  /**
   * Get customer by ID
   * @param {string} accessToken - DPoP-bound access token
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Customer response
   */
  static async getCustomerById(accessToken, customerId) {
    // Use Customer API URL for customer endpoints
    const baseUrl = FDX_CUSTOMER_API_URL.endsWith('/') ? FDX_CUSTOMER_API_URL.slice(0, -1) : FDX_CUSTOMER_API_URL
    const customerUrl = `${baseUrl}/customers/${customerId}`
    return this.makeRequest('GET', customerUrl, accessToken)
  }

  /**
   * Get accounts
   * @param {string} accessToken - DPoP-bound access token
   * @param {Array<string>} accountIds - Optional account IDs to filter
   * @returns {Promise<Object>} Accounts response
   */
  static async getAccounts(accessToken, accountIds = null) {
    const params = accountIds ? { accountIds: accountIds.join(',') } : {}
    // Use Core API URL for accounts endpoints
    const baseUrl = FDX_CORE_API_URL.endsWith('/') ? FDX_CORE_API_URL.slice(0, -1) : FDX_CORE_API_URL
    const accountsUrl = `${baseUrl}/accounts`
    return this.makeRequest('GET', accountsUrl, accessToken, { params })
  }

  /**
   * Get account details
   * @param {string} accessToken - DPoP-bound access token
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Account response
   */
  static async getAccount(accessToken, accountId) {
    // Use Core API URL for accounts endpoints
    // Remove any trailing slash to avoid double slashes
    const baseUrl = FDX_CORE_API_URL.endsWith('/') ? FDX_CORE_API_URL.slice(0, -1) : FDX_CORE_API_URL
    // Ensure accountId doesn't start with / to avoid double slashes
    const cleanAccountId = accountId.startsWith('/') ? accountId.slice(1) : accountId
    const accountUrl = `${baseUrl}/accounts/${cleanAccountId}`
    console.log(`🔧 getAccount URL construction: baseUrl=${baseUrl}, accountId=${cleanAccountId}, finalUrl=${accountUrl}`)
    return this.makeRequest('GET', accountUrl, accessToken)
  }

  /**
   * Get account transactions
   * @param {string} accessToken - DPoP-bound access token
   * @param {string} accountId - Account ID
   * @param {Object} options - Query options (startTime, endTime, etc.)
   * @returns {Promise<Object>} Transactions response
   */
  static async getAccountTransactions(accessToken, accountId, options = {}) {
    const params = {
      ...options
    }
    // Use Core API URL for accounts endpoints
    const baseUrl = FDX_CORE_API_URL.endsWith('/') ? FDX_CORE_API_URL.slice(0, -1) : FDX_CORE_API_URL
    const transactionsUrl = `${baseUrl}/accounts/${accountId}/transactions`
    return this.makeRequest('GET', transactionsUrl, accessToken, { params })
  }
}

