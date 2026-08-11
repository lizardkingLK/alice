export function createCalendarService() {
  return {
    async getCalendarConfig(): Promise<{ enabled: boolean }> {
      return { enabled: true };
    },
  };
}
