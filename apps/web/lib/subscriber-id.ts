'use client';

const STORAGE_KEY = 'alice_subscriber_id';

export function getSubscriberId(): string {
  if (typeof globalThis === 'undefined') return '';

  let id = globalThis.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    globalThis.localStorage.setItem(STORAGE_KEY, id);
  }

  return id;
}
