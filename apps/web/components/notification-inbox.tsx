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

  const applicationIdentifier = process.env.NEXT_PUBLIC_NOVU_APP_ID;
  const configuredSubscriberId = process.env.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID;

  if (!applicationIdentifier || !configuredSubscriberId) {
    return null;
  }

  return (
    <Inbox
      applicationIdentifier={applicationIdentifier}
      subscriberId={configuredSubscriberId}
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
