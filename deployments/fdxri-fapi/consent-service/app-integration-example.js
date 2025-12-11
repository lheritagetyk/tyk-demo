// app-integration-example.js
// Example implementation of application-level consent integration
// This shows how to integrate consent checking into your OAuth flow

/**
 * Example: OAuth Callback Handler with Consent Check
 * 
 * This should be called after the user completes OAuth authentication
 * and you've received the authorization code.
 */
async function handleOAuthCallback(authorizationCode, redirectUri) {
  try {
    // Step 1: Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(authorizationCode, redirectUri);
    
    // Step 2: Decode ID token to get user ID
    const idToken = decodeJWT(tokens.id_token);
    const userId = idToken.sub;
    const accessToken = tokens.access_token;
    
    // Step 3: Check if user has active consent
    const hasActiveConsent = await checkUserConsent(userId);
    
    if (!hasActiveConsent) {
      // Step 4: Redirect to consent service
      redirectToConsentService(accessToken, userId, redirectUri);
      return null; // Don't proceed yet
    }
    
    // Step 5: User has consent, proceed with application
    return tokens;
    
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    throw error;
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForTokens(code, redirectUri) {
  const tokenEndpoint = 'http://keycloak:8180/realms/fapi-demo/protocol/openid-connect/token';
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: 'your-client-id',
      client_secret: 'your-client-secret', // If confidential client
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Check if user has active consent
 */
async function checkUserConsent(userId) {
  const consentServiceUrl = process.env.CONSENT_SERVICE_URL || 'http://consent-service:8900';
  
  try {
    const response = await fetch(`${consentServiceUrl}/api/consents/${userId}`);
    
    if (!response.ok) {
      // If user has no consents, that's okay - they need to create one
      if (response.status === 404) {
        return false;
      }
      throw new Error(`Failed to check consent: ${response.status}`);
    }
    
    const { consents } = await response.json();
    
    // Check if there's an active, non-expired consent
    const now = new Date();
    return consents.some(consent => {
      if (consent.status !== 'ACTIVE') {
        return false;
      }
      
      // Check expiration
      if (consent.expirationTime) {
        const expiration = new Date(consent.expirationTime);
        if (expiration <= now) {
          return false;
        }
      }
      
      return true;
    });
    
  } catch (error) {
    console.error('Error checking consent:', error);
    // On error, assume no consent (safer to ask again)
    return false;
  }
}

/**
 * Redirect user to consent service
 */
function redirectToConsentService(accessToken, userId, originalRedirectUri) {
  const consentServiceUrl = process.env.CONSENT_SERVICE_URL || 'http://consent-service:8900';
  
  const consentUrl = new URL(`${consentServiceUrl}/consent`);
  consentUrl.searchParams.set('access_token', accessToken);
  consentUrl.searchParams.set('user_id', userId);
  consentUrl.searchParams.set('redirect_uri', originalRedirectUri);
  
  // In browser environment
  if (typeof window !== 'undefined') {
    window.location.href = consentUrl.toString();
  }
  
  // In server environment (Express example)
  // res.redirect(consentUrl.toString());
}

/**
 * Handle return from consent service
 * 
 * This should be called when user returns from consent service
 * after granting consent.
 */
async function handleConsentCallback(accessToken, userId, originalRedirectUri) {
  // Verify consent was created
  const hasConsent = await checkUserConsent(userId);
  
  if (!hasConsent) {
    throw new Error('Consent was not created successfully');
  }
  
  // Continue with normal application flow
  // You might want to exchange the access token again to get a fresh one
  // with the consent ID claim included
  
  return {
    accessToken,
    userId,
    consentGranted: true,
  };
}

/**
 * Express.js Route Example
 */
function setupOAuthRoutes(app) {
  // OAuth callback route
  app.get('/oauth/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      const redirectUri = `${req.protocol}://${req.get('host')}/oauth/callback`;
      
      // Exchange code for tokens
      const tokens = await handleOAuthCallback(code, redirectUri);
      
      if (!tokens) {
        // User was redirected to consent service
        // They'll come back to this route after granting consent
        return;
      }
      
      // User has consent, proceed
      // Store tokens in session
      req.session.tokens = tokens;
      req.session.userId = decodeJWT(tokens.id_token).sub;
      
      // Redirect to application
      res.redirect('/dashboard');
      
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).send('Authentication failed');
    }
  });
  
  // Consent callback route (when user returns from consent service)
  app.get('/oauth/consent-callback', async (req, res) => {
    try {
      const { access_token, user_id, consent_granted } = req.query;
      
      if (consent_granted !== 'true') {
        return res.status(400).send('Consent was not granted');
      }
      
      // Verify and handle consent
      const result = await handleConsentCallback(access_token, user_id, req.query.redirect_uri);
      
      // Store tokens in session
      req.session.tokens = { access_token };
      req.session.userId = user_id;
      req.session.consentGranted = true;
      
      // Redirect to application
      res.redirect('/dashboard');
      
    } catch (error) {
      console.error('Consent callback error:', error);
      res.status(500).send('Consent processing failed');
    }
  });
  
  // Protected route example
  app.get('/api/accounts', async (req, res) => {
    // Check if user has consent
    const hasConsent = await checkUserConsent(req.session.userId);
    
    if (!hasConsent) {
      return res.status(403).json({ 
        error: 'Consent required',
        consentUrl: `/oauth/request-consent?user_id=${req.session.userId}`
      });
    }
    
    // User has consent, proceed with API call
    // ...
  });
}

/**
 * Helper: Decode JWT (simple version, use a proper JWT library in production)
 */
function decodeJWT(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  
  return JSON.parse(jsonPayload);
}

// Export for use in your application
export {
  handleOAuthCallback,
  checkUserConsent,
  redirectToConsentService,
  handleConsentCallback,
  setupOAuthRoutes,
};



