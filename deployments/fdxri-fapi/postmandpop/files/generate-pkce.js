/**
 * PKCE Code Challenge Generator
 * 
 * Generates code_verifier and code_challenge for PKCE flow
 * Save these in your Postman environment variables
 * 
 * Usage:
 * node generate-pkce.js
 */

const crypto = require('crypto');

function generatePKCE() {
    // Generate random code verifier (43-128 characters)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // Generate code challenge (SHA-256 hash of verifier)
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
    
    return {
        codeVerifier,
        codeChallenge,
        method: 'S256'
    };
}

// Generate PKCE parameters
const pkce = generatePKCE();

console.log('\n🔐 PKCE Parameters Generated\n');
console.log('='.repeat(60));
console.log('\n📋 Add these to your Postman environment:\n');
console.log('Variable Name         | Value');
console.log('─'.repeat(60));
console.log(`pkce_verifier         | ${pkce.codeVerifier}`);
console.log(`pkce_challenge        | ${pkce.codeChallenge}`);
console.log(`pkce_challenge_method | ${pkce.method}`);
console.log('\n' + '='.repeat(60));
console.log('\n💡 Tips:');
console.log('• Use these values for a complete authorization flow');
console.log('• Generate new values for each flow (security best practice)');
console.log('• Keep code_verifier secret until token exchange');
console.log('\n📖 PKCE Flow:');
console.log('1. PAR Request → Use code_challenge + code_challenge_method');
console.log('2. Authorization → Server validates challenge');
console.log('3. Token Request → Use code_verifier to prove possession\n');

// Also output as JSON for easy copying
console.log('📄 JSON format:\n');
console.log(JSON.stringify({
    pkce_verifier: pkce.codeVerifier,
    pkce_challenge: pkce.codeChallenge,
    pkce_challenge_method: pkce.method
}, null, 2));
console.log('');
