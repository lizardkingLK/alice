import { describe, expect, it, vi } from 'vitest';
import { DATABASE_BUSY_USER_MESSAGE } from '@repo/types';
import { withBusyRetry } from '../src/with-busy-retry';

describe('withBusyRetry', () => {
  it('returns on first success', async () => {
    // Arrange
    const operation = vi.fn().mockResolvedValue('ok');

    // Act
    await expect(withBusyRetry(operation)).resolves.toBe('ok');

    // Assert
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on transaction start timeout then succeeds', async () => {
    // Arrange
    const operation = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          'Transaction API error: Unable to start a transaction in the given time.'
        )
      )
      .mockResolvedValueOnce('ok');
    const onRetry = vi.fn();

    // Act
    await expect(
      withBusyRetry(operation, { baseDelayMs: 1, onRetry })
    ).resolves.toBe('ok');

    // Assert
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('throws friendly busy message after exhausting retries', async () => {
    // Arrange
    const operation = vi
      .fn()
      .mockRejectedValue(
        new Error(
          'Transaction API error: Unable to start a transaction in the given time.'
        )
      );

    // Act + Assert
    await expect(
      withBusyRetry(operation, { maxAttempts: 2, baseDelayMs: 1 })
    ).rejects.toThrow(DATABASE_BUSY_USER_MESSAGE);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-busy errors', async () => {
    // Arrange
    const operation = vi.fn().mockRejectedValue(new Error('unique violation'));

    // Act + Assert
    await expect(withBusyRetry(operation, { baseDelayMs: 1 })).rejects.toThrow(
      'unique violation'
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
