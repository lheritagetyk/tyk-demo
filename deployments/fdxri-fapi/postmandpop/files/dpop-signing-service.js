/**
 * DPoP Signing Service
 * 
 * A simple HTTP service that signs DPoP proofs for Postman
 * This allows you to use proper ES256 signing without crypto limitations
 * 
 * Installation:
 * npm install express jose cors body-parser
 * 
 * Usage:
 * node dpop-signing-service.js
 * 
 * Then set in Postman environment:
 * dpop_signing_service_url = http://localhost:3000/sign-dpop
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { SignJWT, importJWK } = require('jose');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Load keys from file
const KEYS_FILE = './dpop-keys.json';

let keys = null;
function loadKeys() {
    if (!fs.existsSync(KEYS_FILE)) {
        console.error('❌ Keys file not found. Run: node dpop-crypto-helper.js generate-keys');
        process.exit(1);
    }
    keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
    console.log('✓ Keys loaded from', KEYS_FILE);
}

/**
 * Sign a DPoP proof
 * POST /sign-dpop
 * 
 * Request body:
 * {
 *   "header": { "typ": "dpop+jwt", "alg": "ES256", "jwk": {...} },
 *   "payload": { "jti": "...", "htm": "GET", "htu": "...", "iat": 123456 }
 * }
 * 
 * Response:
 * {
 *   "dpop_proof": "eyJhbGciOiJFUzI1NiIsInR5cCI6ImRwb3Arand0IiwiandrIjp7Imt0eSI6Ik..."
 * }
 */
app.post('/sign-dpop', async (req, res) => {
    try {
        const { header, payload } = req.body;
        
        if (!header || !payload) {
            return res.status(400).json({
                error: 'Missing required fields: header and payload'
            });
        }
        
        console.log('\n📝 Signing DPoP proof...');
        console.log('Method:', payload.htm);
        console.log('URL:', payload.htu);
        console.log('JTI:', payload.jti);
        
        // Import private key
        const privateKey = await importJWK(keys.privateJWK, 'ES256');
        
        // Sign the JWT
        const dpopProof = await new SignJWT(payload)
            .setProtectedHeader(header)
            .sign(privateKey);
        
        console.log('✓ DPoP proof signed successfully');
        console.log('Proof length:', dpopProof.length, 'characters\n');
        
        res.json({
            dpop_proof: dpopProof,
            signed_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error signing DPoP proof:', error.message);
        res.status(500).json({
            error: 'Failed to sign DPoP proof',
            message: error.message
        });
    }
});

/**
 * Generate a complete DPoP proof
 * POST /generate-dpop
 * 
 * Request body:
 * {
 *   "method": "GET",
 *   "url": "https://api.bank.com/accounts",
 *   "access_token": "eyJhbG..." (optional)
 * }
 */
app.post('/generate-dpop', async (req, res) => {
    try {
        const { method, url, access_token, nonce } = req.body;
        
        if (!method || !url) {
            return res.status(400).json({
                error: 'Missing required fields: method and url'
            });
        }
        
        console.log('\n🔧 Generating complete DPoP proof...');
        console.log('Method:', method);
        console.log('URL:', url);
        
        // Parse URL to get htu
        const htu = url.split('?')[0].split('#')[0];
        
        // Generate unique jti
        const crypto = require('crypto');
        const jti = crypto.randomUUID();
        
        // Build payload
        const payload = {
            jti,
            htm: method.toUpperCase(),
            htu,
            iat: Math.floor(Date.now() / 1000)
        };
        
        // Add nonce if provided
        if (nonce) {
            payload.nonce = nonce;
        }
        
        // Add access token hash if provided
        if (access_token) {
            const hash = crypto.createHash('sha256').update(access_token).digest();
            payload.ath = hash.toString('base64url');
            console.log('Including access token hash');
        }
        
        // Build header
        const header = {
            typ: 'dpop+jwt',
            alg: 'ES256',
            jwk: keys.publicJWK
        };
        
        // Import private key and sign
        const privateKey = await importJWK(keys.privateJWK, 'ES256');
        const dpopProof = await new SignJWT(payload)
            .setProtectedHeader(header)
            .sign(privateKey);
        
        console.log('✓ Complete DPoP proof generated');
        console.log('JTI:', jti);
        console.log('Proof length:', dpopProof.length, 'characters\n');
        
        res.json({
            dpop_proof: dpopProof,
            header,
            payload,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error generating DPoP proof:', error.message);
        res.status(500).json({
            error: 'Failed to generate DPoP proof',
            message: error.message
        });
    }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'DPoP Signing Service',
        keys_loaded: keys !== null,
        timestamp: new Date().toISOString()
    });
});

/**
 * Get public key
 */
app.get('/public-key', (req, res) => {
    res.json({
        publicJWK: keys.publicJWK,
        thumbprint: keys.thumbprint
    });
});

// Start server
loadKeys();

app.listen(PORT, () => {
    console.log('\n🚀 DPoP Signing Service running!');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log('\n📋 Endpoints:');
    console.log(`   POST http://localhost:${PORT}/sign-dpop       - Sign a DPoP proof`);
    console.log(`   POST http://localhost:${PORT}/generate-dpop   - Generate complete DPoP proof`);
    console.log(`   GET  http://localhost:${PORT}/public-key      - Get public key`);
    console.log(`   GET  http://localhost:${PORT}/health          - Health check`);
    console.log('\n💡 Usage in Postman:');
    console.log('   1. Set environment variable:');
    console.log(`      dpop_signing_service_url = http://localhost:${PORT}/generate-dpop`);
    console.log('   2. Set dpop_mode = external');
    console.log('   3. Use the pre-request script');
    console.log('\n✓ Ready to sign DPoP proofs!\n');
});
