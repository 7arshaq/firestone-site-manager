import Anthropic from '@anthropic-ai/sdk';

/** The Claude model that reads drawings */
export const MODEL = 'claude-opus-5-5';
/** Claude Opus 5.5 prices, US$ per million tokens */
export const PRICE = { input: 4, output: 20 };

// The key is per device and never part of backups or exports.
const KEY = 'firestone-ai-key';

export function getApiKey() {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function setApiKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY, key.trim());
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable (private window) — the key just won't be remembered */
  }
}

/**
 * Talks to the Claude API straight from the browser. There is no server, so the
 * engineer's own key is used; it stays in this browser's storage.
 */
export function claude(apiKey = getApiKey()) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 15 * 60 * 1000 });
}

export type KeyCheck = 'ok' | 'invalid' | 'no-credit' | 'network';

/** Checks a key without spending anything (model lookup is free) */
export async function checkKey(apiKey: string): Promise<KeyCheck> {
  try {
    await claude(apiKey).models.retrieve(MODEL);
    return 'ok';
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return 'invalid';
    if (e instanceof Anthropic.APIError && e.status === 402) return 'no-credit';
    return 'network';
  }
}

/** Turns an API failure into a sentence an engineer can act on */
export function explainError(e: unknown): string {
  if (e instanceof Anthropic.APIUserAbortError) return 'Stopped.';
  if (e instanceof Anthropic.AuthenticationError) return 'The Claude key was not accepted. Check it in Settings → Drawing reader.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'This Claude key is not allowed to use the model. Check your Anthropic account.';
  if (e instanceof Anthropic.RateLimitError) return 'Claude is busy or your account limit was reached. Wait a minute and try again.';
  if (e instanceof Anthropic.BadRequestError) {
    if (/credit|billing|balance/i.test(e.message)) return 'Your Anthropic account is out of credit. Add credit at console.anthropic.com → Billing.';
    if (/too large|maximum|exceed/i.test(e.message)) return 'These drawings are too large to read in one go. Try fewer or smaller files.';
    return `Claude could not read these files: ${e.message}`;
  }
  if (e instanceof Anthropic.APIConnectionError) return 'No connection to Claude. Check the internet and try again.';
  if (e instanceof Anthropic.APIError) return `Claude returned an error (${e.status}). Try again in a moment.`;
  return e instanceof Error ? e.message : 'Something went wrong while reading the drawings.';
}
