/**
 * Chat model registry + per-provider configure defaults.
 *
 * `CHAT_MODELS` keeps Gemini API endpoints in sync for the Gemini provider.
 * `PROVIDER_CHAT_MODEL_SUGGESTIONS` drives Settings → Configure defaults and
 * suggested model picks (one list per integration provider slug).
 */

export type ChatModelSuggestion = {
  readonly value: string;
  readonly label: string;
};

export const CHAT_MODELS = {
  GEMINI_3_6_FLASH: {
    value: 'gemini-3.6-flash',
    label: 'Gemini 3.6',
    apiUrl:
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
  },
} as const;

export type ChatModelValue =
  (typeof CHAT_MODELS)[keyof typeof CHAT_MODELS]['value'];

export const DEFAULT_CHAT_MODEL_VALUE: ChatModelValue =
  CHAT_MODELS.GEMINI_3_6_FLASH.value;

/** Suggested models shown when configuring each AI provider in Settings. */
export const PROVIDER_CHAT_MODEL_SUGGESTIONS: Readonly<
  Record<string, readonly ChatModelSuggestion[]>
> = {
  gemini: [
    {
      value: CHAT_MODELS.GEMINI_3_6_FLASH.value,
      label: CHAT_MODELS.GEMINI_3_6_FLASH.label,
    },
  ],
  spacexai: [
    { value: 'grok-4.3', label: 'Grok 4.3' },
    { value: 'grok-3', label: 'Grok 3' },
    { value: 'grok-3-mini', label: 'Grok 3 Mini' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
  ],
};

const FALLBACK_PROVIDER_SUGGESTIONS: readonly ChatModelSuggestion[] = [
  {
    value: CHAT_MODELS.GEMINI_3_6_FLASH.value,
    label: CHAT_MODELS.GEMINI_3_6_FLASH.label,
  },
];

export function chatModelSuggestionsForProvider(
  provider: string
): readonly ChatModelSuggestion[] {
  return (
    PROVIDER_CHAT_MODEL_SUGGESTIONS[provider] ?? FALLBACK_PROVIDER_SUGGESTIONS
  );
}

export function defaultChatModelForProvider(
  provider: string
): ChatModelSuggestion {
  const [firstSuggestion] = chatModelSuggestionsForProvider(provider);
  if (firstSuggestion) {
    return firstSuggestion;
  }
  return {
    value: CHAT_MODELS.GEMINI_3_6_FLASH.value,
    label: CHAT_MODELS.GEMINI_3_6_FLASH.label,
  };
}

export function resolveChatModel(
  modelValue: string
): (typeof CHAT_MODELS)[keyof typeof CHAT_MODELS] {
  const entry = Object.values(CHAT_MODELS).find((m) => m.value === modelValue);
  return entry ?? CHAT_MODELS.GEMINI_3_6_FLASH;
}
