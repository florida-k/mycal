
(() => {
  "use strict";

  if (window.__mycalThemeLoaded) return;
  window.__mycalThemeLoaded = true;

  const STORAGE_KEY = "mycal_theme";

  const THEMES = {
    forest: {
      name: "Forest",
      accent: "#21664f",
      dark: "#234c3b",
      light: "#e6f1e9"
    },
    ocean: {
      name: "Ocean",
      accent: "#2563a6",
      dark: "#194b80",
      light: "#e5f0fc"
    },
    lavender: {
      name: "Lavender",
      accent: "#7556ae",
      dark: "#573e8b",
      light: "#f0eafa"
    },
    rose: {
      name: "Rose",
      accent: "#b34f72",
      dark: "#873653",
      light: "#fbeaf0"
    },
    amber: {
      name: "Amber",
      accent: "#946016",
      dark: "#70460f",
      light: "#fff2d7"
    }
  };

  let currentTheme = "forest";

  function applyTheme(themeId) {
    const theme = THEMES[themeId] || THEMES.forest;
    currentTheme = THEMES[themeId] ? themeId : "forest";

    const root = document.documentElement;

    root.style.setProperty("--mycal-accent", theme.accent);
    root.style.setProperty("--mycal-accent-dark", theme.dark);
    root.style.setProperty("--mycal-accent-light", theme.light);

    document.querySelectorAll(".mycal-theme-option").forEach(button => {
      const selected = button.dataset.theme === currentTheme;
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("is-selected", selected);
    });
  }

  async function saveTheme(themeId) {
    if (!THEMES[themeId]) return;

    applyTheme(themeId);

    try {
      await chrome.storage.local.set({
        [STORAGE_KEY]: themeId
      });
    } catch (error) {
      console.error("MyCal: Unable to save theme", error);
    }
  }


function mountSettings() {
  // Canvas's sidebar contains the UNDATED section.
  const rightSide = document.querySelector("#right-side");
  if (!rightSide) return false;

  // Don't create duplicate controls.
  if (document.getElementById("mycal-theme-panel")) return true;

  const card = document.createElement("div");
  card.id = "mycal-theme-panel";

  card.innerHTML = `
    <span class="mycal-theme-label">
        Appearance
    </span>

    <div class="mycal-theme-options"
         role="group"
         aria-label="Choose MyCal accent color">
      ${Object.entries(THEMES).map(([id, theme]) => `
        <button
          type="button"
          class="mycal-theme-option"
          data-theme="${id}"
          aria-label="${theme.name} theme"
          aria-pressed="false"
          title="${theme.name}"
        >
          <span class="mycal-theme-swatch"
                style="background:${theme.accent}"></span>
        </button>
      `).join("")}
    </div>
  `;

  // Find the UNDATED heading within Canvas's right sidebar.
  const undatedHeading = [...rightSide.querySelectorAll(
    "h2, h3, h4, button"
  )].find(el => el.textContent.trim().toUpperCase() === "UNDATED");

  if (undatedHeading) {
    // Insert immediately before the section containing the heading.
    const section = undatedHeading.closest(
      "section, .events_list, .undated-events"
    );

    if (section && section !== rightSide) {
      section.parentNode.insertBefore(card, section);
    } else {
      undatedHeading.parentNode.insertBefore(card, undatedHeading);
    }
  } else {
    // Canvas may still be loading the UNDATED section.
    // Fall back to the bottom of the right sidebar.
    rightSide.appendChild(card);
  }

  card.addEventListener("click", event => {
    const button = event.target.closest(".mycal-theme-option");
    if (!button) return;

    saveTheme(button.dataset.theme);
  });

  applyTheme(currentTheme);
  return true;
}


  async function initialize() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      applyTheme(result[STORAGE_KEY] || "forest");
    } catch (error) {
      console.warn("MyCal: Could not load saved theme", error);
      applyTheme("forest");
    }

    mountSettings();
  }

  // Load the saved preference when Canvas opens.
  initialize();

  // The sidebar is inserted asynchronously by the existing extension.
  const timer = setInterval(() => {
    if (mountSettings()) clearInterval(timer);
  }, 500);

  // Keep the selected theme in sync with storage changes.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      applyTheme(changes[STORAGE_KEY].newValue || "forest");
    }
  });

  // Existing MyCal sidebar refreshes replace its children.
  // Reattach the settings card when necessary.
const observer = new MutationObserver(() => {
  if (
    document.querySelector("#right-side") &&
    !document.getElementById("mycal-theme-panel")
  ) {
    mountSettings();
  }
});

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
