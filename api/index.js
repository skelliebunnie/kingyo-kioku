// api/index.js
// Vercel runs everything in /api as serverless functions. This one wraps the whole Express app, and
// vercel.json rewrites every /api/... request to it (Express then does its own routing).
import { createApp } from "../server/src/app.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
	throw new Error("Set JWT_SECRET in the Vercel project's environment variables (32+ characters)");
}

export default createApp();