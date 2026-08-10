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
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-300 hover:scale-105 active:scale-95"
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
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm transition-opacity duration-300 border-none cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Close Chat"
          />

          {/* Drawer Container */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-background border-l border-border shadow-2xl transition-all duration-300 sm:w-110 animate-in slide-in-from-right">
            <ChatClient variant="drawer" onClose={() => setIsOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
