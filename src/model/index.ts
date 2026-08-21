import type { ModelRef } from "../types.js";
import { AuthError } from "../types.js";
import { createAnthropicClient } from "./anthropic.js";
import { createOpenAiClient } from "./openai.js";
import type { ModelClient } from "./types.js";

export type CreateModelClientOptions = {
  model: ModelRef;
  fetchFn?: typeof fetch;
};

export function createModelClient(
  opts: CreateModelClientOptions,
): ModelClient {
  const apiKey = opts.model.apiKey?.trim();
  if (!apiKey) {
    throw new AuthError(
      `Missing apiKey for provider ${opts.model.provider}. Pass model.apiKey or set MXPF_HARNESS_API_KEY.`,
    );
  }

  if (opts.model.provider === "anthropic") {
    return createAnthropicClient({
      modelId: opts.model.id,
      apiKey,
      baseURL: opts.model.baseURL,
      fetchFn: opts.fetchFn,
    });
  }

  return createOpenAiClient({
    modelId: opts.model.id,
    apiKey,
    baseURL: opts.model.baseURL,
    fetchFn: opts.fetchFn,
  });
}

export type { ModelClient, ModelCompleteRequest, ModelCompleteResponse } from "./types.js";
