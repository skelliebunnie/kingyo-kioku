// src/pages/StudyPage.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { toHiragana } from "wanakana";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import RecentWords from "../components/RecentWords";
import SentenceCard from "../components/SentenceCard";
import SetPicker from "../components/SetPicker";
import XpToast, { toastDuration } from "../components/XpToast";
import XpBar from "../components/XpBar";

import { GIVE_UP } from "../lib/guess";
import { levelColor, levelName } from "../lib/levels";

import "../styles/levels.css";
import "../styles/StudyPage.css";

// How many recent answers the bar at the top keeps (newest first).
const MAX_RECENT = 10;
const addRecent = (prev, entry) => [entry, ...prev.filter((e) => e.id !== entry.id)].slice(0, MAX_RECENT);
// History from the server is older than anything answered since the page opened: append it, skipping duplicates.
const mergeRecent = (prev, fromServer) =>
  [...prev, ...fromServer.filter((s) => !prev.some((p) => p.id === s.id))].slice(0, MAX_RECENT);

// Answers worth stopping for open their details automatically: misses (so the right reading
// gets seen) and level-ups. Everything else just joins the bar; click a word to see its details.
// OG: !entry.correct || entry.leveledUp
const shouldAutoOpen = (entry) => false;

export default function StudyPage() {
  const { user: authUser, refresh } = useAuth();
  const { showTranslation } = useSettings();
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "empty" | "error"
  const [emptyReason, setEmptyReason] = useState(null);
  const [card, setCard] = useState(null);
  const [guess, setGuess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState({ answered: 0, correct: 0, xp: 0 });
  const [showLists, setShowLists] = useState(false);
  const [recent, setRecent] = useState([]); // latest answers, newest first
  const [open, setOpen] = useState(null); // { id, left } of the answer whose details are showing
  const [xpToast, setXpToast] = useState(null); // the floating "+N XP" pop-up, or null
  
  const [totalXP, setTotalXP] = useState(null); // XP/level as of the latest answer
  
  // XP bar: the signed-in user's progress at load, then whatever the server reports after each answer.
  const userXP =
    totalXP ??
    (authUser
      ? { xp: authUser.xp, level: authUser.level, xpIntoLevel: authUser.xpIntoLevel, xpForNext: authUser.xpForNext }
      : null);

  const inputRef = useRef(null);

  // Fetches the next card. Callers that want the loading state set it first.
  const fetchCard = useCallback(async () => {
    try {
      const { data } = await api.get("/cards/next");
      if (data.card) {
        setCard(data.card);
        setStatus("ready");
      } else {
        setCard(null);
        setEmptyReason(data.reason);
        setStatus("empty");
      }
    } catch (err) {
      setError(errorMessage(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  // Fill the recent-answers bar from history so it survives reloads and navigating away.
  useEffect(() => {
    let cancelled = false;
      api
        .get("/cards/recent", { params: { limit: MAX_RECENT } })
        .then(({ data }) => !cancelled && setRecent((prev) => mergeRecent(prev, data.recent)))
        .catch(() => {}); // the bar is a nicety; ignore failures
      return () => {
        cancelled = true;
      };
  }, [session.answered]);
  
  // Make sure the signed-in user's XP isn't left over from earlier in the visit.
    useEffect(() => {
      refresh().catch(() => {});
    }, [refresh]);
  
    // The XP pop-up disappears on its own after a moment.
    useEffect(() => {
      if (!xpToast) return;
      const timer = setTimeout(() => setXpToast(null), toastDuration(xpToast));
      return () => clearTimeout(timer);
    }, [xpToast]);

  // Keyboard flow: type -> Enter -> the next card appears with the cursor already in the box.
  useEffect(() => {
    if (status === "ready" && !submitting) inputRef.current?.focus();
  }, [status, card, submitting]);

  const toggleOpen = useCallback((id, left) => setOpen((o) => (o?.id === id ? null : { id, left })), []);
  const closeOpen = useCallback(() => setOpen(null), []);

  function reload() {
    setError("");
    setStatus("loading");
    fetchCard();
  }

  // While an IME is composing, leave the text alone; otherwise turn romaji into hiragana as it's typed.
  function handleChange(e) {
    const value = e.target.value;
    setGuess(e.nativeEvent.isComposing ? value : toHiragana(value, { IMEMode: true }));
  }

  async function submitAnswer(text) {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/cards/answer", {
        wordId: card.wordId,
        sentenceId: card.sentenceId,
        guess: text,
      });
      const { result, user } = data;
      const entry = {
        id: result.reviewId,
        wordId: card.wordId,
        sentenceId: card.sentenceId,
        surface: result.surface,
        correct: result.correct,
        guess: text,
        reading: result.expectedReading,
        alternateReadings: result.alternateReadings,
        level: result.levelAfter,
        levelBefore: result.levelBefore,
        xpAwarded: result.xpAwarded,
        sentence: card.sentence,
        translation: result.translation,
        word: result.word,
        leveledUp: user.leveledUp,
        userLevel: user.level,
      };

      setRecent((prev) => addRecent(prev, entry));
      setTotalXP({ xp: user.xp, level: user.level, xpIntoLevel: user.xpIntoLevel, xpForNext: user.xpForNext });
      // The new answer is always the leftmost chip, so its panel lines up at 0.
      setOpen(shouldAutoOpen(entry) ? { id: entry.id, left: 0 } : null);
      if (result.xpAwarded > 0) {
        setXpToast({
          key: result.reviewId,
          gained: result.xpAwarded,
          total: user.xp,
          level: user.level,
          xpIntoLevel: user.xpIntoLevel,
          xpForNext: user.xpForNext,
          leveledUp: user.leveledUp,
        });
      }
      setSession((s) => ({
        answered: s.answered + 1,
        correct: s.correct + (result.correct ? 1 : 0),
        xp: s.xp + result.xpAwarded,
      }));

      // Straight on to the next card.
      setGuess("");
      if (data.next) setCard(data.next);
      else reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const text = toHiragana(guess.trim()); // final pass: a trailing "n" becomes ん
    if (text) submitAnswer(text);
  }

  function handleListsSaved() {
    setShowLists(false);
    setOpen(null);
    setGuess("");
    reload();
  }

  if (status === "loading") return <p>Loading…</p>;

  if (status === "error") {
    return (
      <section className="flashcards">
        <p className="flash__error" role="alert">
          {error}
        </p>
        <div>
          <button type="button" onClick={reload}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (status === "empty") {
    return (
      <section className="flashcards">
        <h1>Word lists</h1>
        <p>
          {emptyReason === "no_active_sets"
            ? "Choose at least one word list to start practicing."
            : "The lists you've selected don't have any cards yet. Choose another list."}
        </p>
        <SetPicker onSaved={handleListsSaved} />
      </section>
    );
  }

  return (
    <>
      <RecentWords entries={recent} open={open} onToggle={toggleOpen} onClose={closeOpen} />
      <section className="flashcards">
        <div className="flash__meta">
          {/* <span className="flash__badge">
            <span className="flash__swatch" style={{ background: levelColor(card.level) }} aria-hidden="true" />
            {levelName(card.level)}
          </span> */}
          {card.isNew && <span className="flash__new">New word!</span>}
        </div>

        <SentenceCard sentence={card.sentence} level={card.level} />
        {showTranslation && card.translation && <p className="flash__translation">{card.translation}</p>}

        <form className="flash__form" onSubmit={handleSubmit}>
          {/* <label htmlFor="reading">Reading of the highlighted word</label> */}
          <input
            id="reading"
            ref={inputRef}
            lang="ja"
            value={guess}
            onChange={handleChange}
            placeholder="Type in romaji or kana"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={submitting}
          />
          {error && (
            <p className="flash__error" role="alert">
              {error}
            </p>
          )}
          <div className="flash__actions">
            <button type="submit" disabled={submitting || !guess.trim()}>
              Check
            </button>
            <button type="button" className="button__warn" onClick={() => submitAnswer(GIVE_UP)} disabled={submitting}>
              I don't know
            </button>
          </div>
        </form>
      </section>
      <footer className="session-info">
        <XpToast toast={xpToast} />
        <div>
          <p><strong>Current Session:</strong> <span className="correct">{session ? session.correct : 0} correct </span> / <span className="seen">{session ? session.answered : 0} seen</span></p>
          <button type="button" className="button__info" aria-expanded={showLists} onClick={() => setShowLists((v) => !v)}>
              Word lists
          </button>
          {showLists && <SetPicker onSaved={handleListsSaved} />}
        </div>
        <XpBar progress={userXP} />
      </footer>
    </>
  );
}
