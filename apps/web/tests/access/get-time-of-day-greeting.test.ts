import { describe, expect, it } from 'vitest';
import { getTimeOfDayGreeting } from '@/app/_components/home/get-time-of-day-greeting';

describe('getTimeOfDayGreeting', () => {
  it('returns Good Morning before noon', () => {
    // Arrange
    const date = new Date('2026-10-26T08:30:00');

    // Act
    const greeting = getTimeOfDayGreeting(date);

    // Assert
    expect(greeting).toBe('Good Morning');
  });

  it('returns Good Afternoon from noon until 17:00', () => {
    // Arrange
    const date = new Date('2026-10-26T14:00:00');

    // Act
    const greeting = getTimeOfDayGreeting(date);

    // Assert
    expect(greeting).toBe('Good Afternoon');
  });

  it('returns Good Evening from 17:00 onward', () => {
    // Arrange
    const date = new Date('2026-10-26T19:15:00');

    // Act
    const greeting = getTimeOfDayGreeting(date);

    // Assert
    expect(greeting).toBe('Good Evening');
  });
});
