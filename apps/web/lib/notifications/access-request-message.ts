/** Extract requester email from legacy contact notification bodies. */
export function extractEmailFromAccessRequestMessage(
  message: string
): string | null {
  const match = /From:\s*([^\s()]+)/i.exec(message);
  return match?.[1]?.trim().toLowerCase() ?? null;
}
