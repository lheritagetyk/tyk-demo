import axios from 'axios'
import { DPoPService } from './dpopService'
import { ApiCallLogger } from './apiLogger'

// Use proxy in development to avoid CORS issues
// Note: KEYCLOAK_URL is now determined per-request to use proxy in dev
const REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'fapi-demo'
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || 'my-tpp-public'
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || 'http://localhost:3030/callback'

// Log configuration on module load for debugging
console.log('🔧 OAuth Configuration:', {
  REALM,
  CLIENT_ID,
  REDIRECT_URI,
  VITE_CLIENT_ID_ENV: import.meta.env.VITE_CLIENT_ID,
  VITE_REDIRECT_URI_ENV: import.meta.env.VITE_REDIRECT_URI,
  VITE_KEYCLOAK_REALM_ENV: import.meta.env.VITE_KEYCLOAK_REALM
})

/**
 * OAuth Service - Handles PAR and OAuth flow
 */
export class OAuthService {
  /**
   * Generate PKCE parameters
   * @returns {Promise<Object>} PKCE verifier and challenge
   */
  static async generatePKCE() {
    const codeVerifier = this.generateCodeVerifier()
    const codeChallenge = await this.generateCodeChallenge(codeVerifier)
    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256'
    }
  }

  /**
   * Generate code verifier
   * @returns {string} Code verifier
   */
  static generateCodeVerifier() {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  /**
   * Generate code challenge from verifier
   * @param {string} verifier - Code verifier
   * @returns {Promise<string>} Code challenge
   */
  static async generateCodeChallenge(verifier) {
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  /**
   * Push Authorization Request (PAR)
   * @param {Object} pkce - PKCE parameters
   * @param {string} scope - OAuth scope
   * @returns {Promise<Object>} PAR response with request_uri
   */
  static async pushAuthorizationRequest(pkce, scope = 'openid fdx:account.basic:read') {
    const startTime = Date.now()
    // Use proxy URL in development to avoid CORS
    // In Vite, import.meta.env.MODE === 'development' for dev mode
    const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV
    // Force proxy in dev mode to avoid CORS, even if VITE_KEYCLOAK_URL is set
    const keycloakUrl = isDev ? '/keycloak' : (import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180')
    // For proxy URLs, use full URL with current origin
    const parUrlPath = `${keycloakUrl}/realms/${REALM}/protocol/openid-connect/ext/par/request`
    const parUrl = parUrlPath.startsWith('/') 
      ? `${window.location.origin}${parUrlPath}` 
      : parUrlPath
    
    // For DPoP proof, use the path that Keycloak will see after proxy rewrite
    // The proxy rewrites /keycloak to nothing, so Keycloak sees /realms/...
    // DPoP htu claim should be the full URL that Keycloak sees
    const keycloakDirectUrl = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180'
    const dpopUrl = `${keycloakDirectUrl}/realms/${REALM}/protocol/openid-connect/ext/par/request`
    
    console.log('PAR URL (request):', parUrl, 'DPoP URL (proof):', dpopUrl)

    // Generate DPoP proof for the actual Keycloak URL (what Keycloak will validate)
    let dpopProof = null
    try {
      dpopProof = await DPoPService.generateProof('POST', dpopUrl)
    } catch (error) {
      ApiCallLogger.log({
        method: 'POST',
        url: parUrl,
        status: 'error',
        error: `Failed to generate DPoP proof: ${error.message}`,
        duration: Date.now() - startTime
      })
      throw error
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: pkce.codeChallengeMethod,
      state: crypto.randomUUID(),
      nonce: crypto.randomUUID()
    })

    // Log PAR request parameters for debugging
    console.log('📤 PAR Request Parameters:', {
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      realm: REALM,
      scope: scope,
      has_code_challenge: !!pkce.codeChallenge,
      code_challenge_method: pkce.codeChallengeMethod
    })

    // Log request
    ApiCallLogger.log({
      method: 'POST',
      url: parUrl,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'DPoP': '[REDACTED]'
      },
      body: Object.fromEntries(params),
      status: 'pending',
      dpopProof: dpopProof.substring(0, 50) + '...'
    })

    // Log the exact request body and headers being sent
    const requestBody = params.toString()
    const requestHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'DPoP': dpopProof
    }
    
    // Verify no client_secret is being sent
    if (requestBody.includes('client_secret')) {
      console.error('❌ ERROR: client_secret found in PAR request body! This should not be present for public clients.')
      throw new Error('client_secret should not be included in PAR request for public clients')
    }
    
    // Verify no Authorization header
    if (requestHeaders.Authorization || requestHeaders.authorization) {
      console.error('❌ ERROR: Authorization header found! This should not be present for public clients.')
      throw new Error('Authorization header should not be included in PAR request for public clients')
    }
    
    console.log('📤 PAR Request Details:', {
      url: parUrl,
      method: 'POST',
      headers: {
        'Content-Type': requestHeaders['Content-Type'],
        'DPoP': dpopProof.substring(0, 50) + '...' // Truncate for logging
      },
      body: requestBody,
      bodyParams: Object.fromEntries(params),
      verified: {
        noClientSecret: !requestBody.includes('client_secret'),
        noAuthHeader: !requestHeaders.Authorization && !requestHeaders.authorization
      }
    })
    
    try {
      const response = await axios.post(parUrl, requestBody, {
        headers: requestHeaders,
        // Explicitly ensure no auth is sent
        auth: undefined,
        // Ensure axios doesn't add any default auth
        withCredentials: false
      })

      const duration = Date.now() - startTime

      // Log response
      ApiCallLogger.log({
        method: 'POST',
        url: parUrl,
        status: 'success',
        statusCode: response.status,
        response: response.data,
        duration
      })

      return response.data
    } catch (error) {
      const duration = Date.now() - startTime

      // Log error with full response details
      const errorResponse = error.response?.data || null
      console.error('❌ PAR Request Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: errorResponse,
        headers: error.response?.headers
      })
      
      // Log detailed error message for debugging
      if (errorResponse) {
        console.error('📋 Keycloak Error Details:', JSON.stringify(errorResponse, null, 2))
        if (errorResponse.error) {
          console.error(`🔍 Error: ${errorResponse.error}`)
          if (errorResponse.error_description) {
            console.error(`📝 Description: ${errorResponse.error_description}`)
          }
        }
      }
      
      // Log request parameters for debugging
      console.error('📤 PAR Request Parameters:', {
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        realm: REALM,
        scope: scope
      })

      ApiCallLogger.log({
        method: 'POST',
        url: parUrl,
        status: 'error',
        statusCode: error.response?.status || null,
        error: error.message,
        response: errorResponse,
        duration
      })

      throw error
    }
  }

  /**
   * Exchange authorization code for token
   * @param {string} code - Authorization code
   * @param {string} codeVerifier - PKCE code verifier
   * @returns {Promise<Object>} Token response
   */
  static async exchangeCodeForToken(code, codeVerifier) {
    const startTime = Date.now()
    // Use proxy URL in development to avoid CORS
    // In Vite, import.meta.env.MODE === 'development' for dev mode
    const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV
    // Force proxy in dev mode to avoid CORS, even if VITE_KEYCLOAK_URL is set
    const keycloakUrl = isDev ? '/keycloak' : (import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180')
    // For proxy URLs, use full URL with current origin
    const tokenUrlPath = `${keycloakUrl}/realms/${REALM}/protocol/openid-connect/token`
    const tokenUrl = tokenUrlPath.startsWith('/') 
      ? `${window.location.origin}${tokenUrlPath}` 
      : tokenUrlPath

    // For DPoP proof, use the actual Keycloak URL (after proxy rewrite)
    const keycloakDirectUrl = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180'
    const dpopUrl = `${keycloakDirectUrl}/realms/${REALM}/protocol/openid-connect/token`

    // Generate DPoP proof for the actual Keycloak URL (what Keycloak will validate)
    let dpopProof = null
    try {
      dpopProof = await DPoPService.generateProof('POST', dpopUrl)
    } catch (error) {
      ApiCallLogger.log({
        method: 'POST',
        url: tokenUrl,
        status: 'error',
        error: `Failed to generate DPoP proof: ${error.message}`,
        duration: Date.now() - startTime
      })
      throw error
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier
    })

    // Log request
    ApiCallLogger.log({
      method: 'POST',
      url: tokenUrl,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'DPoP': '[REDACTED]'
      },
      body: { grant_type: 'authorization_code', code: '[REDACTED]', redirect_uri: REDIRECT_URI, client_id: CLIENT_ID },
      status: 'pending',
      dpopProof: dpopProof.substring(0, 50) + '...'
    })

    try {
      const response = await axios.post(tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'DPoP': dpopProof
        }
      })

      const duration = Date.now() - startTime

      // Log response
      ApiCallLogger.log({
        method: 'POST',
        url: tokenUrl,
        status: 'success',
        statusCode: response.status,
        response: { ...response.data, access_token: '[REDACTED]' },
        duration
      })

      return response.data
    } catch (error) {
      const duration = Date.now() - startTime

      // Log error
      ApiCallLogger.log({
        method: 'POST',
        url: tokenUrl,
        status: 'error',
        statusCode: error.response?.status || null,
        error: error.message,
        response: error.response?.data || null,
        duration
      })

      throw error
    }
  }
}

