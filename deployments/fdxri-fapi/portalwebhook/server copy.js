// server.js
// A minimal Express webhook that updates Keycloak client login/consent settings
// Requires Node 18+ (or add a fetch polyfill)

import express from "express";
import crypto from "crypto";

// ----------------------
// Config (via env vars)
// ----------------------
const {
  PORT = 8899,

  
  // Tyk Portal Admin API (optional, only needed if you want to resolve AppID -> clientId)
  TYK_PORTAL_BASE_URL="http://tyk-portal.localhost:3100",            // e.g. http://tyk-portal.localhost:3100
  TYK_PORTAL_ADMIN_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJQcm92aWRlciI6Im5vbmUiLCJVc2VySUQiOiIkMmEkMTAkOE1OZDBGSTdSeGdHdWdTMzdmRzdULmlnWlB0VTBmRjMvL1I0OG9PbTBLV2YuclhyV2luOG0ifQ.GA0fGY6WezJ78yERfNQWOFhDEnu_6rs4k3StzB1ehXQ",
  // Keycloak
  KC_BASE_URL="http://keycloak:8180",                    // e.g. http://keycloak:8180
  KC_REALM ="master",                       // e.g. myrealm
  KC_ADMIN_TOKEN,                 // (optional) pre-provisioned admin bearer token
  KC_ADMIN_USERNAME = "admin",              // (optional) if you want this service to fetch a token
  KC_ADMIN_PASSWORD = "admin",              // (optional)
  KC_ADMIN_REALM = "master",      // typically "master"
  KC_ADMIN_CLIENT_ID = "admin-cli",

  // Defaults applied if webhook doesn’t send them
  DEFAULT_CONSENT_TEXT = "This app will access your account data to provide personalized services.",
  DEFAULT_LOGIN_THEME = "mytheme",
} = process.env;


const app = express();
app.use(express.json({ limit: "1mb" }));

// ----------------------
// Helpers
// ----------------------

async function getAdminToken() {
  if (KC_ADMIN_TOKEN) return KC_ADMIN_TOKEN;

  if (!KC_ADMIN_USERNAME || !KC_ADMIN_PASSWORD) {
    throw new Error("No KC_ADMIN_TOKEN provided and KC_ADMIN_USERNAME / KC_ADMIN_PASSWORD not set");
    }
  const url = `${KC_BASE_URL}/realms/${encodeURIComponent(KC_ADMIN_REALM)}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: KC_ADMIN_CLIENT_ID,
    username: KC_ADMIN_USERNAME,
    password: KC_ADMIN_PASSWORD,
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Failed to get admin token: ${resp.status} ${txt}`);
  }
  const json = await resp.json();
  return json.access_token;
}

async function kcGetClientIdByClientId(adminToken, clientId) {
  const url = `${KC_BASE_URL}/admin/realms/${encodeURIComponent(KC_REALM)}/clients?clientId=${encodeURIComponent(clientId)}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${adminToken}` } });
  if (!resp.ok) throw new Error(`KC clients?clientId=... failed: ${resp.status}`);
  const arr = await resp.json();
  const id = Array.isArray(arr) && arr[0] && arr[0].id;
  return id || null;
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

/**
 * Optional: resolve a Tyk AppName -> clientId via Portal Admin API.
 * Adjust this to match your portal schema for applications/credentials.
 */
async function resolveClientIdFromTykAppName(appID) {
  console.log("Try to get ClientID from this appID: ", appID);

  //Get AppName from Tky Portal from appID
  const urlAppNameSearch  = `${TYK_PORTAL_BASE_URL}/portal-api/apps/${appID}`;

  const responseAppName = await fetch(urlAppNameSearch, {
      method: "GET",
      headers: {
        "Authorization": `${TYK_PORTAL_ADMIN_API_KEY}`
      }
  });
 const appNameData = await responseAppName.json();

 console.log("THIS IS appNameData: ", appNameData);

 let appName = appNameData.Name;

 console.log("THIS IS appName: ", appName);

  // First get Token fromm KeyCloak
  const urltoken = `${KC_BASE_URL}/realms/master/protocol/openid-connect/token`;


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

  console.log("This is the accessTokenReponse, ", accessTokenResponse);

  const accessToken = accessTokenResponse.access_token;

  console.log("This is access token ", accessToken);

  //fetch all clients because keycloak doesn't have a way to search by Name.

  const urlsearch  = `${KC_BASE_URL}/admin/realms/master/clients?search=true`;

  const response = await fetch(urlsearch, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
  });
  
  if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
   }

    const data = await response.json();
    console.log("This is search result from KeyCloak:", data)


      // find the matching client by "name"
    let client = data.find(item => item.name === appName);

    if (client) {
      console.log(`Found clientId for ${appName}:`, client.clientId);
    } else {
      console.log(`App with name ${appName} not found`);
    }

      return client.clientId;
  }

// Apply our changes to the KC client representation
function applyConsentAndTheme(rep, { consentText, loginTheme }) {
  rep.consentRequired = true; // boolean
  rep.attributes = rep.attributes || {};
  rep.attributes["display.on.consent.screen"] = "true"; // strings for attributes
  rep.attributes["consent.screen.text"] = consentText || DEFAULT_CONSENT_TEXT;
  rep.attributes["login_theme"] = loginTheme || DEFAULT_LOGIN_THEME;
  return rep;
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

   
    // Resolve clientId if needed
    if (!clientId && appID) {
      clientId = await resolveClientIdFromTykAppName(appID);

      console.log("This is clientID from TykappID", clientId);
      if (!clientId) {
        console.log("FAILED to get ClientID");
        return res.status(404).json({ error: `Unable to resolve clientId from AppID ${appId}` });
      }
    }

    const adminToken = await getAdminToken();

    const kcId = await kcGetClientIdByClientId(adminToken, clientId);
    if (!kcId) {
      return res.status(404).json({ error: `Keycloak clientId not found: ${clientId}` });
    }

    const rep = await kcGetClientRepresentation(adminToken, kcId);
    const updated = applyConsentAndTheme(rep, { consentText, loginTheme });
    await kcUpdateClientRepresentation(adminToken, kcId, updated);

    console.log(
      `[${eventName}] Updated login/consent for clientId=${clientId} (kcId=${kcId})`
    );
    return res.json({ ok: true, clientId, kcId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

app.get("/healthz", (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Webhook server listening on :${PORT}`);
});