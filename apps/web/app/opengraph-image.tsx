import { createOpenGraphImageResponse } from '@/app/_config/brand-mark';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Alice — project management for modern teams';

export default function OpenGraphImage() {
  return createOpenGraphImageResponse();
}
