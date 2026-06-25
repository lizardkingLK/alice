"use client";

import { Inbox } from "@novu/nextjs";
import { useEffect, useState } from "react";
import { getSubscriberId } from "@/lib/subscriber-id";

export function NotificationInbox() {
  const [subscriberId, setSubscriberId] = useState("");

  useEffect(() => {
    setSubscriberId(getSubscriberId());
  }, []);

  if (!subscriberId) return null;

  return (
    <Inbox
      applicationIdentifier={process.env.NEXT_PUBLIC_NOVU_APP_ID!}
      subscriberId={subscriberId}
    />
  );
}