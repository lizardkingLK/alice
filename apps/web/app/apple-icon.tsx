import { createBrandIconResponse } from '@/app/_config/brand-mark';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return createBrandIconResponse(180);
}
