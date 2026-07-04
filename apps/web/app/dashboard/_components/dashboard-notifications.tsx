'use client';

import { Inbox } from '@novu/nextjs';
import { useEffect, useState } from 'react';
import {
  getNovuAppId,
  getNovuSubscriberId,
  hasNovuConfig,
} from '@/lib/env/env-public';
import { getSubscriberId } from '@/lib/subscriber-id';

export function NotificationInbox() {
  const [subscriberId, setSubscriberId] = useState('');

  useEffect(() => {
    setSubscriberId(getSubscriberId());
  }, []);

  const applicationIdentifier = getNovuAppId();
  const configuredSubscriberId = getNovuSubscriberId();

  if (
    !subscriberId ||
    !hasNovuConfig() ||
    !applicationIdentifier ||
    !configuredSubscriberId
  ) {
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
