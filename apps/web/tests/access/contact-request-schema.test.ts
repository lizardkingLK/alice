import { describe, expect, it } from 'vitest';
import { contactRequestSchema } from '@repo/types';

describe('contactRequestSchema', () => {
  it('accepts a valid contact request payload', () => {
    // Arrange
    const input = {
      email: 'prospect@example.com',
      name: 'Ada Lovelace',
      title: 'Access request',
      message: 'Please allow my company domain.',
    };

    // Act
    const parsed = contactRequestSchema.parse(input);

    // Assert
    expect(parsed).toEqual(input);
  });

  it('requires email and message', () => {
    // Arrange
    const input = {
      email: 'not-an-email',
      message: '',
    };

    // Act
    const result = contactRequestSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
  });

  it('allows optional name and title to be omitted', () => {
    // Arrange
    const input = {
      email: 'prospect@example.com',
      message: 'Need access for my team.',
    };

    // Act
    const parsed = contactRequestSchema.parse(input);

    // Assert
    expect(parsed.email).toBe('prospect@example.com');
    expect(parsed.message).toBe('Need access for my team.');
  });
});
