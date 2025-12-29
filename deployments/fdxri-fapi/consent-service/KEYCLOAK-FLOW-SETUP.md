# How to Add Authentication Flow Execution in Keycloak

## The Problem

Keycloak's UI for adding authentication flow executions can be confusing. The "Add execution" button might not be visible or might be in an unexpected location.

## Solution 1: Find "Add execution" in Keycloak UI

### Step-by-Step Instructions

1. **Login to Keycloak Admin Console**
   - Go to `http://keycloak:8180` (or your Keycloak URL)
   - Login as admin

2. **Navigate to Authentication Flows**
   - Click **Authentication** in the left sidebar
   - Click **Flows** tab (should be selected by default)

3. **Select the Browser Flow**
   - You should see a list of flows: `browser`, `direct grant`, `registration`, etc.
   - Click on **browser** flow (or the flow you want to modify)

4. **View Flow Details**
   - After clicking "browser", you should see the flow structure with steps like:
     - Cookie
     - Identity Provider Redirector
     - Forms
     - Browser - Conditional OTP
     - etc.

5. **Add Execution - The Tricky Part**

   The "Add execution" button appears in different places depending on Keycloak version:

   **Option A: Button at the top**
   - Look for a button labeled **"Add execution"** or **"Add flow"** at the top of the flow details page
   - It might be next to "Copy" or "Add flow" buttons

   **Option B: Dropdown menu**
   - Look for a dropdown or menu button (three dots `...` or a gear icon)
   - Click it to see options including "Add execution"

   **Option C: Right-click context menu**
   - Right-click on the "Forms" execution
   - Look for "Add execution" or "Add flow" in the context menu

   **Option D: Click on "Forms" execution**
   - Click directly on the "Forms" execution row
   - This might open a panel or menu with "Add execution" option

6. **If you still can't find it, try this:**
   - Look for a **"Copy"** button - click it to copy the flow
   - Edit the copied flow - sometimes the UI is more visible in edit mode
   - Or use the REST API method below

## Solution 2: Use REST API (Recommended)

This is more reliable and can be automated. Here's a script to add the execution:

```bash
#!/bin/bash
# add-consent-execution.sh

KC_BASE_URL="${KC_BASE_URL:-http://keycloak:8180}"
KC_REALM="${KC_REALM:-fapi-demo}"
KC_ADMIN_USERNAME="${KC_ADMIN_USERNAME:-admin}"
KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-admin}"

echo "Adding consent execution to Keycloak browser flow..."

# Get admin token
TOKEN_RESPONSE=$(curl -s -X POST "${KC_BASE_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=${KC_ADMIN_USERNAME}" \
  -d "password=${KC_ADMIN_PASSWORD}")

ADMIN_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.access_token')

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo "ERROR: Failed to get admin token"
  exit 1
fi

# Get browser flow
echo "Getting browser flow..."
FLOW_RESPONSE=$(curl -s -X GET "${KC_BASE_URL}/admin/realms/${KC_REALM}/authentication/flows/browser" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

echo "Browser flow retrieved"

# Note: Keycloak doesn't have a built-in "redirect to external URL" authenticator
# You'll need to either:
# 1. Use application-level integration (see Solution 3)
# 2. Create a custom authenticator SPI
# 3. Use a script-based authenticator with JavaScript

echo ""
echo "NOTE: Keycloak doesn't have a built-in way to redirect to external consent service."
echo "You have two options:"
echo ""
echo "Option 1: Application-Level Integration (Easiest)"
echo "  - Handle consent redirect in your application after authentication"
echo "  - See Solution 3 below"
echo ""
echo "Option 2: Custom Authenticator SPI (Advanced)"
echo "  - Create a Java-based Keycloak authenticator"
echo "  - Requires Keycloak SPI development"
echo ""
echo "For now, we recommend Option 1 (Application-Level Integration)"
```

## Solution 3: Application-Level Integration (Easiest - Recommended)

Instead of modifying Keycloak's authentication flow, handle consent at the application level. This is simpler and more flexible.

### How It Works

1. User authenticates with Keycloak (normal OAuth flow)
2. Your application receives the access token
3. Your application checks if user has active consent
4. If no consent, redirect to consent service
5. After consent, continue with normal flow

### Implementation Example

#### In your OAuth callback handler:

```javascript
// After receiving authorization code
async function handleOAuthCallback(code) {
  // 1. Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code);
  
  // 2. Extract user ID from token
  const userId = decodeToken(tokens.id_token).sub;
  
  // 3. Check if user has active consent
  const consentServiceUrl = 'http://consent-service:8900';
  const consentsResponse = await fetch(`${consentServiceUrl}/api/consents/${userId}`);
  const { consents } = await consentsResponse.json();
  
  const hasActiveConsent = consents.some(c => 
    c.status === 'ACTIVE' && 
    (!c.expirationTime || new Date(c.expirationTime) > new Date())
  );
  
  // 4. If no active consent, redirect to consent service
  if (!hasActiveConsent) {
    const consentUrl = new URL(`${consentServiceUrl}/consent`);
    consentUrl.searchParams.set('access_token', tokens.access_token);
    consentUrl.searchParams.set('user_id', userId);
    consentUrl.searchParams.set('redirect_uri', window.location.href);
    
    window.location.href = consentUrl.toString();
    return; // Stop here, user will be redirected back after consent
  }
  
  // 5. User has consent, continue with normal application flow
  proceedWithApplication(tokens);
}
```

#### In your consent service callback handler:

```javascript
// After user grants consent (in consent-ui.html)
async function submitConsent() {
  // ... existing consent submission code ...
  
  // After successful consent storage, redirect back
  const redirectUri = urlParams.get('redirect_uri');
  if (redirectUri) {
    // Add a flag to indicate consent was just granted
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('consent_granted', 'true');
    window.location.href = redirectUrl.toString();
  }
}
```

#### Update your OAuth callback to handle consent redirect:

```javascript
// Check if user is returning from consent service
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('consent_granted') === 'true') {
  // User just granted consent, exchange code again to get fresh token
  const code = urlParams.get('code');
  const tokens = await exchangeCodeForTokens(code);
  proceedWithApplication(tokens);
}
```

## Solution 4: Use Keycloak's Built-in Consent Screen (Alternative)

Keycloak has a built-in consent screen, but it doesn't support fine-grained account selection. However, you can:

1. Enable consent required on your client
2. Customize the consent screen text
3. Use a custom theme to redirect to your consent service

### Steps:

1. **Enable Consent on Client**
   - Go to **Clients** → Your Client
   - Set **Consent Required** to **ON**
   - Set **Display On Consent Screen** to **ON**

2. **Customize Consent Screen Text**
   - Go to **Clients** → Your Client → **Advanced** tab
   - Set **Consent Screen Text** to something like:
     ```
     This application requires fine-grained account consent. 
     You will be redirected to select specific accounts.
     ```

3. **Use Custom Theme** (Advanced)
   - Create a custom Keycloak theme
   - Modify the consent screen template to redirect to your consent service
   - This requires theme development

## Recommended Approach

**Use Solution 3 (Application-Level Integration)** because:

✅ No Keycloak modifications needed  
✅ Works with any Keycloak version  
✅ More flexible and easier to maintain  
✅ Can be updated without restarting Keycloak  
✅ Easier to test and debug  

The consent service is designed to work this way - it's a standalone service that your application calls after authentication.

## Testing the Application-Level Integration

1. **Start consent service:**
   ```bash
   cd consent-service
   npm start
   ```

2. **Test consent check:**
   ```bash
   # After user authenticates, check for consent
   curl http://consent-service:8900/api/consents/{userId}
   ```

3. **Test consent creation:**
   ```bash
   # Create a consent
   curl -X POST http://consent-service:8900/api/consents \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "user-uuid",
       "selectedAccounts": ["account-id-1"],
       "dataClusters": ["ACCOUNT_DETAILED", "TRANSACTIONS"],
       "durationType": "TIME_BOUND",
       "durationPeriod": 365
     }'
   ```

4. **Test consent UI:**
   ```bash
   # Open in browser (replace with actual values)
   http://consent-service:8900/consent?access_token=TOKEN&user_id=USER_ID&redirect_uri=REDIRECT_URI
   ```

## Summary

- **Can't find "Add execution" in UI?** → Use Application-Level Integration (Solution 3)
- **Want to modify Keycloak flow?** → Use REST API or create custom authenticator
- **Simplest approach?** → Application-Level Integration

The consent service is designed to work independently - you don't need to modify Keycloak's authentication flow!




