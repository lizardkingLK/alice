/**
 * Favorites must wait until the URL query matches the active thread so we do
 * not pin the wrong conversation while create/select is still hydrating.
 */
export function isChatFavoritesReady(params: {
  readonly isLoadingConversations: boolean;
  readonly isLoadingHistory: boolean;
  readonly activeConversationId: string | undefined;
  readonly urlConversationId: string | null;
}): boolean {
  const {
    isLoadingConversations,
    isLoadingHistory,
    activeConversationId,
    urlConversationId,
  } = params;
  if (isLoadingConversations || isLoadingHistory) {
    return false;
  }
  return (activeConversationId ?? null) === (urlConversationId ?? null);
}
