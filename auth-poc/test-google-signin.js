
import { supabase } from "./supabase-client.js";

export async function testGoogleSignIn() {
  const redirectTo = chrome.identity.getRedirectURL();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    console.error("Google sign-in failed:", error.message);
    return;
  }

  if (!data?.url) {
    console.error("Supabase did not return an OAuth URL.");
    return;
  }

  console.log("Google sign-in URL generated successfully.");

  try {
    const callbackUrl = await chrome.identity.launchWebAuthFlow({
      url: data.url,
      interactive: true,
    });

    if (!callbackUrl) {
      throw new Error("No OAuth callback URL received.");
    }

    const callback = new URL(callbackUrl);
    const code = callback.searchParams.get("code");

    if (!code) {
      throw new Error(
        callback.searchParams.get("error_description") ||
        "OAuth callback did not contain a code."
      );
    }

    const { data: authData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      throw exchangeError;
    }

    console.log("Google sign-in completed!");
    console.log("Recovered user ID:", authData.user.id);
    console.log(
      "Anonymous:",
      authData.user.is_anonymous
    );
    console.log(
      "Providers:",
      authData.user.app_metadata?.providers
    );
  } catch (error) {
    console.error("Google sign-in flow failed:", error.message);
  }
}
