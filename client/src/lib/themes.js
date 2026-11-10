// src/lib/themes.js
// The themes offered in the Options menu.
//   id      the class added to .page-wrapper (so your CSS targets .light, .dark, ...)
//   label   what the menu shows
//   scheme  "light" or "dark": tells the browser which one this theme is, so built-in colors
//           (form controls, scrollbars, and the system colors some components use) match it
//
// To add a theme: add a line here, then write the CSS for its class.
export const THEMES = [
  { id: "goldfish", label: "Goldfish", scheme: "goldfish" },
  { id: "dark", label: "Dark", scheme: "dark" },
  { id: "candy", label: "Candy", scheme: "candy" },
  { id: "melon", label: "Melon", scheme: "melon" },
  { id: "sakura", label: "Sakura", scheme: "sakura" },
];