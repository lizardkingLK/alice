'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bot } from '@repo/ui/lib/icons';
import { ChatClient } from './chat-client';

export function FloatingChatWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Hide the floating widget when we are already on the full chatbot page
  if (pathname === '/chat') {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary fixed right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-105 focus:ring-2 focus:ring-offset-2 focus:outline-none active:scale-95"
        aria-label="Open AI Assistant"
      >
        <Bot className="h-6 w-6 animate-pulse" />
      </button>

      {/* Slide-out Drawer Panel */}
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default border-none bg-black/45 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
            aria-label="Close Chat"
          />

          {/* Drawer Container */}
          <div className="bg-background border-border animate-in slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l shadow-2xl transition-all duration-300 sm:w-110">
            <ChatClient variant="drawer" onClose={() => setIsOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
