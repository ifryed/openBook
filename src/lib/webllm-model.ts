import type { ChatOptions } from "@mlc-ai/web-llm";

/** MLC WebLLM prebuilt id — keep in sync with https://webllm.mlc.ai/ */
export const WEBLLM_MODEL = "Llama-3.1-8B-Instruct-q4f16_1-MLC";

/** Overrides default context window (4096) so long book-context prompts fit. */
export const WEBLLM_CHAT_OPTIONS: ChatOptions = {
  context_window_size: 10_000,
};
