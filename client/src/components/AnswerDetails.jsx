// src/components/AnswerDetails.jsx
// Everything about one answer: verdict, the sentence, readings, meaning, XP and level changes.
// `entry` is a recent-answer entry (see RecentWords.jsx for its shape).
import { GIVE_UP } from "../lib/guess";
// import { levelName } from "../lib/levels";
import SentenceCard from "./SentenceCard";
import "../styles/AnswerDetails.css";

export default function AnswerDetails({ entry }) {
  // const moved = entry.level - entry.levelBefore;
  const alternates = entry.alternateReadings ?? [];

  return (
    <div className="answer">
      <p className={`answer__verdict ${entry.correct ? "is-correct" : "is-wrong"}`}>
        {entry.surface} {entry.correct ? "Correct" : "Incorrect"}
      </p>
      <div className="info">
        {!entry.correct && entry.guess !== GIVE_UP && (
          <>
            <p className={entry.correct ? "correct-guess" : "wrong-guess"}>
              Guess: <span lang="ja">{entry.guess}</span>
            </p>
            <p>
              Reading: <strong lang="ja">{entry.reading}</strong>
            </p>
          </>
        )}
        <div>
          {alternates.length > 0 && (
            <p>
              Also accepted: <span lang="ja">{alternates.join("、")}</span>
            </p>
          )}
        </div>
      </div>
      <hr />
      <p className="gloss">{entry.word.glosses.join("; ")}</p>
      <hr />
      <SentenceCard sentence={entry.sentence} level={entry.level} compact />
      {entry.translation && (
        <p className="answer__translation">{entry.translation}</p>
      )}
      {/* <p className="answer__progress">
				{entry.xpAwarded > 0 && <span>+{entry.xpAwarded} XP</span>}
				{moved > 0 && <span>Moved up to {levelName(entry.level)}</span>}
				{moved < 0 && <span>Back to {levelName(entry.level)}</span>}
				{entry.leveledUp && <strong>You reached level {entry.userLevel}!</strong>}
			</p> */}
    </div>
  );
}
