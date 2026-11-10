// src/components/RecentWords.jsx
// A horizontal bar of the latest answers, newest on the left. Click (or press Enter on) a word to
// drop down the full details of that answer. Only one is open at a time.
//
// Each entry (built in StudyPage, and returned by GET /cards/recent) looks like:
//   {
//     id, wordId, sentenceId,
//     surface,            // the word exactly as it appeared in the sentence, e.g. 食べた
//     correct,            // true / false
//     guess,              // what the user typed
//     reading,            // the correct reading of `surface`
//     alternateReadings,  // other accepted readings
//     level,              // how well known the word is now (0-4)
//     levelBefore,
//     xpAwarded,
//     sentence,           // { before, target, after }
//     translation,
//     word,               // { written, reading, glosses } (dictionary form)
//     leveledUp, userLevel  // only on answers given in this session
//   }
//
// `open` is { id, left } or null: which entry is open, and the chip's left offset in px so the
// panel lines up under it. The parent owns it, so it can open the newest answer by itself.
import { useEffect, useId, useRef } from "react";
import { Check, X } from "lucide-react";

import AnswerDetails from "./AnswerDetails";
import "../styles/RecentWords.css";

export default function RecentWords({ entries, open, onToggle, onClose }) {
  const wrapRef = useRef(null);
  const panelId = useId();
  const openEntry = open ? entries.find((e) => e.id === open.id) : null;

  // Close on Escape, or on a click outside the bar and its panel.
  useEffect(() => {
    if (!openEntry) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    const onPointer = (e) => !wrapRef.current?.contains(e.target) && onClose();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [openEntry, onClose]);
  console.log(openEntry);

  return (
    <div className="recent-wrap" ref={wrapRef}>
      {entries.length > 0 && 
        <>
          <ol className="recent" aria-label="Recent answers">
            {entries.map((entry) => {
              const isOpen = openEntry?.id === entry.id;
              return (
                <li key={entry.id}>
                  <div
                    className={`recent__item ${entry.correct ? "is-correct" : "is-wrong"}`}
                    aria-expanded={false}
                    aria-controls={isOpen ? panelId : undefined}
                    onClick={(e) => onToggle(entry.id, e.currentTarget.parentElement.offsetLeft)}
                  >
                    <div className="recent__word" lang="ja">
                      {entry.surface}
                    </div>
                    <div className="data">
                      <p className={entry.correct ? 'correct active' : 'correct'}><Check /> {entry.reading}</p>
                      <p className={!entry.correct ? 'incorrect active' : 'incorrect'}><X /> {!entry.correct ? entry.guess : ''}</p>
                    </div>
                    
                    {/* <span className="recent__mark" aria-hidden="true">
                      {entry.correct ? "✓" : "✗"}
                    </span>
                    <span className="recent__sr">{entry.correct ? "correct" : "incorrect"}</span> */}
                  </div>
                </li>
              );
            })}
          </ol>

          {openEntry && (
            <div id={panelId} className={openEntry?.correct ? 'recent__panel correct' : 'recent__panel incorrect'} role="status" style={{ "--chip-left": `${open.left}px` }}>
              <AnswerDetails entry={openEntry} />
            </div>
          )}
        </>
      }
      {entries.length === 0 && <div className="history"><h2>HISTORY</h2></div>}
    </div>
  );
}
