import { z } from 'zod';

export {
  createSavedViewSchema,
  shareSavedViewSchema,
  updateSavedViewSchema,
} from '@repo/types';

export const savedViewStatusQuerySchema = z.enum(['active', 'archived']);
