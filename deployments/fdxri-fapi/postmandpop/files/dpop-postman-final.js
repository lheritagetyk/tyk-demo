/**
 * DPoP Proof Generator for Postman - Final Production Version
 * 
 * This pre-request script automatically adds DPoP headers to your requests.
 * 
 * Setup (Quick Start):
 * 1. Run: npm install && npm run generate-keys && npm start
 * 2. In Postman Environment, set:
 *    - dpop_mode = external
 *    - dpop_signing_service_url = http://localhost:3000/generate-dpop
 * 3. Add this script to your collection's Pre-request Scripts
 * 
 * Environment Variables:
 * - dpop_mode: "external" (recommended), "pregenerated", or "simple" (test only)
 * - dpop_signing_service_url: URL of signing service (default: http://localhost:3000/generate-dpop)
 * - dpop_public_key_jwk: Your public key JWK (JSON string) - optional with external mode
 * - dpop_proof: Pre-generated proof (only for pregenerated mode)
 * - access_token: Your OAuth access token (auto-included in ath claim for API calls)
 */

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const DPoPUtils = {
    /**
     * Base64URL encode (no padding)
     */
    base64urlEncode: function(input) {
        const str = typeof input === 'string' ? input : JSON.stringify(input);
        const base64 = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(str));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    },
    
    /**
     * Calculate SHA-256 hash and return base64url encoded
     */
    sha256Base64url: function(input) {
        const hash = CryptoJS.SHA256(input);
        const base64 = hash.toString(CryptoJS.enc.Base64);
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    },
    
    /**
     * Check if URL is a token endpoint
     */
    isTokenEndpoint: function(url) {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes('/token') || lowerUrl.includes('/oauth') || lowerUrl.includes('/par');
    },
    
    /**
     * Clean URL to get htu (no query params or fragments)
     */
    cleanUrl: function(url) {
        return url.split('?')[0].split('#')[0];
    }
};

// ============================================================================
// MODE 1: EXTERNAL SIGNING SERVICE (RECOMMENDED)
// ============================================================================

function useExternalSigningService() {
    const signingServiceUrl = pm.environment.get("dpop_signing_service_url") || "http://localhost:3000/generate-dpop";
    const accessToken = pm.environment.get("access_token");
    const method = pm.request.method;
    const url = pm.request.url.toString();
    
    console.log(`📡 Calling signing service: ${signingServiceUrl}`);
    console.log(`   Method: ${method}`);
    console.log(`   URL: ${url}`);
    
    // Determine if we need to include access token hash
    const includeToken = !DPoPUtils.isTokenEndpoint(url) && accessToken;
    
    if (includeToken) {
        console.log(`   Including access token hash (ath)`);
    }
    
    // Build request to signing service
    const requestPayload = {
        method: method,
        url: url
    };
    
    if (includeToken) {
        requestPayload.access_token = accessToken;
    }
    
    // Call signing service synchronously using pm.sendRequest
    pm.sendRequest({
        url: signingServiceUrl,
        method: 'POST',
        header: {
            'Content-Type': 'application/json'
        },
        body: {
            mode: 'raw',
            raw: JSON.stringify(requestPayload)
        }
    }, function(err, response) {
        if (err) {
            console.error("❌ Error calling signing service:", err.message);
            console.error("   Make sure the service is running: npm start");
            throw err;
        }
        
        if (response.code !== 200) {
            console.error("❌ Signing service returned error:", response.code);
            console.error("   Response:", response.text());
            throw new Error(`Signing service error: ${response.code}`);
        }
        
        const responseBody = response.json();
        const dpopProof = responseBody.dpop_proof;
        
        if (!dpopProof) {
            console.error("❌ No DPoP proof in response");
            console.error("   Response:", JSON.stringify(responseBody, null, 2));
            throw new Error("Invalid response from signing service");
        }
        
        // Add DPoP header to request
        pm.request.headers.add({
            key: 'DPoP',
            value: dpopProof
        });
        
        console.log("✅ DPoP proof added to request");
        console.log(`   JTI: ${responseBody.payload?.jti}`);
        console.log(`   Proof length: ${dpopProof.length} chars`);
        
        // Store for debugging
        pm.environment.set("last_dpop_proof", dpopProof);
        pm.environment.set("last_dpop_jti", responseBody.payload?.jti);
        pm.environment.set("last_dpop_timestamp", new Date().toISOString());
    });
}

// ============================================================================
// MODE 2: PRE-GENERATED PROOF
// ============================================================================

function usePreGeneratedProof() {
    const dpopProof = pm.environment.get("dpop_proof");
    
    if (!dpopProof) {
        console.error("❌ dpop_proof not set in environment");
        console.error("   Generate one using: node dpop-crypto-helper.js sign-dpop --method=GET --url=<url>");
        throw new Error("Missing dpop_proof environment variable");
    }
    
    pm.request.headers.add({
        key: 'DPoP',
        value: dpopProof
    });
    
    console.log("✅ Using pre-generated DPoP proof");
    console.log(`   Proof length: ${dpopProof.length} chars`);
    console.log("");
    console.log("⚠️  REMEMBER:");
    console.log("   • DPoP proofs are single-use only");
    console.log("   • Generate a NEW proof for each request");
    console.log("   • Proof must match exact HTTP method + URL");
    console.log("   • Include access token for API calls (--token parameter)");
}

// ============================================================================
// MODE 3: SIMPLE HMAC (TESTING ONLY - NOT SECURE!)
// ============================================================================

function useSimpleHMAC() {
    console.log("");
    console.log("⚠️  ============================================");
    console.log("⚠️  WARNING: TESTING MODE - NOT SECURE!");
    console.log("⚠️  This uses HMAC, not real ES256 signing!");
    console.log("⚠️  Use external mode for production!");
    console.log("⚠️  ============================================");
    console.log("");
    
    const publicKeyJWK = JSON.parse(pm.environment.get("dpop_public_key_jwk") || "{}");
    const accessToken = pm.environment.get("access_token");
    const testSigningKey = pm.environment.get("dpop_test_signing_key") || "test-key-do-not-use-in-prod";
    const method = pm.request.method;
    const url = pm.request.url.toString();
    
    if (!publicKeyJWK.kty) {
        throw new Error("dpop_public_key_jwk not set in environment");
    }
    
    // Build header
    const header = {
        typ: "dpop+jwt",
        alg: publicKeyJWK.kty === 'EC' ? 'ES256' : 'RS256',
        jwk: {
            kty: publicKeyJWK.kty,
            ...(publicKeyJWK.crv && { crv: publicKeyJWK.crv }),
            ...(publicKeyJWK.x && { x: publicKeyJWK.x }),
            ...(publicKeyJWK.y && { y: publicKeyJWK.y })
        }
    };
    
    // Build payload
    const payload = {
        jti: pm.variables.replaceIn('{{$guid}}'),
        htm: method.toUpperCase(),
        htu: DPoPUtils.cleanUrl(url),
        iat: Math.floor(Date.now() / 1000)
    };
    
    // Add access token hash for API calls (not token endpoint)
    if (accessToken && !DPoPUtils.isTokenEndpoint(url)) {
        payload.ath = DPoPUtils.sha256Base64url(accessToken);
        console.log("   Including access token hash (ath)");
    }
    
    // Create JWT using HMAC (NOT proper ES256!)
    const headerB64 = DPoPUtils.base64urlEncode(header);
    const payloadB64 = DPoPUtils.base64urlEncode(payload);
    const signingInput = headerB64 + '.' + payloadB64;
    
    const signature = CryptoJS.HmacSHA256(signingInput, testSigningKey);
    const signatureB64 = signature.toString(CryptoJS.enc.Base64)
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    const dpopProof = signingInput + '.' + signatureB64;
    
    pm.request.headers.add({
        key: 'DPoP',
        value: dpopProof
    });
    
    console.log("✅ Test DPoP proof generated (HMAC-based)");
    console.log("   JTI:", payload.jti);
    console.log("   Method:", payload.htm);
    console.log("   URL:", payload.htu);
    if (payload.ath) {
        console.log("   ATH:", payload.ath.substring(0, 20) + "...");
    }
    
    // Store for debugging
    pm.environment.set("last_dpop_proof", dpopProof);
    pm.environment.set("last_dpop_payload", JSON.stringify(payload, null, 2));
    pm.environment.set("last_dpop_header", JSON.stringify(header, null, 2));
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

try {
    const mode = pm.environment.get("dpop_mode") || "external";
    
    console.log("");
    console.log("=================================================");
    console.log("    DPoP Proof Generator");
    console.log("=================================================");
    console.log("Mode:", mode);
    console.log("Request:", pm.request.method, pm.request.url.toString());
    console.log("");
    
    // Execute based on mode
    switch(mode.toLowerCase()) {
        case "external":
            useExternalSigningService();
            break;
            
        case "pregenerated":
            usePreGeneratedProof();
            break;
            
        case "simple":
            useSimpleHMAC();
            break;
            
        default:
            throw new Error(`Unknown dpop_mode: ${mode}. Use 'external', 'pregenerated', or 'simple'`);
    }
    
    console.log("=================================================");
    console.log("");
    
} catch (error) {
    console.error("");
    console.error("=================================================");
    console.error("❌ ERROR GENERATING DPOP PROOF");
    console.error("=================================================");
    console.error("Error:", error.message);
    console.error("");
    console.error("Troubleshooting:");
    console.error("• Make sure signing service is running: npm start");
    console.error("• Check dpop_mode is set correctly");
    console.error("• Verify environment variables are set");
    console.error("• Check Postman Console for detailed logs");
    console.error("=================================================");
    console.error("");
    
    // Don't fail the request completely - let it proceed without DPoP
    // This allows you to see the server's error message
    console.warn("⚠️  Proceeding WITHOUT DPoP header (will likely fail)");
}
