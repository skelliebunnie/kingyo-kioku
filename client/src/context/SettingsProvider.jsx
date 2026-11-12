// src/context/SettingsProvider.jsx
// Site-wide display options (theme, handwritten Japanese font), remembered in the browser's
// localStorage. Nothing is sent to the server.
//
// Put the result on your page wrapper:
//   const { wrapperClasses } = useSettings();
//   <div className={`page-wrapper ${wrapperClasses}`}>   ->  "page-wrapper dark jp-handwritten"
import { useCallback, useEffect, useMemo, useState } from "react";
import { THEMES } from "../lib/themes";
import { SettingsContext } from "./SettingsContext";

const STORAGE_KEY = "kingyo-options";
export const HANDWRITTEN_CLASS = "jp-handwritten";

// First visit: follow the operating system's light/dark setting.
function systemTheme() {
  const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const id = dark ? "dark" : "light";
  return THEMES.some((t) => t.id === id) ? id : THEMES[0].id;
}

function load() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    // unreadable or unavailable storage: fall back to defaults
  }
  const themeIsKnown = THEMES.some((t) => t.id === saved?.theme);
  return {
    theme: themeIsKnown ? saved.theme : systemTheme(),
    handwritten: saved?.handwritten === true,
    showTranslation: saved?.showTranslation === true,
  };
}

function save(options) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // private mode or a full quota: the setting just won't outlive this page
  }
}

export default function SettingsProvider({ children }) {
  const [options, setOptions] = useState(load);

  // Only written when the user changes something, so the OS preference isn't frozen on first visit.
  const update = useCallback(
    (patch) => {
      const next = { ...options, ...patch };
      setOptions(next);
      save(next);
    },
    [options]
  );

  // Tell the browser whether the current theme is light or dark, so system colors and form
  // controls follow it everywhere, including pop-ups that render outside .page-wrapper.
  useEffect(() => {
    document.documentElement.style.colorScheme = THEMES.find((t) => t.id === options.theme)?.scheme ?? "light";
    return () => {
      document.documentElement.style.colorScheme = "";
    };
  }, [options.theme]);

  const value = useMemo(
    () => ({
      theme: options.theme,
      handwritten: options.handwritten,
      themes: THEMES,
      showTranslation: options.showTranslation,
      setTheme: (theme) => update({ theme }),
      setHandwritten: (handwritten) => update({ handwritten }),
      setShowTranslation: (showTranslation) => update({ showTranslation }),
      wrapperClasses: [options.theme, options.handwritten && HANDWRITTEN_CLASS].filter(Boolean).join(" "),
    }),
    [options, update]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
