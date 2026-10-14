type GeminiErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

const SUGGESTED_MODEL_PATTERN = /use models\/(gemini-[a-z0-9._-]{1,80})/i;

export const GEMINI_API_KEY_REJECTED_MESSAGE =
  'Google Gemini rejected the API key (it may be invalid or expired). Update it under Settings → Integrations (Google Gemini).';

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

function isGeminiApiKeyRejected(params: {
  status: number;
  errorBody: string;
  apiMessage: string | undefined;
}): boolean {
  const { status, errorBody, apiMessage } = params;

  // Google commonly returns 401/403 for bad credentials; treat those as key issues.
  if (status === 401 || status === 403) {
    return true;
  }

  if (/API_KEY_INVALID/i.test(errorBody)) {
    return true;
  }

  if (!apiMessage) {
    return false;
  }

  return (
    /api key (not valid|expired|invalid|revoked)/i.test(apiMessage) ||
    /API key expires/i.test(apiMessage) ||
    /expired API key/i.test(apiMessage)
  );
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

  if (
    isGeminiApiKeyRejected({
      status: params.status,
      errorBody: params.errorBody,
      apiMessage,
    })
  ) {
    return GEMINI_API_KEY_REJECTED_MESSAGE;
  }

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
