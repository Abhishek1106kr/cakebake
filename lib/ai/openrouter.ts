// OpenRouter model routing for the admin copilot: one primary model and an ordered list of
// fallbacks. OpenRouter tries the primary first and moves down the list when a model's providers
// are down, rate-limited or refuse to answer; the response says which model answered.
// Pure helpers (no network, no secrets) so the routing rules are testable.

export const DEFAULT_PRIMARY = 'anthropic/claude-haiku-4.5';
/** A stronger model from the same family, then a different company, so one outage can't stop it. */
export const DEFAULT_FALLBACKS = ['anthropic/claude-sonnet-5.5', 'google/gemini-3.8-flash'];
export const MAX_FALLBACKS = 3;

const MODEL_ID = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i;

/** Primary and fallbacks from the environment, cleaned: valid ids only, no duplicates, at most MAX_FALLBACKS fallbacks. */
export function modelRoute(env: { OPENROUTER_MODEL?: string; OPENROUTER_FALLBACK_MODELS?: string }) {
  const primary = env.OPENROUTER_MODEL?.trim() && MODEL_ID.test(env.OPENROUTER_MODEL.trim()) ? env.OPENROUTER_MODEL.trim() : DEFAULT_PRIMARY;
  const listed = env.OPENROUTER_FALLBACK_MODELS === undefined
    ? DEFAULT_FALLBACKS
    : env.OPENROUTER_FALLBACK_MODELS.split(',').map((m) => m.trim()).filter(Boolean);
  const fallbacks = [...new Set(listed.filter((m) => MODEL_ID.test(m) && m !== primary))].slice(0, MAX_FALLBACKS);
  return { primary, fallbacks };
}

/** The chat completion request body: `model` first, `models` as fallbacks, provider fallbacks on. */
export function chatBody(route: { primary: string; fallbacks: string[] }, system: string, user: string, opts: { maxTokens: number; temperature: number }) {
  return {
    model: route.primary,
    ...(route.fallbacks.length ? { models: route.fallbacks } : {}),
    provider: { allow_fallbacks: true },
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    messages: [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user },
    ],
  };
}

/** The route with its first fallback promoted to primary (used when OpenRouter rejects the primary outright). */
export const nextRoute = (route: { primary: string; fallbacks: string[] }) => ({ primary: route.fallbacks[0] ?? route.primary, fallbacks: route.fallbacks.slice(1) });

/** Whether a failed call is worth one more try (network trouble or a server-side error, not a bad request). */
export const retryable = (status: number | null) => status === null || status === 429 || status >= 500;
