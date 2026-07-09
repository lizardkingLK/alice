import { supabase } from '../../../lib/supabase';
import {
  projectsRepository,
  type ProjectRow,
  type ProjectRowWithOwner,
} from './projects.repository';

async function requireProjectManager(actorId: string) {
  const { data: user, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', actorId)
    .single();

  if (error || !user) {
    throw new Error('Not authenticated.');
  }

  if (user.role !== 'admin' && user.role !== 'manager') {
    throw new Error('Unauthorized. Only admins and managers can manage projects.');
  }
  return user;
}

async function requireAdmin(actorId: string) {
  const { data: user, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', actorId)
    .single();

  if (error || !user) {
    throw new Error('Not authenticated.');
  }

  if (user.role !== 'admin') {
    throw new Error('Unauthorized. Only administrators can permanently delete projects.');
  }
  return user;
}

export type CreateProjectInput = Omit<
  ProjectRow,
  'id' | 'created_at' | 'updated_at' | 'deleted_at'
>;

export type UpdateProjectInput = Partial<CreateProjectInput>;

export class ProjectsService {
  async listProjects(): Promise<ProjectRowWithOwner[]>;
  async listProjects(
    page: number,
    limit: number,
    status?: 'active' | 'archived',
    search?: string
  ): Promise<{ projects: ProjectRowWithOwner[]; totalCount: number }>;
  async listProjects(
    page?: number,
    limit?: number,
    status?: 'active' | 'archived',
    search?: string
  ): Promise<{ projects: ProjectRowWithOwner[]; totalCount: number } | ProjectRowWithOwner[]> {
    if (page !== undefined && limit !== undefined) {
      return await projectsRepository.listPaginated(page, limit, status, search);
    }
    return await projectsRepository.listAll();
  }

  async createProject(actorId: string, input: CreateProjectInput): Promise<ProjectRow> {
    await requireProjectManager(actorId);

    const duplicate = await projectsRepository.findByKey(input.key);
    if (duplicate) {
      throw new Error(`A project with the key "${input.key}" already exists.`);
    }

    return await projectsRepository.create(input, actorId);
  }

  async updateProject(
    actorId: string,
    projectId: string,
    input: UpdateProjectInput
  ): Promise<ProjectRow> {
    await requireProjectManager(actorId);

    if (input.key) {
      const duplicate = await projectsRepository.findByKey(input.key, projectId);
      if (duplicate) {
        throw new Error(`Another project with the key "${input.key}" already exists.`);
      }
    }

    return await projectsRepository.update(projectId, input, actorId);
  }

  async softDeleteProject(actorId: string, projectId: string): Promise<ProjectRow> {
    await requireProjectManager(actorId);

    return await projectsRepository.update(
      projectId,
      {
        deleted_at: new Date().toISOString(),
        status: 'archived',
      },
      actorId
    );
  }

  async restoreProject(actorId: string, projectId: string): Promise<ProjectRow> {
    await requireProjectManager(actorId);

    return await projectsRepository.update(
      projectId,
      {
        deleted_at: null,
        status: 'active',
      },
      actorId
    );
  }

  async hardDeleteProject(actorId: string, projectId: string): Promise<void> {
    await requireAdmin(actorId);

    await projectsRepository.delete(projectId);
  }
}

export const projectsService = new ProjectsService();
