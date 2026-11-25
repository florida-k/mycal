import { supabase } from "./supabase-client.js";

let initializationPromise = null;
let oauthInProgress = false;

// Restore the existing session or create a guest account.
async function ensureSession() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (data.session) {
        return data.session;
      }

      const { data: anonymousData, error: anonymousError } =
        await supabase.auth.signInAnonymously();

      if (anonymousError) {
        throw anonymousError;
      }

      if (!anonymousData.session) {
        throw new Error("Unable to initialize MyCal session.");
      }

      return anonymousData.session;
    })().finally(() => {
      initializationPromise = null;
    });
  }

  return initializationPromise;
}

// Initialize authentication when the service worker starts.
ensureSession().catch(error => {
  console.error("MyCal authentication failed:", error.message);
});

// Return account information without exposing access tokens.
async function getAccountStatus() {
  await ensureSession();

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  const user = data.user;

  if (!user) {
    throw new Error("No active MyCal account.");
  }

  return {
    anonymous: user.is_anonymous === true,
    googleConnected:
      user.identities?.some(
        identity => identity.provider === "google"
      ) ?? false,
    email: user.email || null
  };
}

// Link a guest account or sign into an existing account.
async function authenticateGoogle(mode) {
  if (oauthInProgress) {
    throw new Error("Google authentication is already in progress.");
  }

  oauthInProgress = true;

  try {
    const session = await ensureSession();
    const originalUserId = session.user.id;

    const redirectTo = chrome.identity.getRedirectURL();

    const options = {
      redirectTo,
      skipBrowserRedirect: true
    };

    const result = mode === "link"
      ? await supabase.auth.linkIdentity({
          provider: "google",
          options
        })
      : await supabase.auth.signInWithOAuth({
          provider: "google",
          options
        });

    if (result.error) {
      throw result.error;
    }

    if (!result.data?.url) {
      throw new Error("Unable to start Google authentication.");
    }

    const callbackUrl = await chrome.identity.launchWebAuthFlow({
      url: result.data.url,
      interactive: true
    });

    if (!callbackUrl) {
      throw new Error("Google authentication was cancelled.");
    }

    const callback = new URL(callbackUrl);
    const code = callback.searchParams.get("code");

    const callbackError =
      callback.searchParams.get("error_description") ||
      callback.searchParams.get("error");

    if (callbackError) {
      throw new Error(callbackError);
    }

    if (!code) {
      throw new Error("Google authentication returned no code.");
    }

    const { data, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("Google authentication returned no user.");
    }

    if (mode === "link" && data.user.id !== originalUserId) {
      throw new Error(
        "Account linking returned an unexpected user identity."
      );
    }

    return await getAccountStatus();

  } finally {
    oauthInProgress = false;
  }
}

// Refresh open Canvas Calendar tabs after account changes.
async function refreshCanvasTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: "https://ufl.instructure.com/calendar*"
    });

    await Promise.allSettled(
      tabs
        .filter(tab => tab.id !== undefined)
        .map(tab => chrome.tabs.reload(tab.id))
    );

  } catch (error) {
    console.warn("Unable to refresh Canvas tabs:", error.message);
  }
}

// Sign out locally and return to a new guest account.
async function signOutMyCal() {
  if (oauthInProgress) {
    throw new Error("Account authentication is already in progress.");
  }

  oauthInProgress = true;

  try {
    await ensureSession();

    const { error } = await supabase.auth.signOut({
      scope: "local"
    });

    if (error) {
      throw error;
    }

    // Create a fresh anonymous session.
    await ensureSession();

    const account = await getAccountStatus();

    await refreshCanvasTabs();

    return account;

  } finally {
    oauthInProgress = false;
  }
}

// Authentication messages from the extension popup.
chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    const type = message?.type;

    const supportedTypes = [
      "MYCAL_AUTH_STATUS",
      "MYCAL_AUTH_LINK_GOOGLE",
      "MYCAL_AUTH_SIGNIN_GOOGLE",
      "MYCAL_AUTH_SIGNOUT"
    ];

    if (!supportedTypes.includes(type)) {
      return false;
    }

    // Only allow account controls from our extension popup.
    if (sender.url !== chrome.runtime.getURL("popup.html")) {
      sendResponse({
        ok: false,
        error: "Unauthorized authentication request."
      });

      return false;
    }

    (async () => {
      try {
        let data;

        if (type === "MYCAL_AUTH_STATUS") {
          data = await getAccountStatus();

        } else if (type === "MYCAL_AUTH_LINK_GOOGLE") {
          data = await authenticateGoogle("link");
          await refreshCanvasTabs();

        } else if (type === "MYCAL_AUTH_SIGNIN_GOOGLE") {
          data = await authenticateGoogle("signin");
          await refreshCanvasTabs();

        } else if (type === "MYCAL_AUTH_SIGNOUT") {
          data = await signOutMyCal();
        }

        sendResponse({ ok: true, data });

      } catch (error) {
        sendResponse({
          ok: false,
          error: error.message
        });
      }
    })();

    return true;
  }
);

// Used by background.js for authenticated backend requests.
globalThis.getMyCalAccessToken = async () => {
  if (oauthInProgress) {
    throw new Error(
      "Account authentication in progress. Please try again."
    );
  }

  const session = await ensureSession();

  if (!session?.access_token) {
    throw new Error("No active Supabase session found.");
  }

  return session.access_token;
};