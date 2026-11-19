import * as fs from 'node:fs';
import * as path from 'node:path';
import { sanitizeLog } from '../../chat/chat.utils';

const CHATBOT_ERRORS_LOG = 'alice-chatbot-errors.log';

export function logLlmProviderError(
  provider: string,
  errorDetails: {
    timestamp: string;
    status: number;
    attempt: number;
    messagesCount: number;
    responseBodyBytes: number;
    /** Safe enum/slug only — never raw provider payload. */
    rejectionCategory?: string;
  }
): void {
  const safeProvider = sanitizeLog(provider);
  const safeTimestamp = sanitizeLog(errorDetails.timestamp);
  const safeCategory = errorDetails.rejectionCategory
    ? sanitizeLog(errorDetails.rejectionCategory)
    : null;
  const logMessage: string = [
    `[${safeTimestamp}]`,
    safeProvider,
    'Attempt',
    errorDetails.attempt,
    'failed with Status',
    errorDetails.status,
    '.',
    'Provider response body omitted; bytes:',
    `${errorDetails.responseBodyBytes}.`,
    'Messages in history:',
    `${errorDetails.messagesCount}`,
    ...(safeCategory ? ['. Rejection category:', safeCategory] : []),
    '\n',
  ].join(' ');

  console.error(
    `${safeProvider} Error: Request failed with status ${errorDetails.status}. See ${CHATBOT_ERRORS_LOG} for details.`
  );
  try {
    const logFilePath = path.join(
      __dirname,
      '../../../../../',
      CHATBOT_ERRORS_LOG
    );
    fs.appendFileSync(logFilePath, logMessage);
  } catch (err) {
    const errorName = err instanceof Error ? err.name : 'UnknownError';
    console.error(
      `Failed to write to ${CHATBOT_ERRORS_LOG}: ${sanitizeLog(errorName)}`
    );
  }
}
