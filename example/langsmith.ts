/**
 * Optional LangSmith / LangChain tracing for examples.
 * No-op unless LANGSMITH_API_KEY or LANGCHAIN_API_KEY is set.
 */
export function enableLangSmithIfConfigured(): boolean {
  const apiKey =
    process.env.LANGSMITH_API_KEY?.trim() ||
    process.env.LANGCHAIN_API_KEY?.trim();
  if (!apiKey) return false;

  process.env.LANGSMITH_API_KEY ??= apiKey;
  process.env.LANGCHAIN_API_KEY ??= apiKey;

  if (!process.env.LANGSMITH_TRACING && !process.env.LANGCHAIN_TRACING_V2) {
    process.env.LANGSMITH_TRACING = "true";
    process.env.LANGCHAIN_TRACING_V2 = "true";
  }

  const project =
    process.env.LANGSMITH_PROJECT?.trim() ||
    process.env.LANGCHAIN_PROJECT?.trim() ||
    "mxpf-ai-harness-examples";
  process.env.LANGSMITH_PROJECT ??= project;
  process.env.LANGCHAIN_PROJECT ??= project;

  const endpoint =
    process.env.LANGSMITH_ENDPOINT?.trim() ||
    process.env.LANGCHAIN_ENDPOINT?.trim();
  if (endpoint) {
    process.env.LANGSMITH_ENDPOINT ??= endpoint;
    process.env.LANGCHAIN_ENDPOINT ??= endpoint;
  }

  console.log(
    `[langsmith] tracing on → project="${project}" (org ready when API key is set)`,
  );
  return true;
}
