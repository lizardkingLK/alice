export function sanitizeLog(value: unknown): string {
  if (value instanceof Error) {
    return value.message.replace(/[\r\n]/g, '_');
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  ) {
    return String(value).replace(/[\r\n]/g, '_');
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value).replace(/[\r\n]/g, '_');
    } catch {
      // Fallback
    }
  }
  return '';
}
