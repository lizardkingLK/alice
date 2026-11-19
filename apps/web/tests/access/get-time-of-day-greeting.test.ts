import { describe, expect, it } from 'vitest';
import { getTimeOfDayGreeting } from '@/app/_components/home/get-time-of-day-greeting';

describe('getTimeOfDayGreeting', () => {
  it.each([
    { iso: '2026-10-26T08:30:00', expected: 'Good Morning' },
    { iso: '2026-10-26T14:00:00', expected: 'Good Afternoon' },
    { iso: '2026-10-26T19:15:00', expected: 'Good Evening' },
  ])('returns $expected', ({ iso, expected }) => {
    // Arrange
    const date = new Date(iso);

    // Act
    const greeting = getTimeOfDayGreeting(date);

    // Assert
    expect(greeting).toBe(expected);
  });
});
