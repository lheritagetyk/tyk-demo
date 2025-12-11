# How to Get the Actual 400 Error Message

The 400 Bad Request error in the browser console doesn't show the actual error message. Here's how to get it:

## Steps:

1. **Open Browser Developer Tools** (F12)

2. **Go to the Network Tab**

3. **Clear the network log** (trash icon or right-click → Clear)

4. **Try adding the authenticator again** (Add step → Select "FDX Consent Selection" → Click "Add")

5. **Find the failed request** - Look for a POST request to:
   ```
   /admin/realms/fapi-demo/authentication/flows/browser/executions/execution
   ```
   It should show status `400` in red

6. **Click on that request**

7. **Go to the "Response" tab** - This will show the actual error message from Keycloak

8. **Copy the error message** - It might look like:
   ```json
   {
     "error": "invalid_request",
     "error_description": "Missing required field: provider"
   }
   ```
   or
   ```json
   {
     "error": "validation_error",
     "error_description": "Authenticator factory not found: fdx-consent-authenticator"
   }
   ```

## Common Error Messages:

- **"Missing required field: provider"** - The provider ID is not being sent correctly
- **"Authenticator factory not found"** - The authenticator is not properly registered
- **"Invalid provider"** - The provider ID doesn't match what's registered
- **"Validation failed"** - Some configuration is invalid

## Once You Have the Error:

Share the exact error message from the Response tab, and I can fix it!

