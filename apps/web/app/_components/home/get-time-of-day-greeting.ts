export type TimeOfDayGreeting =
  'Good Morning' | 'Good Afternoon' | 'Good Evening';

/**
 * Local-time greeting bands: morning before noon, afternoon until 17:00,
 * evening from 17:00 onward.
 */
export function getTimeOfDayGreeting(
  date: Date = new Date()
): TimeOfDayGreeting {
  const hour = date.getHours();
  if (hour < 12) {
    return 'Good Morning';
  }
  if (hour < 17) {
    return 'Good Afternoon';
  }
  return 'Good Evening';
}
