import * as fs from "node:fs";
import * as os from "node:os";

function findSystemChrome(): string | undefined {
  const platform = os.platform();
  if (platform === "darwin") {
    const candidates = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  if (platform === "linux") {
    const candidates = [
      process.env.CHROME_PATH,
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ].filter((p): p is string => Boolean(p));
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  if (platform === "win32") {
    const pf = process.env["PROGRAMFILES"] || "C:\\Program Files";
    const pfx86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    const candidates = [
      `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pfx86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

/**
 * Path to a Chrome/Chromium binary for Puppeteer PDF export.
 * Order: PUPPETEER_EXECUTABLE_PATH → Puppeteer’s downloaded Chrome → system install.
 */
export function resolvePuppeteerExecutablePath(
  puppeteerModule: typeof import("puppeteer"),
): string {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (env) {
    if (fs.existsSync(env)) return env;
    throw new Error(
      `PUPPETEER_EXECUTABLE_PATH is set but the file does not exist: ${env}`,
    );
  }

  let bundled: string;
  try {
    bundled = puppeteerModule.executablePath();
  } catch {
    bundled = "";
  }
  if (bundled && fs.existsSync(bundled)) return bundled;

  const system = findSystemChrome();
  if (system) return system;

  throw new Error(
    "No Chrome/Chromium found for PDF export. Run: npx puppeteer browsers install chrome " +
      "or set PUPPETEER_EXECUTABLE_PATH to your Chrome or Chromium executable.",
  );
}
