/**
 * DPoP Setup Test Script
 * 
 * This script tests your DPoP setup to ensure everything is working
 * 
 * Usage:
 * node test-dpop.js
 */

const fs = require('fs');
const { SignJWT, importJWK } = require('jose');
const crypto = require('crypto');

const KEYS_FILE = './dpop-keys.json';

async function runTests() {
    console.log('\n🧪 DPoP Setup Test Suite\n');
    console.log('='.repeat(60));
    
    let passed = 0;
    let failed = 0;
    
    // Test 1: Check if keys exist
    console.log('\n1️⃣  Testing: Keys file exists');
    if (fs.existsSync(KEYS_FILE)) {
        console.log('   ✅ PASS: dpop-keys.json found');
        passed++;
    } else {
        console.log('   ❌ FAIL: dpop-keys.json not found');
        console.log('   → Run: npm run generate-keys');
        failed++;
        return;
    }
    
    // Test 2: Load and validate keys
    console.log('\n2️⃣  Testing: Keys are valid');
    let keys;
    try {
        keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
        
        if (keys.publicJWK && keys.privateJWK && keys.thumbprint) {
            console.log('   ✅ PASS: Keys structure is valid');
            console.log(`   → Key type: ${keys.publicJWK.kty}`);
            console.log(`   → Curve: ${keys.publicJWK.crv}`);
            console.log(`   → Thumbprint: ${keys.thumbprint}`);
            passed++;
        } else {
            throw new Error('Missing required key fields');
        }
    } catch (error) {
        console.log('   ❌ FAIL:', error.message);
        failed++;
        return;
    }
    
    // Test 3: Import private key
    console.log('\n3️⃣  Testing: Private key can be imported');
    let privateKey;
    try {
        privateKey = await importJWK(keys.privateJWK, 'ES256');
        console.log('   ✅ PASS: Private key imported successfully');
        passed++;
    } catch (error) {
        console.log('   ❌ FAIL:', error.message);
        failed++;
        return;
    }
    
    // Test 4: Sign a DPoP proof
    console.log('\n4️⃣  Testing: Can sign DPoP proof');
    try {
        const testPayload = {
            jti: crypto.randomUUID(),
            htm: 'GET',
            htu: 'https://api.example.com/test',
            iat: Math.floor(Date.now() / 1000)
        };
        
        const dpopProof = await new SignJWT(testPayload)
            .setProtectedHeader({
                typ: 'dpop+jwt',
                alg: 'ES256',
                jwk: keys.publicJWK
            })
            .sign(privateKey);
        
        console.log('   ✅ PASS: DPoP proof signed successfully');
        console.log(`   → Proof length: ${dpopProof.length} characters`);
        console.log(`   → First 50 chars: ${dpopProof.substring(0, 50)}...`);
        passed++;
        
        // Decode and display
        const parts = dpopProof.split('.');
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        
        console.log('\n   📋 Decoded DPoP Proof:');
        console.log('   Header:', JSON.stringify(header, null, 2).split('\n').join('\n   '));
        console.log('   Payload:', JSON.stringify(payload, null, 2).split('\n').join('\n   '));
        
    } catch (error) {
        console.log('   ❌ FAIL:', error.message);
        failed++;
    }
    
    // Test 5: Test with access token hash
    console.log('\n5️⃣  Testing: Can create proof with access token hash');
    try {
        const testToken = 'test_access_token_12345';
        const tokenHash = crypto.createHash('sha256').update(testToken).digest();
        const ath = tokenHash.toString('base64url');
        
        const testPayload = {
            jti: crypto.randomUUID(),
            htm: 'GET',
            htu: 'https://api.example.com/accounts',
            iat: Math.floor(Date.now() / 1000),
            ath: ath
        };
        
        const dpopProof = await new SignJWT(testPayload)
            .setProtectedHeader({
                typ: 'dpop+jwt',
                alg: 'ES256',
                jwk: keys.publicJWK
            })
            .sign(privateKey);
        
        console.log('   ✅ PASS: DPoP proof with ath claim created');
        console.log(`   → ATH: ${ath.substring(0, 30)}...`);
        passed++;
        
    } catch (error) {
        console.log('   ❌ FAIL:', error.message);
        failed++;
    }
    
    // Test 6: Check signing service readiness
    console.log('\n6️⃣  Testing: Signing service files exist');
    if (fs.existsSync('./dpop-signing-service.js')) {
        console.log('   ✅ PASS: Signing service file found');
        console.log('   → Start with: npm start');
        passed++;
    } else {
        console.log('   ❌ FAIL: dpop-signing-service.js not found');
        failed++;
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Test Results\n');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed! Your DPoP setup is ready.');
        console.log('\n📋 Next Steps:');
        console.log('   1. Start the signing service: npm start');
        console.log('   2. Configure Postman environment variables');
        console.log('   3. Add pre-request script to your collection');
        console.log('   4. Test with a real request!');
    } else {
        console.log('\n⚠️  Some tests failed. Please fix the issues above.');
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
}

// Run tests
runTests().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
});
