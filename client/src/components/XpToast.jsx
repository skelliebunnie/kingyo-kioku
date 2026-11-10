// src/components/XpToast.jsx
// A small floating pop-up that shows the XP just earned plus the user's running total, then fades
// out on its own (StudyPage clears `toast` after toastDuration(toast)).
//
// `toast` is null, or { key, gained, total, level, xpIntoLevel, xpForNext, leveledUp }.
// `key` changes with every answer so a new pop-up restarts the animation instead of reusing the old one.
import "../styles/XpToast.css";

const number = new Intl.NumberFormat();

const DEFAULT_MS = 2600;
const LEVEL_UP_MS = 4000;

// How long the pop-up stays up; also drives the CSS animation so the two never drift apart.
export const toastDuration = (toast) => (toast.leveledUp ? LEVEL_UP_MS : DEFAULT_MS);

export default function XpToast({ toast }) {
  const percent =
    toast && toast.xpForNext ? Math.min(100, (toast.xpIntoLevel / toast.xpForNext) * 100) : 100;

  // The live region is always mounted so screen readers announce each pop-up as it appears.
  return (
    <div className="xp-region" role="status" aria-live="polite">
      {toast && (
        <div
          key={toast.key}
          className={`xp-toast${toast.leveledUp ? " is-level-up" : ""}`}
          style={{ animationDuration: `${toastDuration(toast)}ms` }}
        >
          {toast.leveledUp && <p className="xp-toast__levelup">Level up!</p>}
          <p className="xp-toast__gain">+{number.format(toast.gained)} XP</p>
          <p className="xp-toast__total">
            Level {toast.level}, {number.format(toast.total)} XP total
          </p>
          {toast.xpForNext !== null && (
            <div className="xp-toast__bar" aria-hidden="true">
              <div className="xp-toast__fill" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
