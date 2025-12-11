package com.fdx.consent;

import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.Authenticator;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.jboss.logging.Logger;

import jakarta.ws.rs.core.Response;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * FDX Consent Authenticator
 * 
 * This authenticator ensures users have granted fine-grained consent
 * before completing authentication. This is required for Open Banking compliance.
 * 
 * Flow:
 * 1. Check if user has active consent
 * 2. If not, redirect to consent service
 * 3. After consent is granted, validate and continue
 */
public class FdxConsentAuthenticator implements Authenticator {
    
    private static final Logger logger = Logger.getLogger(FdxConsentAuthenticator.class);
    
    @Override
    public void authenticate(AuthenticationFlowContext context) {
        try {
            // Check if user is available (required for this authenticator)
            UserModel user = context.getUser();
            if (user == null) {
                logger.warn("User is null in authenticate() - this should not happen if requiresUser() returns true");
                context.failure(AuthenticationFlowError.INTERNAL_ERROR);
                return;
            }
            
            RealmModel realm = context.getRealm();
            if (realm == null) {
                logger.error("Realm is null in authenticate()");
                context.failure(AuthenticationFlowError.INTERNAL_ERROR);
                return;
            }
            
            // Get configuration (may be null when first adding to flow)
            String consentServiceUrl = getConfigValue(context, "consent.service.url", "http://consent-service:8900");
            
            var authSession = context.getAuthenticationSession();
            String redirectUri = authSession != null ? authSession.getRedirectUri() : null;
            
            // Check if user has active consent
            boolean hasActiveConsent = checkActiveConsent(context, user);
            
            if (!hasActiveConsent) {
                // User needs to grant consent - redirect to consent service
                logger.info("User " + user.getId() + " does not have active consent, redirecting to consent service");
                
                try {
                    // Store session state for when user returns
                    if (authSession == null) {
                        logger.error("Authentication session is null");
                        context.failure(AuthenticationFlowError.INTERNAL_ERROR);
                        return;
                    }
                    
                    var parentSession = authSession.getParentSession();
                    String sessionCode = parentSession != null ? parentSession.getId() : null;
                    String userId = user.getId();
                    
                    if (sessionCode == null) {
                        logger.error("Parent session is null");
                        context.failure(AuthenticationFlowError.INTERNAL_ERROR);
                        return;
                    }
                    
                    // Store in session note for validation when user returns
                    authSession.setAuthNote("fdx.consent.required", "true");
                    authSession.setAuthNote("fdx.consent.session", sessionCode);
                    
                    // Build consent service URL
                    // Note: Consent service will use Keycloak Admin API to fetch accounts
                    // since we don't have access token yet in auth flow
                    String consentUrl = buildConsentUrl(consentServiceUrl, sessionCode, userId, redirectUri);
                    
                    // Redirect to consent service
                    Response response = Response.status(302)
                        .location(URI.create(consentUrl))
                        .build();
                    
                    context.challenge(response);
                    return;
                    
                } catch (Exception e) {
                    logger.error("Error redirecting to consent service", e);
                    context.failure(AuthenticationFlowError.INTERNAL_ERROR);
                    return;
                }
            }
            
            // User has active consent, continue with flow
            logger.info("User " + user.getId() + " has active consent, continuing authentication");
            context.success();
        } catch (Exception e) {
            logger.error("Unexpected error in authenticate()", e);
            context.failure(AuthenticationFlowError.INTERNAL_ERROR);
        }
    }
    
    @Override
    public void action(AuthenticationFlowContext context) {
        // This is called when user returns from consent service
        UserModel user = context.getUser();
        
        // Check if consent was granted
        String consentGranted = context.getHttpRequest().getDecodedFormParameters().getFirst("consent_granted");
        
        if ("true".equals(consentGranted)) {
            // Verify consent was actually created
            boolean hasActiveConsent = checkActiveConsent(context, user);
            
            if (hasActiveConsent) {
                logger.info("User " + user.getId() + " granted consent, continuing authentication");
                context.success();
            } else {
                logger.warn("User " + user.getId() + " returned from consent service but consent not found");
                context.failure(AuthenticationFlowError.INVALID_CREDENTIALS);
            }
        } else {
            // User may have cancelled or there was an error
            logger.warn("User " + user.getId() + " did not grant consent");
            context.failure(AuthenticationFlowError.INVALID_CREDENTIALS);
        }
    }
    
    @Override
    public boolean requiresUser() {
        return true; // We need the user to be authenticated first
    }
    
    @Override
    public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) {
        // This is called during flow configuration - user may be null
        // Return true to allow adding to flow even without user
        try {
            return true; // Always configured
        } catch (Exception e) {
            logger.error("Error in configuredFor", e);
            return false;
        }
    }
    
    @Override
    public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {
        // No required actions
    }
    
    @Override
    public void close() {
        // Cleanup if needed
    }
    
    /**
     * Check if user has active consent
     */
    private boolean checkActiveConsent(AuthenticationFlowContext context, UserModel user) {
        try {
            if (user == null) {
                return false;
            }
            
            // Get consent from user attributes
            // In Keycloak 24, getAttributes() returns Map<String, List<String>>
            var attributes = user.getAttributes();
            if (attributes == null) {
                return false;
            }
            
            List<String> consentsJson = attributes.get("fdx.consents");
            
            if (consentsJson == null || consentsJson.isEmpty()) {
                return false;
            }
            
            // Parse consents (simplified - in production use proper JSON parsing)
            String consents = consentsJson.get(0);
            if (consents == null || consents.equals("[]") || consents.equals("null")) {
                return false;
            }
            
            // Check for active consent
            // In production, properly parse JSON and check expiration
            return consents.contains("\"status\":\"ACTIVE\"");
            
        } catch (Exception e) {
            logger.error("Error checking consent for user " + (user != null ? user.getId() : "null"), e);
            return false;
        }
    }
    
    /**
     * Build consent service URL with parameters
     */
    private String buildConsentUrl(String consentServiceUrl, String sessionCode, String userId, String redirectUri) {
        try {
            StringBuilder url = new StringBuilder(consentServiceUrl);
            if (!consentServiceUrl.endsWith("/")) {
                url.append("/");
            }
            url.append("consent");
            url.append("?session_code=").append(URLEncoder.encode(sessionCode, StandardCharsets.UTF_8));
            url.append("&user_id=").append(URLEncoder.encode(userId, StandardCharsets.UTF_8));
            url.append("&redirect_uri=").append(URLEncoder.encode(redirectUri, StandardCharsets.UTF_8));
            return url.toString();
        } catch (Exception e) {
            logger.error("Error building consent URL", e);
            return consentServiceUrl + "/consent";
        }
    }
    
    /**
     * Get configuration value
     */
    private String getConfigValue(AuthenticationFlowContext context, String key, String defaultValue) {
        try {
            if (context.getAuthenticatorConfig() == null || context.getAuthenticatorConfig().getConfig() == null) {
                return defaultValue;
            }
            String value = context.getAuthenticatorConfig().getConfig().get(key);
            return value != null && !value.isEmpty() ? value : defaultValue;
        } catch (Exception e) {
            logger.warn("Error getting config value for " + key + ", using default", e);
            return defaultValue;
        }
    }
}

