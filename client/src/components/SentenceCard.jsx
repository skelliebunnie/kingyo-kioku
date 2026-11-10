// src/components/SentenceCard.jsx
// An example sentence with the target word highlighted in the color of its level.
// `sentence` is { before, target, after } as sent by GET /cards/next. `compact` is for small spaces.
import { levelColor, levelName } from "../lib/levels";
import "../styles/levels.css";
import "../styles/SentenceCard.css";

export default function SentenceCard({ sentence, level, compact = false }) {
  return (
    <p className={compact ? "sentence sentence--compact" : "sentence"} lang="ja">
      {sentence.before}
      <mark className="sentence__target" data-level={level} title={levelName(level)} style={{ "--lv": levelColor(level) }}>
        {sentence.target}
      </mark>
      {sentence.after}
    </p>
  );
}
