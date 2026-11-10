// src/components/SetPicker.jsx
// Choose which word lists are in rotation (the only user setting).
import { useEffect, useState } from "react";
import api, { errorMessage } from "../api/client";
import "../styles/SetPicker.css";

export default function SetPicker({ onSaved }) {
	const [sets, setSets] = useState(null);
	const [selected, setSelected] = useState(() => new Set());
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		let cancelled = false;
		api
			.get("/sets")
			.then(({ data }) => {
				if (cancelled) return;
				setSets(data.sets);
				setSelected(new Set(data.sets.filter((s) => s.active).map((s) => s.id)));
			})
			.catch((err) => !cancelled && setError(errorMessage(err)));
		return () => {
			cancelled = true;
		};
	}, []);

	const toggle = (id) =>
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	async function save() {
		setSaving(true);
		setError("");
		try {
			await api.put("/sets/active", { setIds: [...selected] });
			onSaved?.();
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setSaving(false);
		}
	}

	if (!sets) return error ? <p role="alert">{error}</p> : <p>Loading word lists…</p>;

	return (
		<div className="set-picker">
			<fieldset>
				<legend>Word lists to practice</legend>
				{sets.map((set) => (
					<label key={set.id} className="set-picker__option">
						<input
							type="checkbox"
							checked={selected.has(set.id)}
							disabled={set.wordCount === 0}
							onChange={() => toggle(set.id)}
						/>
						<span>
							{set.name} <span className="set-picker__count">({set.wordCount} words)</span>
						</span>
					</label>
				))}
			</fieldset>

			{error && <p role="alert">{error}</p>}

			<button type="button" onClick={save} disabled={saving || selected.size === 0}>
				{saving ? "Saving…" : "Save word lists"}
			</button>
		</div>
	);
}
