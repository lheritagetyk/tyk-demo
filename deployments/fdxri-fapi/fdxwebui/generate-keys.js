/**
 * Generate DPoP Keys
 * 
 * Generates ES256 key pair in JWK format for DPoP signing
 * Run: node generate-keys.js
 */

import crypto from 'crypto';
import fs from 'fs';

function generateKeys() {
    console.log('Generating ES256 key pair for DPoP...\n');
    
    // Generate key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'P-256'
    });
    
    // Export public key as JWK
    const publicJWK = publicKey.export({ format: 'jwk' });
    
    // Export private key as JWK
    const privateJWK = privateKey.export({ format: 'jwk' });
    
    // Calculate thumbprint (base64url(SHA256(canonical JSON)))
    const canonicalJWK = {
        crv: publicJWK.crv,
        kty: publicJWK.kty,
        x: publicJWK.x,
        y: publicJWK.y
    };
    
    const thumbprint = crypto
        .createHash('sha256')
        .update(JSON.stringify(canonicalJWK))
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    
    const keys = {
        publicJWK: {
            kty: publicJWK.kty,
            crv: publicJWK.crv,
            x: publicJWK.x,
            y: publicJWK.y
        },
        privateJWK: {
            kty: privateJWK.kty,
            crv: privateJWK.crv,
            x: privateJWK.x,
            y: privateJWK.y,
            d: privateJWK.d
        },
        thumbprint: thumbprint,
        created: new Date().toISOString()
    };
    
    // Save to file
    fs.writeFileSync('dpop-keys.json', JSON.stringify(keys, null, 2));
    
    console.log('✓ Keys generated successfully!');
    console.log('✓ Saved to dpop-keys.json\n');
    console.log('Public Key Thumbprint:', thumbprint);
    console.log('\n⚠ Keep dpop-keys.json secure and do not commit it to version control!');
}

// Check if keys already exist
if (fs.existsSync('dpop-keys.json')) {
    console.log('⚠ dpop-keys.json already exists!');
    console.log('Delete it first if you want to generate new keys.\n');
    process.exit(1);
}

generateKeys();

