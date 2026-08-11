/**
 * Chat model registry.
 *
 * Strategy pattern prerequisite: keep a shared constant "enum" so both backend
 * (Gemini call) and frontend (model dropdown) stay in sync.
 */
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

export function resolveChatModel(
  modelValue: string
): (typeof CHAT_MODELS)[keyof typeof CHAT_MODELS] {
  const entry = Object.values(CHAT_MODELS).find((m) => m.value === modelValue);
  return entry ?? CHAT_MODELS.GEMINI_3_6_FLASH;
}
