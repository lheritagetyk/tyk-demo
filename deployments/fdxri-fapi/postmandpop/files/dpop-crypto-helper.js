/**
 * DPoP Key Generator and Signer
 * 
 * This Node.js script generates ES256 key pairs and signs DPoP proofs
 * Run this outside Postman to generate keys and proofs with proper crypto
 * 
 * Installation:
 * npm install jose
 * 
 * Usage:
 * node dpop-crypto-helper.js generate-keys
 * node dpop-crypto-helper.js sign-dpop --method GET --url https://api.bank.com/accounts
 */

const { generateKeyPair, SignJWT, importJWK, exportJWK, calculateJwkThumbprint } = require('jose');
const fs = require('fs');
const crypto = require('crypto');

// File to store keys
const KEYS_FILE = './dpop-keys.json';

/**
 * Generate ES256 key pair for DPoP
 */
async function generateKeys() {
    console.log('Generating ES256 key pair for DPoP...\n');
    
    // Generate key pair - jose returns JWK format directly
    const { publicKey, privateKey } = await generateKeyPair('ES256', {
        extractable: true,
    });
    
    // Export keys to JWK format using jose's exportJWK
    const publicJWK = await exportJWK(publicKey);
    const privateJWK = await exportJWK(privateKey);
    
    // Calculate JWK thumbprint
    const thumbprint = await calculateJwkThumbprint(publicJWK);
    
    // Save keys to file
    const keys = {
        publicJWK,
        privateJWK,
        thumbprint,
        created: new Date().toISOString()
    };
    
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
    
    console.log('✓ Keys generated successfully!\n');
    console.log('Public Key JWK:');
    console.log(JSON.stringify(publicJWK, null, 2));
    console.log('\nPrivate Key JWK:');
    console.log(JSON.stringify(privateJWK, null, 2));
    console.log('\nJWK Thumbprint:', thumbprint);
    console.log('\n✓ Keys saved to:', KEYS_FILE);
    console.log('\n📋 Copy these to your Postman environment variables:');
    console.log('   dpop_public_key_jwk  =', JSON.stringify(publicJWK));
    console.log('   dpop_private_key_jwk =', JSON.stringify(privateJWK));
    
    return keys;
}

/**
 * Sign a DPoP proof
 */
async function signDPoPProof(options) {
    const {
        method,
        url,
        accessToken = null,
        nonce = null
    } = options;
    
    // Load keys
    if (!fs.existsSync(KEYS_FILE)) {
        throw new Error('Keys not found. Run: node dpop-crypto-helper.js generate-keys');
    }
    
    const keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
    
    // Import private key
    const privateKey = await importJWK(keys.privateJWK, 'ES256');
    
    // Parse URL to get htu (without query params or fragment)
    const htu = url.split('?')[0].split('#')[0];
    
    // Generate unique jti
    const jti = crypto.randomUUID();
    
    // Build DPoP proof payload
    const payload = {
        jti,
        htm: method.toUpperCase(),
        htu,
        iat: Math.floor(Date.now() / 1000)
    };
    
    // Add nonce if provided (for replay protection)
    if (nonce) {
        payload.nonce = nonce;
    }
    
    // Add access token hash if provided
    if (accessToken) {
        const hash = crypto.createHash('sha256').update(accessToken).digest();
        payload.ath = hash.toString('base64url');
    }
    
    // Create and sign JWT
    const dpopProof = await new SignJWT(payload)
        .setProtectedHeader({
            typ: 'dpop+jwt',
            alg: 'ES256',
            jwk: keys.publicJWK
        })
        .sign(privateKey);
    
    console.log('✓ DPoP Proof Generated:\n');
    console.log('Header:');
    console.log(JSON.stringify({
        typ: 'dpop+jwt',
        alg: 'ES256',
        jwk: keys.publicJWK
    }, null, 2));
    console.log('\nPayload:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('\nDPoP Proof JWT:');
    console.log(dpopProof);
    console.log('\n📋 Add this to your request header:');
    console.log(`   DPoP: ${dpopProof}`);
    
    return dpopProof;
}

/**
 * Generate a DPoP-bound token request
 */
async function generateTokenRequest(tokenEndpoint) {
    console.log('Generating DPoP proof for token request...\n');
    
    const dpopProof = await signDPoPProof({
        method: 'POST',
        url: tokenEndpoint
    });
    
    console.log('\n📋 Token Request Headers:');
    console.log('   Content-Type: application/x-www-form-urlencoded');
    console.log(`   DPoP: ${dpopProof}`);
    console.log('\n📋 Token Request Body (example):');
    console.log('   grant_type=authorization_code');
    console.log('   code=<authorization_code>');
    console.log('   redirect_uri=<redirect_uri>');
    console.log('   code_verifier=<pkce_verifier>');
    
    return dpopProof;
}

/**
 * Generate a DPoP-bound API request
 */
async function generateApiRequest(apiUrl, accessToken) {
    console.log('Generating DPoP proof for API request...\n');
    
    const dpopProof = await signDPoPProof({
        method: 'GET',
        url: apiUrl,
        accessToken
    });
    
    console.log('\n📋 API Request Headers:');
    console.log(`   Authorization: DPoP ${accessToken}`);
    console.log(`   DPoP: ${dpopProof}`);
    
    return dpopProof;
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

(async () => {
    try {
        switch (command) {
            case 'generate-keys':
                await generateKeys();
                break;
                
            case 'sign-dpop':
                const method = args.find(a => a.startsWith('--method='))?.split('=')[1] || 'GET';
                const url = args.find(a => a.startsWith('--url='))?.split('=')[1];
                const accessToken = args.find(a => a.startsWith('--token='))?.split('=')[1];
                
                if (!url) {
                    throw new Error('URL required. Usage: --url=https://api.example.com/resource');
                }
                
                await signDPoPProof({ method, url, accessToken });
                break;
                
            case 'token-request':
                const tokenEndpoint = args[1];
                if (!tokenEndpoint) {
                    throw new Error('Token endpoint required. Usage: token-request https://auth.example.com/token');
                }
                await generateTokenRequest(tokenEndpoint);
                break;
                
            case 'api-request':
                const apiUrl = args.find(a => a.startsWith('--url='))?.split('=')[1];
                const token = args.find(a => a.startsWith('--token='))?.split('=')[1];
                
                if (!apiUrl || !token) {
                    throw new Error('URL and token required. Usage: --url=https://api.example.com --token=<access_token>');
                }
                
                await generateApiRequest(apiUrl, token);
                break;
                
            default:
                console.log('DPoP Crypto Helper\n');
                console.log('Commands:');
                console.log('  generate-keys                          Generate ES256 key pair');
                console.log('  sign-dpop --method=GET --url=<url>     Sign a DPoP proof');
                console.log('  token-request <token_endpoint>         Generate token request');
                console.log('  api-request --url=<url> --token=<tok>  Generate API request');
                console.log('\nExamples:');
                console.log('  node dpop-crypto-helper.js generate-keys');
                console.log('  node dpop-crypto-helper.js sign-dpop --method=POST --url=https://auth.bank.com/token');
                console.log('  node dpop-crypto-helper.js api-request --url=https://api.bank.com/accounts --token=eyJhbG...');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();