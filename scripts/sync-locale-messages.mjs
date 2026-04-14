#!/usr/bin/env node
/**
 * Sync messages/*.json from messages/en.json (source of truth).
 * Uses Ollama for new/changed string values; falls back to English if Ollama is unreachable.
 * State in messages/.sync-state.json avoids re-translating unchanged keys.
 *
 * Usage:
 *   node scripts/sync-locale-messages.mjs           — all locales (zh, es, fr, de, pt, ar, he)
 *   node scripts/sync-locale-messages.mjs he       — Hebrew only
 *   npm run messages:sync -- he                    — same (npm needs "--" before args)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const messagesDir = path.join(root, "messages");
const statePath = path.join(messagesDir, ".sync-state.json");
const enPath = path.join(messagesDir, "en.json");

const TARGET_LOCALES = ["zh", "es", "fr", "de", "pt", "ar", "he"];

/** @param {string[]} argvSlice process.argv.slice(2), non-flag args only */
function resolveLocalesToSync(argvSlice) {
  if (argvSlice.length === 0) {
    return TARGET_LOCALES;
  }
  const unique = [...new Set(argvSlice)];
  const unknown = unique.filter((code) => !TARGET_LOCALES.includes(code));
  if (unknown.length > 0) {
    console.error(
      `[messages:sync] Unknown locale code(s): ${unknown.join(", ")}. Expected one or more of: ${TARGET_LOCALES.join(", ")}`,
    );
    process.exit(1);
  }
  return unique;
}

const LOCALE_LABELS = {
  zh: "Simplified Chinese",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  ar: "Modern Standard Arabic",
  he: "Hebrew",
};

const BATCH_SIZE = Number(process.env.OLLAMA_BATCH_SIZE || "18");
const BATCH_DELAY_MS = Number(process.env.OLLAMA_BATCH_DELAY_MS || "150");
const CHAT_TIMEOUT_MS = Number(process.env.OLLAMA_CHAT_TIMEOUT_MS || "180000");

function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

function hashText(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

/** @param {unknown} node @param {string} prefix */
function flattenStrings(node, prefix = "") {
  /** @type {Record<string, string>} */
  const out = {};
  if (node === null || node === undefined) return out;
  if (typeof node === "string") {
    if (prefix) out[prefix] = node;
    return out;
  }
  if (Array.isArray(node)) {
    return out;
  }
  if (typeof node === "object") {
    for (const k of Object.keys(node)) {
      const next = prefix ? `${prefix}.${k}` : k;
      Object.assign(out, flattenStrings(/** @type {object} */ (node)[k], next));
    }
  }
  return out;
}

/** @param {string} text */
function placeholderTokens(text) {
  const set = new Set();
  const re = /\{[^{}]+\}/g;
  let m;
  while ((m = re.exec(text)) !== null) set.add(m[0]);
  return set;
}

function placeholdersMatch(source, translated) {
  const a = [...placeholderTokens(source)].sort().join("\0");
  const b = [...placeholderTokens(translated)].sort().join("\0");
  return a === b;
}

function buildLocaleTreeFixed(enTree, flatLocale, flatEn, pathPrefix = "") {
  if (typeof enTree === "string") {
    return flatLocale[pathPrefix] ?? flatEn[pathPrefix];
  }
  if (enTree && typeof enTree === "object" && !Array.isArray(enTree)) {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const k of Object.keys(enTree)) {
      const child = /** @type {Record<string, unknown>} */ (enTree)[k];
      const nextPath = pathPrefix ? `${pathPrefix}.${k}` : k;
      out[k] = buildLocaleTreeFixed(child, flatLocale, flatEn, nextPath);
    }
    return out;
  }
  return enTree;
}

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** @param {string} content */
function parseJsonFromModel(content) {
  const trimmed = content.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in model response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

async function ollamaAvailable(baseUrl) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * @param {string} baseUrl
 * @param {string} model
 * @param {string} targetLabel
 * @param {Record<string, string>} batch path -> English text
 * @param {boolean} strict
 */
async function translateBatch(baseUrl, model, targetLabel, batch, strict) {
  const keys = Object.keys(batch);
  const userPayload = JSON.stringify(batch, null, 0);
  const system = [
    `You are a professional UI translator for a web app.`,
    `Translate every JSON value from English to ${targetLabel}.`,
    `Keep keys exactly as given (do not rename keys).`,
    `Preserve every placeholder like {count}, {title}, {slug}, {max}, {min}, {current}, {total}, {wordsPerPage} — same braces and names, same count.`,
    `Do not add explanations. Output a single JSON object only, same keys as input, values translated.`,
    strict
      ? `CRITICAL: Each output value must contain the exact same {placeholder} substrings as the input value for that key.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const url = `${baseUrl.replace(/\/$/, "")}/api/chat`;
  const body = {
    model,
    stream: false,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Translate these UI strings (JSON object path -> English). Return JSON only with the same keys:\n${userPayload}`,
      },
    ],
  };

  const timeoutSignal =
    typeof AbortSignal !== "undefined" && AbortSignal.timeout
      ? AbortSignal.timeout(CHAT_TIMEOUT_MS)
      : undefined;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: timeoutSignal,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Ollama HTTP ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = await res.json();
  const msg = data?.message?.content;
  if (typeof msg !== "string") {
    throw new Error("Ollama response missing message.content");
  }

  const parsed = parseJsonFromModel(msg);
  /** @type {Record<string, string>} */
  const out = {};
  for (const k of keys) {
    const v = parsed[k];
    if (typeof v !== "string") {
      throw new Error(`Missing or non-string translation for key: ${k}`);
    }
    out[k] = v;
  }
  return out;
}

async function main() {
  loadEnvFiles();

  const cliLocales = resolveLocalesToSync(
    process.argv.slice(2).filter((a) => !a.startsWith("-")),
  );
  if (cliLocales.length < TARGET_LOCALES.length) {
    console.log(
      `[messages:sync] Locales: ${cliLocales.join(", ")} (subset; other locale files unchanged).`,
    );
  }

  const ollamaHost =
    process.env.OLLAMA_HOST?.trim() || "http://127.0.0.1:11434";
  // const ollamaModel = process.env.OLLAMA_MODEL?.trim() || "qwen2.5";
  // const ollamaModel = process.env.OLLAMA_MODEL?.trim() || "llama3.1";
  const ollamaModel = process.env.OLLAMA_MODEL?.trim() || "gemma2:9b";

  if (!fs.existsSync(enPath)) {
    console.error(`Missing ${enPath}`);
    process.exit(1);
  }

  const enTree = loadJson(enPath, null);
  const flatEn = flattenStrings(enTree);
  const stateFileExisted = fs.existsSync(statePath);
  /** @type {Record<string, Record<string, string>>} */
  let state = loadJson(statePath, {});
  for (const loc of TARGET_LOCALES) {
    if (!state[loc] || typeof state[loc] !== "object") state[loc] = {};
  }

  const ollamaUp = await ollamaAvailable(ollamaHost);
  if (!ollamaUp) {
    console.warn(
      `[messages:sync] Ollama not reachable at ${ollamaHost} — using English for any new/changed keys.`,
    );
  }

  for (const locale of cliLocales) {
    const localePath = path.join(messagesDir, `${locale}.json`);
    const existingTree = fs.existsSync(localePath)
      ? loadJson(localePath, {})
      : {};
    let flatLocale = flattenStrings(existingTree);

    for (const pathKey of Object.keys(flatLocale)) {
      if (!(pathKey in flatEn)) {
        delete flatLocale[pathKey];
      }
    }

    const label = LOCALE_LABELS[locale] || locale;
    const localeState = state[locale];

    if (!stateFileExisted) {
      for (const pathKey of Object.keys(flatEn)) {
        const locVal = flatLocale[pathKey];
        if (typeof locVal === "string" && locVal !== flatEn[pathKey]) {
          localeState[pathKey] = hashText(flatEn[pathKey]);
        }
      }
    }

    /** @type {string[]} */
    const needTranslate = [];
    for (const pathKey of Object.keys(flatEn)) {
      const enText = flatEn[pathKey];
      const h = hashText(enText);
      const prev = localeState[pathKey];
      if (prev === h && typeof flatLocale[pathKey] === "string") {
        continue;
      }
      needTranslate.push(pathKey);
    }

    for (const k of Object.keys(localeState)) {
      if (!(k in flatEn)) {
        delete localeState[k];
      }
    }

    if (needTranslate.length > 0) {
      if (!ollamaUp) {
        for (const pathKey of needTranslate) {
          flatLocale[pathKey] = flatEn[pathKey];
          localeState[pathKey] = hashText(flatEn[pathKey]);
        }
        console.log(
          `[messages:sync] ${locale}: filled ${needTranslate.length} key(s) with English (no Ollama).`,
        );
      } else {
        for (let i = 0; i < needTranslate.length; i += BATCH_SIZE) {
          const slice = needTranslate.slice(i, i + BATCH_SIZE);
          /** @type {Record<string, string>} */
          const batch = {};
          for (const pk of slice) batch[pk] = flatEn[pk];

          let translated;
          try {
            translated = await translateBatch(
              ollamaHost,
              ollamaModel,
              label,
              batch,
              false,
            );
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(
              `[messages:sync] ${locale}: batch failed (${msg}), using English for batch.`,
            );
            translated = { ...batch };
          }

          for (const pk of slice) {
            let val = translated[pk];
            const src = flatEn[pk];
            if (!placeholdersMatch(src, val)) {
              try {
                const retry = await translateBatch(
                  ollamaHost,
                  ollamaModel,
                  label,
                  { [pk]: src },
                  true,
                );
                val = retry[pk];
              } catch {
                val = src;
              }
            }
            if (!placeholdersMatch(src, val)) {
              console.warn(
                `[messages:sync] ${locale}: placeholder mismatch for ${pk}, using English.`,
              );
              val = src;
            }
            flatLocale[pk] = val;
            localeState[pk] = hashText(src);
          }

          if (i + BATCH_SIZE < needTranslate.length && BATCH_DELAY_MS > 0) {
            await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
          }
        }
        console.log(
          `[messages:sync] ${locale}: translated ${needTranslate.length} key(s).`,
        );
      }
    }

    const outTree = buildLocaleTreeFixed(enTree, flatLocale, flatEn);
    saveJson(localePath, outTree);
  }

  saveJson(statePath, state);
  console.log("[messages:sync] Done.");
}

main().catch((e) => {
  console.error("[messages:sync] Fatal:", e);
  process.exit(1);
});
