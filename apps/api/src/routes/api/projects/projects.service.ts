import { requireUserWithRole } from '../../../lib/auth-helpers';
import {
  projectsRepository,
  type ProjectRow,
  type ProjectRowWithOwner,
  type ProjectMemberWithUser,
} from './projects.repository';

async function requireProjectManager(actorId: string) {
  return await requireUserWithRole(
    actorId,
    ['admin', 'manager'],
    'Unauthorized. Only admins and managers can manage projects.'
  );
}

async function requireAdmin(actorId: string) {
  return await requireUserWithRole(
    actorId,
    ['admin'],
    'Unauthorized. Only administrators can permanently delete projects.'
  );
}

export type CreateProjectInput = Omit<
  ProjectRow,
  'id' | 'created_at' | 'updated_at' | 'deleted_at'
>;

export type UpdateProjectInput = Partial<CreateProjectInput>;

export class ProjectsService {
  async listProjects(
    page?: number,
    limit?: number,
    status?: 'active' | 'archived',
    search?: string
  ): Promise<
    | { projects: ProjectRowWithOwner[]; totalCount: number }
    | ProjectRowWithOwner[]
  > {
    if (page !== undefined && limit !== undefined) {
      return await projectsRepository.listPaginated(
        page,
        limit,
        status,
        search
      );
    }
    return await projectsRepository.listAll();
  }

  async getProjectById(projectId: string): Promise<ProjectRowWithOwner> {
    const project = await projectsRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found.');
    }
    return project;
  }

  async listMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
    return await projectsRepository.listMembers(projectId);
  }

  async addMember(
    actorId: string,
    projectId: string,
    userId: string
  ): Promise<void> {
    await requireProjectManager(actorId);

    const currentMembers = await projectsRepository.listMembers(projectId);
    if (currentMembers.some((m) => m.user_id === userId)) {
      throw new Error('User is already a member of this project.');
    }

    await projectsRepository.addMember(projectId, userId, actorId);
  }

  async removeMember(
    actorId: string,
    projectId: string,
    userId: string
  ): Promise<void> {
    await requireProjectManager(actorId);

    await projectsRepository.removeMember(projectId, userId);
  }

  async createProject(
    actorId: string,
    input: CreateProjectInput
  ): Promise<ProjectRow> {
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
      const duplicate = await projectsRepository.findByKey(
        input.key,
        projectId
      );
      if (duplicate) {
        throw new Error(
          `Another project with the key "${input.key}" already exists.`
        );
      }
    }

    return await projectsRepository.update(projectId, input, actorId);
  }

  async softDeleteProject(
    actorId: string,
    projectId: string
  ): Promise<ProjectRow> {
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

  async restoreProject(
    actorId: string,
    projectId: string
  ): Promise<ProjectRow> {
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
