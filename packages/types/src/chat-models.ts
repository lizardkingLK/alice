/**
 * Chat model registry + per-provider configure defaults.
 *
 * `CHAT_MODELS` keeps Gemini API endpoints in sync for the Gemini provider.
 * `PROVIDER_CHAT_MODEL_SUGGESTIONS` drives Settings → Configure defaults and
 * suggested model picks (one list per integration provider slug).
 *
 * **Policy:** pin dated provider model ids in `integrations.config.model`.
 * Do not cron-rewrite workspace rows to chase `*-latest`. When a vendor
 * retires a model, update this catalog via PR and warn admins in Settings
 * (see `resolveConfiguredChatModelStatus`).
 */

export type ChatModelSuggestion = {
  readonly value: string;
  readonly label: string;
};

/** Curated known-retired ids (former suggestions / common pins). */
export const RETIRED_CHAT_MODEL_IDS: Readonly<
  Record<string, readonly string[]>
> = {
  anthropic: [
    'claude-3-5-haiku-latest',
    'claude-3-5-haiku-20241022',
    'claude-3-haiku-20240307',
    'claude-sonnet-4-20250514',
    'claude-3-7-sonnet-20250219',
    'claude-opus-4-20250514',
  ],
};

export type ConfiguredChatModelStatus = 'suggested' | 'retired' | 'custom';

export type ConfiguredChatModelAssessment = {
  readonly status: ConfiguredChatModelStatus;
  readonly modelId: string;
  readonly recommended: ChatModelSuggestion;
  /** Null when status is `suggested`. */
  readonly warning: string | null;
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
    // Active Anthropic API ids (Claude 3.5 Haiku / Sonnet 4 dated ids retired).
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
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

function isRetiredChatModelId(provider: string, modelId: string): boolean {
  const retired = RETIRED_CHAT_MODEL_IDS[provider];
  if (!retired?.length) {
    return false;
  }
  return retired.includes(modelId);
}

/**
 * Non-mutating health check for a configured chat model id.
 * `custom` means not in the curated suggestion list (still allowed).
 */
export function resolveConfiguredChatModelStatus(
  provider: string,
  modelId: string
): ConfiguredChatModelAssessment {
  const trimmed = modelId.trim();
  const recommended = defaultChatModelForProvider(provider);
  const suggestions = chatModelSuggestionsForProvider(provider);
  const isSuggested = suggestions.some((row) => row.value === trimmed);

  if (!trimmed) {
    return {
      status: 'custom',
      modelId: trimmed,
      recommended,
      warning: 'Enter a provider model id, or pick a suggested model below.',
    };
  }

  if (isSuggested) {
    return {
      status: 'suggested',
      modelId: trimmed,
      recommended,
      warning: null,
    };
  }

  if (isRetiredChatModelId(provider, trimmed)) {
    return {
      status: 'retired',
      modelId: trimmed,
      recommended,
      warning: `Model "${trimmed}" is retired or no longer recommended. Switch to ${recommended.label} (${recommended.value}) — Alice does not auto-update model ids.`,
    };
  }

  return {
    status: 'custom',
    modelId: trimmed,
    recommended,
    warning: `Model "${trimmed}" is not in Alice’s curated list for ${provider}. You can keep this pin, or switch to ${recommended.label} (${recommended.value}).`,
  };
}

export function resolveChatModel(
  modelValue: string
): (typeof CHAT_MODELS)[keyof typeof CHAT_MODELS] {
  const entry = Object.values(CHAT_MODELS).find((m) => m.value === modelValue);
  return entry ?? CHAT_MODELS.GEMINI_3_6_FLASH;
}
