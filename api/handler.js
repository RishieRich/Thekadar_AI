// Vercel serverless function — handles all /api/* routes.
// Static assets are served by Vercel's CDN from the Vite build output.
export { handleRequest as default } from "../server/router.mjs";
