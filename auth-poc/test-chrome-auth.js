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