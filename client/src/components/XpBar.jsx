// src/components/XpBar.jsx
// The user's level and total XP with a progress bar toward the next level, always visible.
// Hovering (or focusing) the bar shows a small card with the details, like the XP pop-up does.
//
// `progress` is { xp, level, xpIntoLevel, xpForNext } (xpForNext is null at the maximum level),
// or null while it isn't known yet.
import { useId } from "react";
import "../styles/XpBar.css";

const number = new Intl.NumberFormat();

export default function XpBar({ progress }) {
  const tipId = useId();
  if (!progress) return null;

  const { xp, level, xpIntoLevel, xpForNext } = progress;
  const atMax = xpForNext === null;
  const percent = atMax ? 100 : Math.min(100, (xpIntoLevel / xpForNext) * 100);
  const remaining = atMax ? 0 : xpForNext - xpIntoLevel;

  const valueText = atMax
    ? `Level ${level}, max level, ${number.format(xp)} XP total`
    : `Level ${level}, ${number.format(xpIntoLevel)} of ${number.format(xpForNext)} XP, ${number.format(remaining)} to level ${level + 1}`;

  return (
    <div className="xpbar">
      <span className="xpbar__level">Level {level}</span>

      <div
        className="xpbar__bar"
        tabIndex={0}
        role="progressbar"
        aria-label="Experience"
        aria-valuemin={0}
        aria-valuemax={atMax ? 1 : xpForNext}
        aria-valuenow={atMax ? 1 : xpIntoLevel}
        aria-valuetext={valueText}
        aria-describedby={tipId}
      >
        <div className="xpbar__track">
          <div className="xpbar__fill" style={{ width: `${percent}%` }} />
        </div>

        <div id={tipId} role="tooltip" className="xpbar__tip">
          {/* <p className="xpbar__tip-title">
            Level {level}, {number.format(xp)} XP total
          </p> */}
          {atMax ? (
            <p>Max level reached</p>
          ) : (
            <>
              <p className="xpbar__tip-next">
                {number.format(remaining)} XP to level {level + 1}
              </p>
              {/* <p className="xpbar__tip-detail">
                {number.format(xpIntoLevel)} / {number.format(xpForNext)} XP this level
              </p> */}
            </>
          )}
        </div>
      </div>

      <span className="xpbar__total">{number.format(xp)} XP</span>
    </div>
  );
}
