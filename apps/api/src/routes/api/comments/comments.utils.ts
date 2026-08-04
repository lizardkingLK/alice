import {
  createCommentSnippet,
  extractMentionedUserIdsFromContent,
  type Json,
} from '@repo/types';

export function extractMentionedUserIds(
  content: Json | string,
  actorId: string
): string[] {
  return extractMentionedUserIdsFromContent(content, actorId);
}

export { createCommentSnippet };
