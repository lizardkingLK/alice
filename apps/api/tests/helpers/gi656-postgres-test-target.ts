const ENABLE_FLAG = 'RUN_GI656_POSTGRES_TESTS';
const TEST_URL = 'GI656_TEST_DATABASE_URL';
const CONFIRM_URL = 'GI656_TEST_DATABASE_CONFIRM_URL';

function normalizedTarget(value: string, variable: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variable} must be a valid PostgreSQL URL.`);
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(`${variable} must use postgres:// or postgresql://.`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database || !/(^|[_-])(dev|test)([_-]|$)/i.test(database)) {
    throw new Error(`${variable} must name an explicit dev/test database.`);
  }
  return `${url.hostname.toLowerCase()}:${url.port || '5432'}/${database}`;
}

export function gi656PostgresTestsEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env[ENABLE_FLAG] === '1';
}

/** Validate both independently supplied URLs before any client is constructed. */
export function requireGi656PostgresTestUrl(
  env: NodeJS.ProcessEnv = process.env
): string {
  if (!gi656PostgresTestsEnabled(env)) {
    throw new Error(`${ENABLE_FLAG}=1 is required.`);
  }
  const testUrl = env[TEST_URL]?.trim();
  const confirmUrl = env[CONFIRM_URL]?.trim();
  if (!testUrl || !confirmUrl) {
    throw new Error(`${TEST_URL} and ${CONFIRM_URL} are both required.`);
  }
  if (
    normalizedTarget(testUrl, TEST_URL) !==
    normalizedTarget(confirmUrl, CONFIRM_URL)
  ) {
    throw new Error(
      'GI-656 PostgreSQL test target does not match its confirmation target.'
    );
  }
  return testUrl;
}
