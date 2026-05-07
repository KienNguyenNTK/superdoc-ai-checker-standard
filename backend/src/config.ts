import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, "..");
export const PROJECT_DIR = path.resolve(ROOT_DIR, "..");
export const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(PROJECT_DIR, "storage");

export const PORT = Number(process.env.API_PORT || 8787);
export const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "http://localhost:5173";

export const MODEL = process.env.LOCAL_LLM_MODEL || "gpt-4o-mini";
export const BASE_URL =
  process.env.LOCAL_LLM_BASE_URL || "https://api.openai.com/v1";
export const API_KEY = process.env.LOCAL_LLM_API_KEY || "";
export const DEFAULT_MAX_ISSUES = Number(process.env.DEFAULT_MAX_ISSUES || 1000);

export const SUPERDOC_USER = {
  name: process.env.SUPERDOC_USER_NAME || "AI Spelling Checker",
  email: process.env.SUPERDOC_USER_EMAIL || "ai-checker@example.com",
};

const DEFAULT_DICTIONARY = [
  "8AM Coffee",
  "SuperDoc",
  "Ollama",
  "LM Studio",
  "LangGraph",
  "shadcn/ui",
  "Vite",
  "React",
  "OpenAI",
  "TypeScript",
  "Node.js",
  "DOCX",
  "Cold Brew",
  "Cascara",
  "Gesha",
  "Ethiopia Sidamo",
  "Americano",
];

export const CUSTOM_DICTIONARY = [
  ...DEFAULT_DICTIONARY,
  ...(process.env.CUSTOM_DICTIONARY || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
];

export const FILES_ROOT = path.join(STORAGE_DIR, "documents");
export const ANALYSIS_CACHE_ROOT = path.join(STORAGE_DIR, "analysis-cache");
export const CONFIG_ROOT = path.join(STORAGE_DIR, "config");
export const PROMPTS_DIR = path.join(CONFIG_ROOT, "prompts");
export const GLOBAL_GLOSSARY_PATH = path.join(CONFIG_ROOT, "glossary", "global-glossary.json");
