import { describe, expect, it, vi } from 'vitest';

// GI-666: Prisma client errors must be sanitized before reaching the frontend.
// We mock @repo/types and @repo/types/prisma to control the error class
// hierarchy, then verify that jsonErrorFromCaught blocks internal messages.

vi.mock('@repo/types', () => ({
  DATABASE_BUSY_CODE: 'DATABASE_BUSY',
  DATABASE_BUSY_HTTP_STATUS: 503,
  DATABASE_BUSY_USER_MESSAGE: 'Database is busy. Please try again.',
  isDatabaseBusyError: () => false,
}));

// Define lightweight stand-in Prisma error classes that satisfy `instanceof`
// checks in the production code without requiring a live Prisma client.
// The vi.hoisted call keeps them available before the vi.mock factory runs.
const {
  MockPrismaClientKnownRequestError,
  MockPrismaClientUnknownRequestError,
  MockPrismaClientValidationError,
  MockPrismaClientInitializationError,
  MockPrismaClientRustPanicError,
} = vi.hoisted(() => {
  class MockPrismaClientKnownRequestError extends Error {
    code: string;
    clientVersion = '0.0.0';
    constructor(message: string, { code }: { code: string }) {
      super(message);
      this.name = 'PrismaClientKnownRequestError';
      this.code = code;
    }
  }
  class MockPrismaClientUnknownRequestError extends Error {
    clientVersion = '0.0.0';
    constructor(message: string) {
      super(message);
      this.name = 'PrismaClientUnknownRequestError';
    }
  }
  class MockPrismaClientValidationError extends Error {
    clientVersion = '0.0.0';
    constructor(message: string) {
      super(message);
      this.name = 'PrismaClientValidationError';
    }
  }
  class MockPrismaClientInitializationError extends Error {
    clientVersion = '0.0.0';
    errorCode?: string;
    constructor(message: string, _errorCode?: string) {
      super(message);
      this.name = 'PrismaClientInitializationError';
    }
  }
  class MockPrismaClientRustPanicError extends Error {
    clientVersion = '0.0.0';
    constructor(message: string) {
      super(message);
      this.name = 'PrismaClientRustPanicError';
    }
  }
  return {
    MockPrismaClientKnownRequestError,
    MockPrismaClientUnknownRequestError,
    MockPrismaClientValidationError,
    MockPrismaClientInitializationError,
    MockPrismaClientRustPanicError,
  };
});

vi.mock('@repo/types/prisma', () => ({
  Prisma: {
    PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
    PrismaClientUnknownRequestError: MockPrismaClientUnknownRequestError,
    PrismaClientValidationError: MockPrismaClientValidationError,
    PrismaClientInitializationError: MockPrismaClientInitializationError,
    PrismaClientRustPanicError: MockPrismaClientRustPanicError,
  },
}));

import {
  jsonErrorFromCaught,
  httpStatusFromErrorMessage,
} from '../../src/lib/http-error-status';

describe('httpStatusFromErrorMessage', () => {
  it('returns 403 for Unauthorized messages', () => {
    expect(httpStatusFromErrorMessage('Unauthorized to do that')).toBe(403);
  });

  it('returns 404 for not found messages', () => {
    expect(httpStatusFromErrorMessage('Figma connection not found.')).toBe(404);
  });

  it('returns 400 for Cannot messages', () => {
    expect(httpStatusFromErrorMessage('Cannot delete this record')).toBe(400);
  });

  it('returns 400 for "Only …" messages', () => {
    expect(httpStatusFromErrorMessage('Only admins can do that')).toBe(400);
  });

  it('defaults to 500 for unrecognised messages', () => {
    expect(httpStatusFromErrorMessage('Something went wrong')).toBe(500);
  });

  it('honours the fallback parameter', () => {
    expect(httpStatusFromErrorMessage('Something went wrong', 503)).toBe(503);
  });
});

describe('jsonErrorFromCaught – GI-666 Prisma error sanitization', () => {
  const fallback = 'Failed to disconnect Figma';

  // GI-666: Prisma errors like "Failed to deserialize column of type 'void'"
  // must NEVER reach the frontend. The fallback message is returned instead.
  it('replaces PrismaClientKnownRequestError with the fallback message', () => {
    const err = new MockPrismaClientKnownRequestError(
      "Failed to deserialize column of type 'void'",
      { code: 'P2010' }
    );
    const result = jsonErrorFromCaught(err, fallback);
    expect(result.status).toBe(500);
    expect(result.error).toBe(fallback);
    expect(result.error).not.toContain('void');
    expect(result.error).not.toContain('deserialize');
  });

  it('replaces PrismaClientUnknownRequestError with the fallback message', () => {
    const err = new MockPrismaClientUnknownRequestError(
      'Internal raw query error: column "pg_advisory_xact_lock" of relation does not exist'
    );
    const result = jsonErrorFromCaught(err, fallback);
    expect(result.status).toBe(500);
    expect(result.error).toBe(fallback);
  });

  it('replaces PrismaClientValidationError with the fallback message', () => {
    const err = new MockPrismaClientValidationError(
      'Invalid `prisma.$queryRaw()` invocation: ...'
    );
    const result = jsonErrorFromCaught(err, fallback);
    expect(result.status).toBe(500);
    expect(result.error).toBe(fallback);
  });

  it('replaces PrismaClientInitializationError with the fallback message', () => {
    const err = new MockPrismaClientInitializationError(
      "Can't reach database server"
    );
    const result = jsonErrorFromCaught(err, fallback);
    expect(result.status).toBe(500);
    expect(result.error).toBe(fallback);
  });

  it('replaces PrismaClientRustPanicError with the fallback message', () => {
    const err = new MockPrismaClientRustPanicError('Rust engine panic');
    const result = jsonErrorFromCaught(err, fallback);
    expect(result.status).toBe(500);
    expect(result.error).toBe(fallback);
  });

  it('passes through a plain application Error unchanged', () => {
    const err = new Error('Figma connection not found.');
    const result = jsonErrorFromCaught(err, fallback);
    expect(result.status).toBe(404);
    expect(result.error).toBe('Figma connection not found.');
  });

  it('uses the fallback for non-Error thrown values', () => {
    const result = jsonErrorFromCaught('string thrown', fallback);
    expect(result.status).toBe(500);
    expect(result.error).toBe(fallback);
  });
});
