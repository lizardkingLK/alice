import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { createUsersService } from './users.mutations.shared';

const service = createUsersService(apiFetch);

export const createUser = service.createUser;
export const updateUser = service.updateUser;
export const forceUpdateUser = service.forceUpdateUser;
export const toggleUserActive = service.toggleUserActive;

export type {
  User,
  GetUsersPaginatedResponse,
  CreateUserInput,
  UpdateUserInput,
} from './users.mutations.shared';
