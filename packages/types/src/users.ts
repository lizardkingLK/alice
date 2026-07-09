import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.email({ message: 'Please enter a valid email address.' }),
  role: z.enum(['admin', 'manager', 'member']),
});

export const updateUserSchema = z.object({
  id: z.uuid({ message: 'Invalid user ID.' }),
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  role: z.enum(['admin', 'manager', 'member']),
});
