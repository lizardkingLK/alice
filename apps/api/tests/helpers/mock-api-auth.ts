/** Stable actor id injected by route integration test auth mocks. */
export const MOCK_AUTH_USER_ID = 'user-1';

export function mockRequireApiAuth(
  req: { userId?: string },
  _res: unknown,
  next: () => void
): void {
  req.userId = MOCK_AUTH_USER_ID;
  next();
}
