// src/pages/AuthPage.jsx
import { useState } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../api/client";
import "../styles/auth.css";

const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;

// Returns an error message, or "" if the form is fine. Mirrors the server's rules.
function validate(mode, form) {
	if (mode === "login") {
		if (!form.identifier.trim() || !form.password) return "Enter your username or email and your password.";
		return "";
	}
	if (!USERNAME_RE.test(form.username)) return "Username must be 3–30 letters, numbers or underscores.";
	if (!form.email.includes("@")) return "Enter a valid email address.";
	if (form.password.length < 8) return "Password must be at least 8 characters.";
	if (form.password !== form.confirm) return "Passwords don't match.";
	return "";
}

export default function AuthPage() {
	const { user, loading, login, register } = useAuth();
	const location = useLocation();

	const [mode, setMode] = useState("login"); // "login" | "signup"
	const [form, setForm] = useState({ identifier: "", username: "", email: "", password: "", confirm: "" });
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	// Already signed in (or just signed in): go where the user was headed, or to their profile.
	if (!loading && user) return <Navigate to={location.state?.from?.pathname ?? "/profile"} replace />;

	const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

	const switchMode = (next) => {
		setMode(next);
		setError("");
	};

	async function handleSubmit(e) {
		e.preventDefault();
		const problem = validate(mode, form);
		if (problem) return setError(problem);

		setError("");
		setSubmitting(true);
		try {
			if (mode === "login") await login(form.identifier.trim(), form.password);
			else await register({ username: form.username, email: form.email.trim(), password: form.password });
		} catch (err) {
			setError(errorMessage(err));
			setSubmitting(false);
		}
	}

	const isLogin = mode === "login";

	return (
		<section className="auth">
			<div className="auth__tabs">
				<button type="button" aria-pressed={isLogin} onClick={() => switchMode("login")}>
					Log in
				</button>
				<button type="button" aria-pressed={!isLogin} onClick={() => switchMode("signup")}>
					Create account
				</button>
			</div>

			<form className="auth__form" onSubmit={handleSubmit} noValidate>
				<h1>{isLogin ? "Log in" : "Create your account"}</h1>

				{isLogin ? (
					<label>
						Username or email
						<input value={form.identifier} onChange={update("identifier")} autoComplete="username" autoFocus />
					</label>
				) : (
					<>
						<label>
							Username
							<input value={form.username} onChange={update("username")} autoComplete="username" autoFocus />
						</label>
						<label>
							Email
							<input type="email" value={form.email} onChange={update("email")} autoComplete="email" />
						</label>
					</>
				)}

				<label>
					Password
					<input
						type="password"
						value={form.password}
						onChange={update("password")}
						autoComplete={isLogin ? "current-password" : "new-password"}
					/>
				</label>

				{!isLogin && (
					<label>
						Confirm password
						<input type="password" value={form.confirm} onChange={update("confirm")} autoComplete="new-password" />
					</label>
				)}

				{error && (
					<p className="auth__error" role="alert">
						{error}
					</p>
				)}

				<button type="submit" disabled={submitting}>
					{submitting ? "Please wait…" : isLogin ? "Log in" : "Create account"}
				</button>
			</form>
		</section>
	);
}
