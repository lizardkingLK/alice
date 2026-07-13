import { apiFetch } from '@/lib/api/api-client';
import { createUsersService } from './users.service.base';

const service = createUsersService(apiFetch);

export const getUsersList = service.getUsersList;
export const getUsersListPaginated = service.getUsersListPaginated;
export const getUserList = service.getUserList;
export const createUser = service.createUser;
export const updateUser = service.updateUser;
export const toggleUserActive = service.toggleUserActive;

export type {
  User,
  GetUsersPaginatedResponse,
  CreateUserInput,
  UpdateUserInput,
} from './users.service.base';
