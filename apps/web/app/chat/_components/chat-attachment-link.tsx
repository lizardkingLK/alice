'use client';

import React, { useState } from 'react';
import { Loader2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { ChatAttachmentWire } from '@repo/types';
import { getAttachmentIcon } from './chat-attachment-tiles';
import { mintChatAttachmentUrls } from '../_services/chat-attachments.client';

export interface ChatAttachmentLinkProps {
  readonly attachment: ChatAttachmentWire;
  readonly isUser?: boolean;
  readonly className?: string;
}

export function isAttachmentUrlExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return true;
  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) return true;
  return expiresMs <= Date.now() + 60_000;
}

export function ChatAttachmentLink({
  attachment,
  isUser = false,
  className,
}: Readonly<ChatAttachmentLinkProps>) {
  const [currentUrl, setCurrentUrl] = useState<string>(attachment.url);
  const [expiresAt, setExpiresAt] = useState<string | null | undefined>(
    attachment.expiresAt
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    if (isRefreshing) return;

    if (isAttachmentUrlExpired(expiresAt)) {
      setIsRefreshing(true);
      try {
        const fresh = await mintChatAttachmentUrls(attachment.id);
        const resolvedUrl =
          fresh.previewUrl ||
          fresh.downloadUrl ||
          (fresh as unknown as { url?: string }).url ||
          currentUrl;
        setCurrentUrl(resolvedUrl);
        setExpiresAt(fresh.expiresAt);
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.error('Failed to refresh expired attachment signed URL:', err);
        if (currentUrl) {
          window.open(currentUrl, '_blank', 'noopener,noreferrer');
        }
      } finally {
        setIsRefreshing(false);
      }
    } else {
      window.open(currentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <a
      href={currentUrl}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      aria-busy={isRefreshing}
      aria-label={`Attachment ${attachment.fileName}${isRefreshing ? ' (refreshing link)' : ''}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer',
        isUser
          ? 'bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground'
          : 'bg-background hover:bg-accent border-border/80 text-foreground border shadow-2xs',
        isRefreshing && 'opacity-70 pointer-events-none',
        className
      )}
      title={`${attachment.fileName}${isRefreshing ? ' (Refreshing link…)' : ''}`}
    >
      {isRefreshing ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
      ) : (
        getAttachmentIcon(attachment.fileType)
      )}
      <span className="max-w-[10rem] truncate font-medium">
        {attachment.fileName}
      </span>
    </a>
  );
}
