// src/api/client.js
import axios from "axios";

// The API is always reached at /api on the same origin as the page: through Vite's dev proxy
// (see vite.config.js) while developing, and through Vercel's rewrites in production. That keeps
// the httpOnly session cookie first-party and means no CORS setup. Set VITE_API_URL only if you
// deliberately host the API somewhere else.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  withCredentials: true,
});

// Turns an axios error into a message that's safe to show to the user.
export function errorMessage(err, fallback = "Something went wrong. Try again.") {
  if (err.response?.data?.error) return err.response.data.error;
  if (err.request && !err.response) return "Can't reach the server. Check that it's running.";
  return fallback;
}

export default api;