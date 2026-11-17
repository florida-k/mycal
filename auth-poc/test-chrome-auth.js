import { supabase } from "./supabase-client.js";
import { testGoogleLink } from "./test-google-link.js";
import { testGoogleSignIn } from "./test-google-signin.js";

async function testAuth() {
  // Check whether a session already exists.
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    console.error("Session error:", sessionError.message);
    return;
  }

  if (sessionData.session) {
    console.log("Existing session restored!");
    console.log("User ID:", sessionData.session.user.id);
    return;
  }

  // Only create a new anonymous user if no session exists.
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    console.error("Anonymous sign-in failed:", error.message);
    return;
  }

  console.log("New anonymous session created!");
  console.log("User ID:", data.user.id);
}

testAuth();
globalThis.testMyCalGoogleSignIn = testGoogleSignIn;

// Temporary Google OAuth test trigger.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "MYCAL_TEST_GOOGLE_LINK") {
    return false;
  }

  testGoogleLink()
    .then(() => sendResponse({ ok: true }))
    .catch(error =>
      sendResponse({ ok: false, error: error.message })
    );

  return true;
});

// Temporary Google sign-in test trigger.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "MYCAL_TEST_GOOGLE_SIGNIN") {
    return false;
  }

  testGoogleSignIn()
    .then(() => sendResponse({ ok: true }))
    .catch(error =>
      sendResponse({ ok: false, error: error.message })
    );

  return true;
});

globalThis.testMyCalBackendAuth = async () => {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Supabase session error:", error.message);
    return;
  }

  if (!data.session) {
    console.error("No active Supabase session found.");
    return;
  }

  const response = await fetch(
    "http://localhost:8080/api/assignments/542201/6666209",
    {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    }
  );

  console.log("Backend HTTP status:", response.status);
  console.log("Backend response:", await response.text());
};


globalThis.getMyCalAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`Supabase session error: ${error.message}`);
  }

  if (!data.session?.access_token) {
    throw new Error("No active Supabase session found.");
  }

  return data.session.access_token;
};


globalThis.createMyCalTestUser = async () => {
  const { error: signOutError } = await supabase.auth.signOut({
    scope: "local"
  });

  if (signOutError) {
    throw new Error(signOutError.message);
  }

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    throw new Error(error.message);
  }

  console.log("New test Supabase user ID:", data.user.id);
  return data.user.id;
};
