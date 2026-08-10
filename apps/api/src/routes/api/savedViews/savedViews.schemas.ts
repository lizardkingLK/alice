import { z } from 'zod';
import {
  createSavedViewSchema,
  shareSavedViewSchema,
  updateSavedViewSchema,
} from '@repo/types';

export { createSavedViewSchema, shareSavedViewSchema, updateSavedViewSchema };

export const savedViewStatusQuerySchema = z.enum(['active', 'archived']);
