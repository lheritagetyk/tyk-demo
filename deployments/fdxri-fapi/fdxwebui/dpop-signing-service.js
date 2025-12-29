/**
 * DPoP Signing Service
 * 
 * Standalone service for signing DPoP proofs
 * Run this separately: node dpop-signing-service.js
 */

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { SignJWT, importJWK } from 'jose';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Load or generate keys
const KEYS_FILE = path.join(__dirname, 'dpop-keys.json');

let keys = null;

function loadOrGenerateKeys() {
    if (fs.existsSync(KEYS_FILE)) {
        keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
        console.log('✓ Keys loaded from', KEYS_FILE);
        
        // Validate keys structure
        if (!keys.publicJWK || !keys.privateJWK || !keys.publicJWK.kty || !keys.privateJWK.d) {
            console.error('❌ Invalid keys file format. Please regenerate using: node generate-keys.js');
            process.exit(1);
        }
    } else {
        console.error('❌ Keys file not found:', KEYS_FILE);
        console.error('Please generate keys first: node generate-keys.js');
        process.exit(1);
    }
}

/**
 * Generate a complete DPoP proof
 * POST /generate-dpop
 */
app.post('/generate-dpop', async (req, res) => {
    try {
        const { method, url, access_token, nonce } = req.body;
        
        if (!method || !url) {
            return res.status(400).json({
                error: 'Missing required fields: method and url'
            });
        }

        if (!keys || !keys.privateJWK || Object.keys(keys.privateJWK).length === 0) {
            return res.status(500).json({
                error: 'DPoP keys not properly configured. Please generate keys first.'
            });
        }
        
        console.log('\n🔧 Generating DPoP proof...');
        console.log('Method:', method);
        console.log('URL:', url);
        
        // Parse URL to get htu
        const htu = url.split('?')[0].split('#')[0];
        
        // Generate unique jti
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
        
        console.log('✓ DPoP proof generated');
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
        keys_loaded: keys !== null && keys.privateJWK && Object.keys(keys.privateJWK).length > 0,
        timestamp: new Date().toISOString()
    });
});

/**
 * Get public key
 */
app.get('/public-key', (req, res) => {
    if (!keys || !keys.publicJWK) {
        return res.status(500).json({
            error: 'Keys not loaded'
        });
    }
    
    res.json({
        publicJWK: keys.publicJWK,
        thumbprint: keys.thumbprint
    });
});

// Start server
loadOrGenerateKeys();

app.listen(PORT, () => {
    console.log('\n🚀 DPoP Signing Service running!');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log('\n📋 Endpoints:');
    console.log(`   POST http://localhost:${PORT}/generate-dpop   - Generate DPoP proof`);
    console.log(`   GET  http://localhost:${PORT}/public-key      - Get public key`);
    console.log(`   GET  http://localhost:${PORT}/health          - Health check`);
    console.log('\n💡 Make sure dpop-keys.json exists with proper JWK format');
    console.log('✓ Ready to sign DPoP proofs!\n');
});

