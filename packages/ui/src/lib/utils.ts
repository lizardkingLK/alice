import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function trueRandom(): number | undefined {
  const array = new Uint32Array(1);

  globalThis.crypto.getRandomValues(array);

  return array[0];
}
