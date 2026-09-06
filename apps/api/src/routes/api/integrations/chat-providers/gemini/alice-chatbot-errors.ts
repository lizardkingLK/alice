type GeminiErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

const SUGGESTED_MODEL_PATTERN = /use models\/([^\s,]+)/i;

export function parseGeminiApiErrorMessage(
  errorBody: string
): string | undefined {
  try {
    const parsed = JSON.parse(errorBody) as GeminiErrorPayload;
    const message = parsed.error?.message;
    return typeof message === 'string' ? message : undefined;
  } catch {
    return undefined;
  }
}

function isGeminiModelUnavailable(params: {
  status: number;
  apiMessage: string;
}): boolean {
  const { status, apiMessage } = params;
  return (
    status === 404 ||
    /no longer available/i.test(apiMessage) ||
    /\bNOT_FOUND\b/.test(apiMessage) ||
    /models\/\S+ is not found/i.test(apiMessage)
  );
}

/**
 * Maps known Gemini API failures to actionable admin guidance.
 * Returns undefined when the caller should use the generic fallback message.
 */
export function resolveGeminiUserFacingError(params: {
  status: number;
  errorBody: string;
  modelId: string;
}): string | undefined {
  const apiMessage = parseGeminiApiErrorMessage(params.errorBody);
  if (!apiMessage) {
    return undefined;
  }

  if (!isGeminiModelUnavailable({ status: params.status, apiMessage })) {
    return undefined;
  }

  const suggestedModel = SUGGESTED_MODEL_PATTERN.exec(apiMessage)?.[1];
  const settingsHint =
    'Update the model id in Settings → Integrations (Google Gemini).';

  if (suggestedModel) {
    return `The configured Gemini model "${params.modelId}" is no longer available from Google. ${settingsHint} Google suggests using "${suggestedModel}" instead.`;
  }

  return `The configured Gemini model "${params.modelId}" is no longer available from Google. ${settingsHint}`;
}
