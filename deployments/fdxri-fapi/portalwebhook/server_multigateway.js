// server.js
// A minimal Express webhook that updates Keycloak client login/consent settings
// Requires Node 18+ (or add a fetch polyfill)

import express from "express";
import crypto from "crypto";

// ----------------------
// Config (via env vars)
// ----------------------
const {
  PORT = 7799,

  
  // Tyk Portal Admin API 
  TYK_PORTAL_BASE_URL="http://localhost:3013",            // e.g. http://tyk-portal.localhost:3100
  TYK_PORTAL_ADMIN_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJQcm92aWRlciI6Im5vbmUiLCJVc2VySUQiOiIkMmEkMTAkRFRjSjN4THF3M2FtT3VLbEhXRHhUdW9lZlpsbWQ1Q2RSeVV4TUh1ZnZaUXVkazVCVGJ1dWUifQ.6dfJBe85jkGVwva4ES_zIEdz5UnHEkusgowG7GVkybk",
  // Keycloak
  KC_BASE_URL="http://keycloak:8180",                    // e.g. http://keycloak:8180
  KC_REALM ="fapi-demo",                       // e.g. myrealm
  KC_ADMIN_USERNAME = "admin",              // 
  KC_ADMIN_PASSWORD = "admin",              // 
  KC_ADMIN_REALM = "master",      // typically "master"
  KC_ADMIN_CLIENT_ID = "admin-cli",

  // Defaults applied if webhook doesn't send them
  DEFAULT_CONSENT_TEXT = "This app will access your account data to provide personalized services.",
  DEFAULT_LOGIN_THEME = "bank-theme",
} = process.env;


const app = express();
app.use(express.json({ limit: "1mb" }));

// ----------------------
// Helpers
// ----------------------

async function getAdminToken() {
  console.log("Enter getAdminToken()");
  const urltoken = `${KC_BASE_URL}/realms/${KC_ADMIN_REALM}/protocol/openid-connect/token`;

  console.log("This is urltoken: ", urltoken);


  const resp = await fetch(urltoken, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: `${KC_ADMIN_USERNAME}`,
      password: `${KC_ADMIN_PASSWORD}`
    })
  });


  if (!resp.ok) {
    console.warn(`Authentication to KeyCloak Failed: ${resp.status}`);
    return null;
  }
  const accessTokenResponse = await resp.json();

  return accessTokenResponse.access_token;
}


async function kcGetClientRepresentation(adminToken, id) {
  const url = `${KC_BASE_URL}/admin/realms/${encodeURIComponent(KC_REALM)}/clients/${encodeURIComponent(id)}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${adminToken}` } });
  if (!resp.ok) throw new Error(`KC GET client rep failed: ${resp.status}`);
  return resp.json();
}

async function kcUpdateClientRepresentation(adminToken, id, rep) {
  const url = `${KC_BASE_URL}/admin/realms/${encodeURIComponent(KC_REALM)}/clients/${encodeURIComponent(id)}`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rep),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`KC PUT client rep failed: ${resp.status} ${txt}`);
  }
}

async function kcGetClientScopes(adminToken) {
  const url = `${KC_BASE_URL}/admin/realms/${encodeURIComponent(KC_REALM)}/client-scopes`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${adminToken}` } });
  if (!resp.ok) throw new Error(`KC GET client scopes failed: ${resp.status}`);
  return resp.json();
}

async function kcAddDefaultClientScope(adminToken, clientId, scopeId) {
  const url = `${KC_BASE_URL}/admin/realms/${encodeURIComponent(KC_REALM)}/clients/${encodeURIComponent(clientId)}/default-client-scopes/${encodeURIComponent(scopeId)}`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    // 204 is success, 409 means already exists (which is fine)
    if (resp.status !== 204 && resp.status !== 409) {
      throw new Error(`KC PUT default scope failed: ${resp.status} ${txt}`);
    }
  }
}

async function kcAddOptionalClientScope(adminToken, clientId, scopeId) {
  const url = `${KC_BASE_URL}/admin/realms/${encodeURIComponent(KC_REALM)}/clients/${encodeURIComponent(clientId)}/optional-client-scopes/${encodeURIComponent(scopeId)}`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    // 204 is success, 409 means already exists (which is fine)
    if (resp.status !== 204 && resp.status !== 409) {
      throw new Error(`KC PUT optional scope failed: ${resp.status} ${txt}`);
    }
  }
}

/**
 * Optional: resolve a Tyk AppName -> clientId via Portal Admin API.
 * Adjust this to match your portal schema for applications/credentials.
 */
async function resolveClientIdFromTykAppName(adminToken, appID) {
  console.log("Try to get ClientID from this appID: ", appID);

  //Get AppName from Tky Portal from appID
  const urlAppNameSearch  = `${TYK_PORTAL_BASE_URL}/portal-api/apps/${appID}`;

  const responseAppName = await fetch(urlAppNameSearch, {
      method: "GET",
      headers: {
        "Authorization": `${TYK_PORTAL_ADMIN_API_KEY}`
      }
  });
  
  if (!responseAppName.ok) {
    const errorText = await responseAppName.text();
    console.error(`Failed to fetch app from Tyk Portal: ${responseAppName.status} ${errorText}`);
    throw new Error(`Tyk Portal API error: ${responseAppName.status} - ${errorText}`);
  }
  
  const appNameData = await responseAppName.json();
  console.log("THIS IS appNameData: ", JSON.stringify(appNameData, null, 2));

  // Try multiple property names (Name, name, AppName, etc.)
  let appName = appNameData.Name || appNameData.name || appNameData.AppName || appNameData.appName;
  
  if (!appName) {
    console.error("Could not find app name in response. Available keys:", Object.keys(appNameData));
    throw new Error(`Unable to find app name in Tyk Portal response for appID ${appID}`);
  }

  console.log("THIS IS appName: ", appName);
  console.log("This is admin token ", adminToken);

  
  //fetch all clients because keycloak doesn't have a way to search by Name.

  const urlsearch  = `${KC_BASE_URL}/admin/realms/${KC_REALM}/clients?search=true`;

  const response = await fetch(urlsearch, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${adminToken}`
      }
  });
  
  if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
   }

    const data = await response.json();
    console.log("This is search result from KeyCloak:", data)


    // find the matching client by "name" - also try matching by clientId as fallback
    let client = data.find(item => item.name === appName);
    
    // If not found by name, try matching by clientId
    if (!client) {
      console.log(`No client found by name "${appName}", trying to match by clientId...`);
      client = data.find(item => item.clientId === appName);
    }

    if (client) {
      console.log(`Found clientId for ${appName}:`, client.clientId);
      return client.clientId;
    } else {
      console.log(`App with name ${appName} not found in Keycloak clients`);
      console.log("Available client names:", data.map(c => c.name || c.clientId).filter(Boolean));
      return null; // Return null instead of trying to access undefined property
    }
  }

// Apply our changes to the KC client representation
function applyConsentAndTheme(rep, { consentText, loginTheme }) {
  rep.consentRequired = true; // boolean
  rep.publicClient = true;
  rep.clientAuthenticatorType = ""; 
  rep.attributes = rep.attributes || {};
  rep.attributes["display.on.consent.screen"] = "true"; // strings for attributes
  rep.attributes["consent.screen.text"] = consentText || DEFAULT_CONSENT_TEXT;
  rep.attributes["login_theme"] = loginTheme || DEFAULT_LOGIN_THEME;
  rep.attributes["require.pushed.authorization.requests"] = "true";
  rep.attributes["dpop.bound.access.tokens"] = "true";
  rep.attributes["pkce.code.challenge.method"] = "S256";
  rep.attributes["id.token.signed.response.alg"] = "ES256";
  rep.attributes["iaccess.token.signed.response.alg"] = "ES256";
 
  // Don't modify defaultClientScopes here - we'll add them via dedicated API endpoints
  // Return the scopes that should be added as default scopes
  const defaultScopesToAdd = [
    "openid",
    "fdx:account.basic:read",
    "fdx:account.detail:read",
    "fdx:transaction:read",
    "fdx:payment:write"
  ];

  return { rep, defaultScopesToAdd };
}



// ----------------------
// Webhook endpoint
// ----------------------

app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

app.head("/webhooks/tyk", (req, res) => {
  console.log("Webhook connectivity check (HEAD)");
  res.status(200).end(); // no body for HEAD
});

app.post("/webhooks/tyk", async (req, res) => {
  console.log("We are here",req.body);
  try {

    // Tyk event payloads often look like:
    // { Event: "AccessRequestApproved", Message: {...}, Timestamp: "..." }
    const body = req.body || {};

    // Prefer direct fields if you decide to have Tyk include them:
    // e.g., you can configure your webhook mapping/template to add clientId, consentText, loginTheme.
    let clientId;
    const appID = body.Message?.AppID;

    console.log("appID: ", appID);

    const consentText =  DEFAULT_CONSENT_TEXT;
    const loginTheme = DEFAULT_LOGIN_THEME;
    const adminToken = await getAdminToken();
   
    // Resolve clientId if needed
    if (!clientId && appID) {
      clientId = await resolveClientIdFromTykAppName(adminToken, appID);

      console.log("This is clientID from TykappID", clientId);
      if (!clientId) {
        console.log("FAILED to get ClientID");
        return res.status(404).json({ error: `Unable to resolve clientId from AppID ${appID}` });
      }
    }


    const rep = await kcGetClientRepresentation(adminToken, clientId);
    const { rep: updated, defaultScopesToAdd } = applyConsentAndTheme(rep, { consentText, loginTheme });
    await kcUpdateClientRepresentation(adminToken, clientId, updated);

    // Now add the scopes using the dedicated API endpoints
    console.log(`Adding default client scopes: ${defaultScopesToAdd.join(", ")}`);
    const allScopes = await kcGetClientScopes(adminToken);
    
    // Create a map of scope name to scope ID
    const scopeNameToId = {};
    for (const scope of allScopes) {
      scopeNameToId[scope.name] = scope.id;
    }

    // Add each default scope
    for (const scopeName of defaultScopesToAdd) {
      const scopeId = scopeNameToId[scopeName];
      if (scopeId) {
        console.log(`Adding default scope: ${scopeName} (ID: ${scopeId})`);
        await kcAddDefaultClientScope(adminToken, clientId, scopeId);
      } else {
        console.warn(`Scope not found in Keycloak: ${scopeName}`);
      }
    }

    console.log(`Updated login/consent and scopes for clientId=${clientId}`);
    return res.json({ ok: true, clientId, scopesAdded: defaultScopesToAdd });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

app.get("/healthz", (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Webhook server listening on :${PORT}`);
});