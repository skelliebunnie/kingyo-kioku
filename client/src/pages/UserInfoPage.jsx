// src/pages/UserInfoPage.jsx
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/UserInfoPage.css";

const number = new Intl.NumberFormat();

export default function UserInfoPage() {
	const { user, stats, refresh, logout } = useAuth();

	// Pick up anything that changed since the page was last loaded (e.g. after a review session).
	useEffect(() => {
		refresh().catch(() => {}); // keep showing the data we already have if this fails
	}, [refresh]);

	if (!user || !stats) return null; // <ProtectedRoute> makes sure we're signed in

	const atMaxLevel = user.xpForNext === null;
	const percent = atMaxLevel ? 100 : Math.min(100, (user.xpIntoLevel / user.xpForNext) * 100);
	const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	return (
		<section className="profile">
			<header className="profile__header">
				<h1>{user.username}</h1>
				<p>
					{user.email} · Member since {memberSince}
				</p>
			</header>

			<div className="profile__level">
				<p className="profile__level-number">Level {user.level}</p>
				<div
					className="xp-bar"
					role="progressbar"
					aria-label="Progress to next level"
					aria-valuemin={0}
					aria-valuemax={atMaxLevel ? 1 : user.xpForNext}
					aria-valuenow={atMaxLevel ? 1 : user.xpIntoLevel}
				>
					<div className="xp-bar__fill" style={{ width: `${percent}%` }} />
				</div>
				<p className="profile__xp">
					{atMaxLevel
						? `Max level reached · ${number.format(user.xp)} XP`
						: `${number.format(user.xpIntoLevel)} / ${number.format(user.xpForNext)} XP to level ${user.level + 1}`}
				</p>
			</div>

			<dl className="profile__stats">
				<div>
					<dt>Words seen</dt>
					<dd>{number.format(stats.wordsIntroduced)}</dd>
				</div>
				<div>
					<dt>Words mastered</dt>
					<dd>{number.format(stats.wordsMastered)}</dd>
				</div>
				<div>
					<dt>Cards reviewed</dt>
					<dd>{number.format(stats.cardsSeen)}</dd>
				</div>
				<div>
					<dt>Accuracy</dt>
					<dd>{stats.accuracy === null ? "—" : `${Math.round(stats.accuracy * 100)}%`}</dd>
				</div>
			</dl>

			<button type="button" className="button__info" onClick={logout}>
				Log out
			</button>
		</section>
	);
}
