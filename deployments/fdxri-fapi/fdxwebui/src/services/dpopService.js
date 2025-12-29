import axios from 'axios'

// Use proxy in development to avoid CORS issues
const DPoP_SIGNING_SERVICE_URL = import.meta.env.VITE_DPOP_SERVICE_URL || (import.meta.env.DEV ? '/dpop' : 'http://localhost:3010')

/**
 * DPoP Service - Handles DPoP proof generation
 */
export class DPoPService {
  /**
   * Generate a DPoP proof for a request
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} url - Full URL of the request
   * @param {string} accessToken - Optional access token for ath claim
   * @param {string} nonce - Optional nonce from server
   * @returns {Promise<string>} DPoP proof JWT
   */
  static async generateProof(method, url, accessToken = null, nonce = null) {
    try {
      const response = await axios.post(`${DPoP_SIGNING_SERVICE_URL}/generate-dpop`, {
        method,
        url,
        access_token: accessToken,
        nonce
      })

      return response.data.dpop_proof
    } catch (error) {
      console.error('Error generating DPoP proof:', error)
      throw new Error(`Failed to generate DPoP proof: ${error.message}`)
    }
  }

  /**
   * Get public key from signing service
   * @returns {Promise<Object>} Public key JWK
   */
  static async getPublicKey() {
    try {
      const response = await axios.get(`${DPoP_SIGNING_SERVICE_URL}/public-key`)
      return response.data
    } catch (error) {
      console.error('Error getting public key:', error)
      throw new Error(`Failed to get public key: ${error.message}`)
    }
  }

  /**
   * Health check for signing service
   * @returns {Promise<boolean>} True if service is healthy
   */
  static async healthCheck() {
    try {
      const response = await axios.get(`${DPoP_SIGNING_SERVICE_URL}/health`)
      return response.data.status === 'ok'
    } catch (error) {
      return false
    }
  }
}

