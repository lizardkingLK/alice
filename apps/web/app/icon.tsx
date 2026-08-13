import { createBrandIconResponse } from '@/app/_config/brand-mark';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return createBrandIconResponse(32);
}
