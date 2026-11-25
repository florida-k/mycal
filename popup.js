const accountTitle = document.getElementById("accountTitle");
const accountEmail = document.getElementById("accountEmail");
const accountDescription = document.getElementById("accountDescription");
const statusDot = document.getElementById("statusDot");
const guestActions = document.getElementById("guestActions");
const connectedActions = document.getElementById("connectedActions");
const statusMessage = document.getElementById("statusMessage");

const connectButton = document.getElementById("connectGoogle");
const signInButton = document.getElementById("signInGoogle");
const signOutButton = document.getElementById("signOut");

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function setBusy(busy) {
  connectButton.disabled = busy;
  signInButton.disabled = busy;
  signOutButton.disabled = busy;
}

async function sendMessage(type) {
  const response = await chrome.runtime.sendMessage({ type });

  if (!response?.ok) {
    throw new Error(
      response?.error || "Unable to connect to MyCal."
    );
  }

  return response.data;
}

async function loadAccount() {
  try {
    const account = await sendMessage("MYCAL_AUTH_STATUS");

    const connected = account.googleConnected;

    accountTitle.textContent = connected
      ? "Google connected"
      : "Guest account";

    statusDot.classList.toggle("connected", connected);

    accountEmail.hidden = !connected || !account.email;
    accountEmail.textContent = account.email || "";

    accountDescription.textContent = connected
      ? "Your assignment planning data is linked to your Google account."
      : "Connect Google to recover your saved assignment priorities, effort estimates, and notes across devices.";

    guestActions.hidden = connected;
    connectedActions.hidden = !connected;

    return true;

  } catch (error) {
    accountTitle.textContent = "Account unavailable";

    accountDescription.textContent =
      "Unable to load your MyCal account.";

    guestActions.hidden = true;
    connectedActions.hidden = true;
    accountEmail.hidden = true;
    statusDot.classList.remove("connected");

    showStatus(error.message, true);

    return false;
  }
}

async function authenticate(type) {
  setBusy(true);
  showStatus("Opening Google authentication...");

  try {
    await sendMessage(type);

    if (await loadAccount()) {
      showStatus("Account connected!");
    }

  } catch (error) {
    await loadAccount();
    showStatus(error.message, true);

  } finally {
    setBusy(false);
  }
}

async function signOut() {
  const confirmed = window.confirm(
    "Sign out of MyCal? Your Google-linked planning data " +
    "will remain saved. You can sign in again at any time."
  );

  if (!confirmed) return;

  setBusy(true);
  showStatus("Signing out...");

  try {
    await sendMessage("MYCAL_AUTH_SIGNOUT");

    if (await loadAccount()) {
      showStatus("Signed out. You are now using MyCal as a guest.");
    }

  } catch (error) {
    await loadAccount();
    showStatus(error.message, true);

  } finally {
    setBusy(false);
  }
}

connectButton.addEventListener("click", () => {
  authenticate("MYCAL_AUTH_LINK_GOOGLE");
});

signInButton.addEventListener("click", () => {
  const confirmed = window.confirm(
    "Signing into an existing MyCal account will switch " +
    "your current account. Planning data saved under this " +
    "guest account will not be merged. Continue?"
  );

  if (confirmed) {
    authenticate("MYCAL_AUTH_SIGNIN_GOOGLE");
  }
});

signOutButton.addEventListener("click", signOut);

document
  .getElementById("openCalendar")
  .addEventListener("click", () => {
    chrome.tabs.create({
      url: "https://ufl.instructure.com/calendar"
    });
  });

loadAccount();