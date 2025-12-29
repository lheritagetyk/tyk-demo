import React, { useState, useEffect, useCallback } from 'react'
import './OAuthFlow.css'
import { OAuthService } from '../services/oauthService'
import { DPoPService } from '../services/dpopService'
import { ApiCallLogger } from '../services/apiLogger'

function OAuthFlow({ onComplete, onStateChange, oauthState, onLoadCustomers }) {
  const [serviceStatus, setServiceStatus] = useState('checking')
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    checkServiceStatus()
  }, [])

  const checkServiceStatus = async () => {
    const isHealthy = await DPoPService.healthCheck()
    setServiceStatus(isHealthy ? 'ready' : 'error')
  }

  const resetFlow = useCallback(() => {
    setIsLoading(false)
    setCurrentStep(0)
    sessionStorage.removeItem('oauth_pkce')
    sessionStorage.removeItem('oauth_callback_code')
    ApiCallLogger.clear()
    onStateChange({ step: 'init', requestUri: null, authCode: null, token: null, error: null })
    onComplete(null)
  }, [onComplete, onStateChange])

  const handleTokenExchange = async (code) => {
    console.log('🔄 Starting token exchange with code:', code.substring(0, 20) + '...')
    setCurrentStep(4)
    setIsLoading(true)
    try {
      const storedPkce = sessionStorage.getItem('oauth_pkce')
      if (!storedPkce) {
        throw new Error('PKCE data not found. Please start the flow again.')
      }
      const pkceData = JSON.parse(storedPkce)
      
      console.log('📤 Exchanging authorization code for token...')
      const response = await OAuthService.exchangeCodeForToken(code, pkceData.codeVerifier)
      
      if (!response || !response.access_token) {
        throw new Error('Token exchange failed: No access token in response')
      }
      
      console.log('✅ Token exchange successful, access token received')
      console.log('🔑 Access token (first 20 chars):', response.access_token.substring(0, 20) + '...')
      setCurrentStep(5)
      setIsLoading(false)
      
      // Update state with token
      const newState = { ...oauthState, step: 'authenticated', token: response.access_token, authCode: code }
      onStateChange(newState)
      
      // Call onComplete with token - this will trigger loadCustomers in App.jsx
      console.log('📞 Calling onComplete with access token to trigger customer loading...')
      onComplete(response.access_token)
      console.log('✅ onComplete called successfully')
    } catch (error) {
      console.error('❌ Token exchange error:', error)
      console.error('Error details:', error.message, error.stack)
      setIsLoading(false)
      onStateChange({ ...oauthState, step: 'error', error: error.message })
    }
  }

  // Check for OAuth callback code after redirect from Keycloak
  useEffect(() => {
    const checkCallback = () => {
      console.log('🔍 Checking for OAuth callback after redirect...')
      console.log('🔍 Current URL:', window.location.href)
      console.log('🔍 Current pathname:', window.location.pathname)
      
      // First, check if we're on the callback route and extract code from URL
      const isCallbackRoute = window.location.pathname === '/callback'
      const urlParams = new URLSearchParams(window.location.search)
      const urlCode = urlParams.get('code')
      const urlError = urlParams.get('error')
      const urlState = urlParams.get('state')
      
      console.log('🔍 URL parameters:', { 
        isCallbackRoute, 
        urlCode: !!urlCode, 
        urlError: !!urlError,
        urlState: !!urlState 
      })
      
      // If we're on callback route and have code in URL, extract it directly
      if (isCallbackRoute && urlCode) {
        console.log('✅ Found code in URL on callback route, storing in sessionStorage...')
        sessionStorage.setItem('oauth_callback_code', urlCode)
        if (urlState) {
          sessionStorage.setItem('oauth_callback_state', urlState)
        }
        // Clean up URL by redirecting to home
        window.history.replaceState({}, '', '/')
      } else if (isCallbackRoute && urlError) {
        console.error('❌ Found error in URL on callback route:', urlError)
        sessionStorage.setItem('oauth_callback_error', urlError)
        window.history.replaceState({}, '', '/')
      }
      
      console.log('🔍 Full sessionStorage contents:', {
        oauth_callback_code: sessionStorage.getItem('oauth_callback_code'),
        oauth_callback_error: sessionStorage.getItem('oauth_callback_error'),
        oauth_callback_state: sessionStorage.getItem('oauth_callback_state'),
        oauth_authorizing: sessionStorage.getItem('oauth_authorizing'),
        oauth_pkce: sessionStorage.getItem('oauth_pkce') ? 'exists' : null
      })
      
      const code = sessionStorage.getItem('oauth_callback_code')
      const error = sessionStorage.getItem('oauth_callback_error')
      const isAuthorizing = sessionStorage.getItem('oauth_authorizing')

      console.log('Callback check:', { 
        hasCode: !!code, 
        hasError: !!error, 
        isAuthorizing: !!isAuthorizing,
        code: code ? code.substring(0, 20) + '...' : null,
        error: error || null
      })

      if (isAuthorizing) {
        if (error) {
          console.error('❌ OAuth callback error after redirect:', error)
          sessionStorage.removeItem('oauth_authorizing')
          sessionStorage.removeItem('oauth_callback_error')
          onStateChange({ ...oauthState, step: 'error', error })
          setIsLoading(false)
          return true // Handled
        } else if (code) {
          console.log('✅ Found OAuth callback code after redirect, starting token exchange...')
          sessionStorage.removeItem('oauth_callback_code')
          sessionStorage.removeItem('oauth_authorizing')
          // Continue with token exchange
          setCurrentStep(4)
          setIsLoading(true)
          handleTokenExchange(code)
          return true // Handled
        } else {
          console.log('⚠️ isAuthorizing is true but no code or error found yet')
        }
      } else {
        console.log('ℹ️ No active authorization flow detected')
      }
      return false // Not handled
    }

    // Check immediately
    const handled = checkCallback()
    
    // Also check after a short delay in case sessionStorage wasn't ready yet
    if (!handled) {
      const timeoutId = setTimeout(() => {
        checkCallback()
      }, 500)
      
      return () => clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount - handleTokenExchange is stable

  const handleStartFlow = async () => {
    setIsLoading(true)
    setCurrentStep(1)
    
    try {
      // Step 1: Generate PKCE
      const pkceData = await OAuthService.generatePKCE()
      sessionStorage.setItem('oauth_pkce', JSON.stringify(pkceData))
      onStateChange({ ...oauthState, step: 'pkce-generated' })

      // Step 2: Push Authorization Request
      setCurrentStep(2)
      const parResponse = await OAuthService.pushAuthorizationRequest(pkceData)
      onStateChange({ ...oauthState, step: 'par-requested', requestUri: parResponse.request_uri })

      // Step 3: Redirect to authorization - use full page redirect (more reliable than popup)
      if (parResponse.request_uri) {
        setCurrentStep(3)
        // IMPORTANT: This MUST be the direct Keycloak URL, NOT a proxy path
        const KEYCLOAK_DIRECT_URL = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180'
        const REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'fapi-demo'
        const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || 'my-tpp-public'
        const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || 'http://localhost:3030/callback'

        // Build authorization URL with request_uri
        // When using PAR, redirect_uri is already included in the PAR request (server-side)
        // The authorization URL should only include client_id and request_uri
        const authUrl = `${KEYCLOAK_DIRECT_URL}/realms/${REALM}/protocol/openid-connect/auth?` +
          `client_id=${CLIENT_ID}&` +
          `request_uri=${encodeURIComponent(parResponse.request_uri)}`

        console.log('🔐 Redirecting to Keycloak authorization (direct URL, not proxied):')
        console.log('   URL:', authUrl)
        console.log('   Redirect URI (from PAR):', REDIRECT_URI)
        
        onStateChange({ ...oauthState, step: 'authorizing' })
        
        // Store state so we can resume after redirect
        // This flag tells the component to check for callback code when it loads
        sessionStorage.setItem('oauth_authorizing', 'true')
        console.log('✅ Set oauth_authorizing flag in sessionStorage')
        
        // Redirect the entire page to Keycloak
        // After authentication, Keycloak will redirect to callback.html
        // callback.html will then redirect back to the main app with the code
        console.log('🔄 Redirecting to Keycloak...')
        window.location.href = authUrl
      }
    } catch (error) {
      console.error('OAuth flow error:', error)
      onStateChange({ ...oauthState, step: 'error', error: error.message })
      setIsLoading(false)
    }
  }

  const steps = [
    { number: 1, title: 'Generate PKCE', description: 'Generate code verifier and challenge' },
    { number: 2, title: 'PAR Request', description: 'Push authorization request to Keycloak' },
    { number: 3, title: 'Authorization', description: 'User login and consent in popup window' },
    { number: 4, title: 'Token Exchange', description: 'Exchange authorization code for access token' },
    { number: 5, title: 'Load Customer Data', description: 'Fetch customer accounts and transactions' }
  ]

  return (
    <div className="oauth-flow">
      <div className="oauth-header">
        <h2>OAuth Flow</h2>
        {(oauthState.step !== 'init' || currentStep > 0) && (
          <button onClick={resetFlow} className="btn-reset">
            Reset
          </button>
        )}
      </div>
      
      <div className="service-status">
        <span className={`status-indicator ${serviceStatus}`}></span>
        DPoP Service: {serviceStatus === 'ready' ? 'Ready' : serviceStatus === 'error' ? 'Not Available' : 'Checking...'}
      </div>

      <div className="oauth-steps-list">
        {steps.map((step, index) => (
          <div 
            key={step.number} 
            className={`step-item ${currentStep >= step.number ? 'active' : ''} ${currentStep === step.number ? 'current' : ''}`}
          >
            <div className="step-number">{step.number}</div>
            <div className="step-content">
              <div className="step-title">{step.title}</div>
              <div className="step-description">{step.description}</div>
            </div>
            {currentStep >= step.number && (
              <div className="step-check">✓</div>
            )}
          </div>
        ))}
      </div>

      <div className="oauth-flow-content">
        <button 
          onClick={handleStartFlow}
          disabled={serviceStatus !== 'ready' || isLoading}
          className="btn-start-flow"
        >
          {isLoading ? 'Processing...' : 'Start OAuth Flow'}
        </button>

        {oauthState.step === 'authenticated' && (
          <div className="success-message">
            ✅ OAuth flow completed successfully!
          </div>
        )}

        {oauthState.error && (
          <div className="error-message">
            ❌ Error: {oauthState.error}
          </div>
        )}
      </div>
    </div>
  )
}

export default OAuthFlow
