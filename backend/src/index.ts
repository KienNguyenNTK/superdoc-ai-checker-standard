import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { FILES_ROOT, FRONTEND_ORIGIN, MODEL, PORT } from "./config.js";
import { createApp } from "./app.js";

await mkdir(FILES_ROOT, { recursive: true });

const app = createApp();

app.listen(PORT, () => {
  console.log(`Backend running: http://localhost:${PORT}`);
  console.log(`Frontend origin: ${FRONTEND_ORIGIN}`);
  console.log(`LLM model: ${MODEL}`);
});
