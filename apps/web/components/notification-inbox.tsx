'use client';

import { Inbox } from '@novu/nextjs';
import { useEffect, useState } from 'react';
import { getSubscriberId } from '@/lib/subscriber-id';

export function NotificationInbox() {
  const [subscriberId, setSubscriberId] = useState('');

  useEffect(() => {
    setSubscriberId(getSubscriberId());
  }, []);

  if (!subscriberId) {
    return null;
  }

  return (
    <Inbox
      applicationIdentifier={process.env.NEXT_PUBLIC_NOVU_APP_ID!}
      subscriberId={process.env.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID!}
      socketUrl="wss://socket.novu.co"
      appearance={{
        variables: {
          colorPrimary: '#DD2450',
          colorForeground: '#0E121B',
        },
      }}
    />
  );
}
