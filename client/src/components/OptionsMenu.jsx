// src/components/OptionsMenu.jsx
// A small "Options" button that drops down the site-wide display settings.
//
// Put it in your Navbar (on the right is the usual spot): <OptionsMenu />
// Or let it float in the bottom-left corner of the window: <OptionsMenu floating />
//   align   which edge of the button the dropdown lines up with: "right" (default) or "left"
import { useEffect, useId, useRef, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import "../styles/OptionsMenu.css";

export default function OptionsMenu({ floating = false, align = "right", mobile = false, desktop = false }) {
  const { theme, setTheme, themes, handwritten, setHandwritten, showTranslation, setShowTranslation } = useSettings();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const id = useId();

  // Close on Escape (returning focus to the button) or on a click outside the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className={`options${floating ? " options--floating" : ""} ${mobile ? " options--mobile" : desktop ? "options--desktop" : ""}`} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="options__button"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        Options
      </button>

      {open && (
        <div id={`${id}-panel`} className={`options__panel options__panel--${align}`} role="dialog" aria-label="Options">
          <fieldset className="options__group">
            <legend>Theme</legend>
            {themes.map((t) => (
              <label key={t.id} className="options__choice">
                <input type="radio" name={`${id}-theme`} value={t.id} checked={theme === t.id} onChange={() => setTheme(t.id)} />
                {t.label}
              </label>
            ))}
          </fieldset>

          <label className="options__choice">
            <input type="checkbox" checked={handwritten} onChange={(e) => setHandwritten(e.target.checked)} />Handwriting Font (JP)
          </label>
          <label className="options__choice">
            <input type="checkbox" checked={showTranslation} onChange={(e) => setShowTranslation(e.target.checked)} />
            Show English sentence
          </label>
        </div>
      )}
    </div>
  );
}
