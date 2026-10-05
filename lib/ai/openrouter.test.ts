import { describe, expect, it } from 'vitest';
import { chatBody, DEFAULT_FALLBACKS, DEFAULT_PRIMARY, MAX_FALLBACKS, modelRoute, nextRoute, retryable } from './openrouter';

describe('OpenRouter model routing', () => {
  it('uses the defaults when nothing is configured', () => {
    expect(modelRoute({})).toEqual({ primary: DEFAULT_PRIMARY, fallbacks: DEFAULT_FALLBACKS });
  });

  it('takes the primary and an ordered fallback list from the environment', () => {
    expect(modelRoute({ OPENROUTER_MODEL: 'anthropic/claude-sonnet-5.5', OPENROUTER_FALLBACK_MODELS: ' google/gemini-3.8-flash , openai/gpt-5-mini' }))
      .toEqual({ primary: 'anthropic/claude-sonnet-5.5', fallbacks: ['google/gemini-3.8-flash', 'openai/gpt-5-mini'] });
  });

  it('drops invalid ids, duplicates and the primary itself, and caps the list', () => {
    const r = modelRoute({ OPENROUTER_MODEL: 'a/one', OPENROUTER_FALLBACK_MODELS: 'a/one,b/two,b/two,not a model,https://evil/x,c/three,d/four,e/five' });
    expect(r.primary).toBe('a/one');
    expect(r.fallbacks).toEqual(['b/two', 'c/three', 'd/four'].slice(0, MAX_FALLBACKS));
  });

  it('allows switching fallbacks off with an empty list', () => {
    expect(modelRoute({ OPENROUTER_FALLBACK_MODELS: '' }).fallbacks).toEqual([]);
    expect('models' in chatBody(modelRoute({ OPENROUTER_FALLBACK_MODELS: '' }), 's', 'u', { maxTokens: 10, temperature: 0 })).toBe(false);
  });

  it('falls back to the default primary if the configured one is malformed', () => {
    expect(modelRoute({ OPENROUTER_MODEL: 'no-slash' }).primary).toBe(DEFAULT_PRIMARY);
  });

  it('builds a request with the primary as `model` and fallbacks as `models`', () => {
    const body = chatBody({ primary: 'a/one', fallbacks: ['b/two'] }, 'system text', 'user text', { maxTokens: 350, temperature: 0.2 });
    expect(body).toMatchObject({ model: 'a/one', models: ['b/two'], provider: { allow_fallbacks: true }, max_tokens: 350, temperature: 0.2 });
    expect(body.messages).toEqual([{ role: 'system', content: 'system text' }, { role: 'user', content: 'user text' }]);
  });

  it('promotes the first fallback when the primary is rejected', () => {
    expect(nextRoute({ primary: 'a/typo', fallbacks: ['b/two', 'c/three'] })).toEqual({ primary: 'b/two', fallbacks: ['c/three'] });
    expect(nextRoute({ primary: 'a/one', fallbacks: [] })).toEqual({ primary: 'a/one', fallbacks: [] });
  });

  it('retries only network trouble and server-side errors', () => {
    expect(retryable(null)).toBe(true);
    expect(retryable(429)).toBe(true);
    expect(retryable(503)).toBe(true);
    expect(retryable(400)).toBe(false);
    expect(retryable(401)).toBe(false);
  });
});
