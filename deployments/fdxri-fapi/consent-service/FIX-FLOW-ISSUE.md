# Fix: "It is illegal to add execution to a built in flow"

## The Problem
Keycloak doesn't allow you to directly modify built-in flows like "browser". You need to copy the flow first.

## Solution: Copy the Browser Flow

### Option 1: Copy via Admin Console (Recommended)

1. **Go to Authentication → Flows**
2. **Find the "browser" flow** in the list
3. **Click the dropdown menu** (three dots) next to "browser"
4. **Select "Copy"**
5. **Name it** (e.g., "browser with consent" or "browser-fdx")
6. **Click "Save"**

7. **Now go to your new flow** (not the original "browser" flow)
8. **Click "Add step"**
9. **Select "FDX Consent Selection"**
10. **Click "Add"**
11. **Set requirement to "REQUIRED"**
12. **Move it after "Forms"** (drag and drop)
13. **Click on the step to configure it** (set the URLs)

### Option 2: Use a Sub-flow

Instead of copying the entire flow, you can add a sub-flow:

1. **Go to Authentication → Flows → browser**
2. **Click "Add sub-flow"** (not "Add step")
3. **Name it** (e.g., "FDX Consent")
4. **Set requirement to "REQUIRED"**
5. **Move it after "Forms"**
6. **Inside the sub-flow, click "Add step"**
7. **Select "FDX Consent Selection"**
8. **Click "Add"**

### Option 3: Update Clients to Use New Flow

After creating the new flow, you need to tell your clients to use it:

1. **Go to Clients → [Your Client]**
2. **Go to the "Advanced" tab**
3. **Find "Browser Flow"** dropdown
4. **Select your new flow** (e.g., "browser with consent")
5. **Click "Save"**

## Quick Steps Summary

1. Copy "browser" flow → Name it "browser-fdx"
2. Add "FDX Consent Selection" step to the new flow
3. Configure the step (set URLs)
4. Update clients to use the new flow

That's it! The error was because you can't modify built-in flows directly.




