
import { supabase } from "./supabase-client.js";

export async function testGoogleLink() {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("No existing Supabase session.");
    return;
  }

  const originalUserId = sessionData.session.user.id;
  const redirectTo = chrome.identity.getRedirectURL();

  console.log("Original Supabase user ID:", originalUserId);

  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    console.error("Google linking failed:", error.message);
    return;
  }

  if (!data?.url) {
    console.error("Supabase did not return an OAuth URL.");
    return;
  }

  console.log("Google linking URL generated successfully.");

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

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      throw exchangeError;
    }

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    console.log("Google identity linking completed!");
    console.log("User ID after linking:", userData.user.id);
    console.log(
      "Same user ID:",
      userData.user.id === originalUserId
    );
    console.log(
      "Linked providers:",
      userData.user.identities?.map(identity => identity.provider)
    );
  } catch (error) {
    console.error("Google OAuth flow failed:", error.message);
  }
}
