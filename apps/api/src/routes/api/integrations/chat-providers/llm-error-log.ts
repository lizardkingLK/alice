import * as fs from 'node:fs';
import * as path from 'node:path';
import { sanitizeLog } from '../../chat/chat.utils';

const CHATBOT_ERRORS_LOG = 'alice-chatbot-errors.log';

export function logLlmProviderError(
  provider: string,
  errorDetails: {
    timestamp: string;
    status: number;
    statusText: string;
    errorBody: string;
    attempt: number;
    messagesCount: number;
  }
): void {
  const logMessage: string = [
    `[${errorDetails.timestamp}]`,
    provider,
    'Attempt',
    errorDetails.attempt,
    'failed with Status',
    errorDetails.status,
    `${errorDetails.statusText}.`,
    'Body:',
    `${errorDetails.errorBody}.`,
    'Messages in history:',
    `${errorDetails.messagesCount}\n`,
  ].join(' ');

  console.error(
    `${provider} Error: Request failed with status ${errorDetails.status}. See ${CHATBOT_ERRORS_LOG} for details.`
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
