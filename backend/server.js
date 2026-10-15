// Compatibility entry point for hosts still configured with `node server.js`.
// The real server is written in TypeScript (server.ts) and compiled to
// dist/ by `npm run build`, which runs automatically after `npm install`.
import "./dist/server.js";
