import type { MLCEngine } from "@mlc-ai/web-llm";
import type { MutableRefObject } from "react";
import { WEBLLM_CHAT_OPTIONS, WEBLLM_MODEL } from "@/lib/webllm-model";

export type WebLlmProgressCallback = (text: string) => void;

/**
 * Lazily create and cache a WebLLM engine on `engineRef`. Caller owns lifecycle
 * (typically `useEffect` cleanup calling `engineRef.current?.unload()`).
 */
export async function ensureWebLlmEngine(
  engineRef: MutableRefObject<MLCEngine | null>,
  onProgress: WebLlmProgressCallback,
): Promise<MLCEngine> {
  if (engineRef.current) {
    return engineRef.current;
  }
  onProgress("Loading Llama 3.1 8B (first run may download several GB)…");
  const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
  const engine = await CreateMLCEngine(
    WEBLLM_MODEL,
    {
      initProgressCallback: (report) => {
        onProgress(
          `${report.text} (${Math.round(report.progress * 100)}%)`,
        );
      },
    },
    WEBLLM_CHAT_OPTIONS,
  );
  engineRef.current = engine;
  return engine;
}
