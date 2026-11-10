// src/context/AuthProvider.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { AuthContext } from "./AuthContext";

export default function AuthProvider({ children }) {
	// `user` is the response of GET /user ({ user, stats }), or null when signed out.
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	// Reloads the signed-in user's data. A 401 means signed out; other errors are rethrown.
	const refresh = useCallback(async () => {
		try {
			const { data } = await api.get("/user");
			setUser(data);
		} catch (err) {
			if (err.response?.status === 401) setUser(null);
			else throw err;
		}
	}, []);

	// On first load, find out whether the session cookie is still valid.
	useEffect(() => {
		refresh()
			.catch(() => setUser(null))
			.finally(() => setLoading(false));
	}, [refresh]);

	const login = useCallback(
		async (identifier, password) => {
			await api.post("/auth/login", { identifier, password });
			await refresh();
		},
		[refresh]
	);

	const register = useCallback(
		async ({ username, email, password }) => {
			await api.post("/auth/register", { username, email, password });
			await refresh();
		},
		[refresh]
	);

	const logout = useCallback(async () => {
		try {
			await api.post("/auth/logout");
		} finally {
			setUser(null);
		}
	}, []);

	const value = useMemo(
		() => ({ user: user?.user ?? null, stats: user?.stats ?? null, loading, login, register, logout, refresh }),
		[user, loading, login, register, logout, refresh]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
