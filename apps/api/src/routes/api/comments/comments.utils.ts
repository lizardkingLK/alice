export function extractMentionedUserIds(content: string, actorId: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentionedUserIds = new Set<string>();
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    const userId = match[2];
    if (userId && userId !== actorId) {
      mentionedUserIds.add(userId);
    }
  }

  return Array.from(mentionedUserIds);
}

export function removeMentionMarkup(content: string): string {
  return content.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1');
}

export function createCommentSnippet(content: string, limit = 60): string {
  const cleanContent = removeMentionMarkup(content);
  if (cleanContent.length > limit) {
    return cleanContent.slice(0, limit) + '...';
  }
  return cleanContent;
}
