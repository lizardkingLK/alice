import { describe, expect, it } from 'vitest';
import { resolveHomeDisplayName } from '@/app/_components/home/resolve-home-display-name';

describe('resolveHomeDisplayName', () => {
  it('prefers a trimmed profile name', () => {
    // Arrange / Act
    const name = resolveHomeDisplayName({
      name: '  Ada Lovelace  ',
      email: 'ada@example.com',
    });

    // Assert
    expect(name).toBe('Ada Lovelace');
  });

  it('falls back to the email local-part when name is missing', () => {
    // Arrange / Act
    const name = resolveHomeDisplayName({
      name: null,
      email: 'ada@example.com',
    });

    // Assert
    expect(name).toBe('ada');
  });

  it('falls back to there when name and email are missing', () => {
    // Arrange / Act
    const name = resolveHomeDisplayName({ name: '   ', email: null });

    // Assert
    expect(name).toBe('there');
  });
});
