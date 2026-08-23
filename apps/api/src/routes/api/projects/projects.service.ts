import { requireUserWithRole } from '../../../lib/auth-helpers';
import { ProjectStatusEnum, UserRoleEnum } from '@repo/types';
import { uploadPublicImageReplacingPrevious } from '../../../lib/public-image-upload';
import {
  projectsRepository,
  type ProjectRow,
  type ProjectRowWithOwner,
  type ProjectMemberWithUser,
} from './projects.repository';

async function requireProjectManager(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin, UserRoleEnum.manager],
    'Unauthorized. Only admins and managers can manage projects.'
  );
}

async function requireAdmin(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin],
    'Unauthorized. Only administrators can permanently delete projects.'
  );
}

export type CreateProjectInput = Omit<
  ProjectRow,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'logo_url'
  | 'cover_picture'
> & {
  logo_url?: string | null;
  cover_picture?: string | null;
};

export type UpdateProjectInput = Partial<CreateProjectInput>;

type ProjectImageField = 'logo_url' | 'cover_picture';

export class ProjectsService {
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
    input: UpdateProjectInput,
    expectedUpdatedAt: string
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

    return await projectsRepository.update(
      projectId,
      input,
      actorId,
      expectedUpdatedAt
    );
  }

  async softDeleteProject(
    actorId: string,
    projectId: string,
    expectedUpdatedAt: string
  ): Promise<ProjectRow> {
    await requireProjectManager(actorId);

    return await projectsRepository.update(
      projectId,
      {
        deleted_at: new Date().toISOString(),
        status: 'archived',
      },
      actorId,
      expectedUpdatedAt
    );
  }

  async restoreProject(
    actorId: string,
    projectId: string,
    expectedUpdatedAt: string
  ): Promise<ProjectRow> {
    await requireProjectManager(actorId);

    return await projectsRepository.update(
      projectId,
      {
        deleted_at: null,
        status: ProjectStatusEnum.active,
      },
      actorId,
      expectedUpdatedAt
    );
  }

  async hardDeleteProject(actorId: string, projectId: string): Promise<void> {
    await requireAdmin(actorId);

    await projectsRepository.delete(projectId);
  }

  async getJiraSettings(actorId: string) {
    await requireProjectManager(actorId);
    return await projectsRepository.getJiraSettings();
  }

  async saveJiraSettings(
    actorId: string,
    url: string,
    email: string,
    token: string
  ) {
    await requireProjectManager(actorId);
    await projectsRepository.saveJiraSettings(url, email, token);
  }

  async linkImportedJiraParents(
    actorId: string,
    projectId: string,
    issues: { key: string; parentKey?: string | null }[]
  ): Promise<void> {
    await requireProjectManager(actorId);
    await projectsRepository.linkImportedJiraParents(projectId, issues);
  }

  async updateProjectLogo(
    actorId: string,
    projectId: string,
    file: Express.Multer.File,
    expectedUpdatedAt: string
  ): Promise<{
    success: true;
    url: string;
    path: string;
    project: ProjectRow;
  }> {
    return this.updateProjectImageField(
      actorId,
      projectId,
      file,
      expectedUpdatedAt,
      {
        field: 'logo_url',
        fileNameFallback: 'logo',
      }
    );
  }

  async updateProjectCover(
    actorId: string,
    projectId: string,
    file: Express.Multer.File,
    expectedUpdatedAt: string
  ): Promise<{
    success: true;
    url: string;
    path: string;
    project: ProjectRow;
  }> {
    return this.updateProjectImageField(
      actorId,
      projectId,
      file,
      expectedUpdatedAt,
      {
        field: 'cover_picture',
        fileNameFallback: 'cover',
      }
    );
  }

  private async updateProjectImageField(
    actorId: string,
    projectId: string,
    file: Express.Multer.File,
    expectedUpdatedAt: string,
    options: {
      field: ProjectImageField;
      fileNameFallback: string;
    }
  ): Promise<{
    success: true;
    url: string;
    path: string;
    project: ProjectRow;
  }> {
    await requireProjectManager(actorId);

    const existing = await projectsRepository.findById(projectId);
    if (!existing) {
      throw new Error('Project not found.');
    }

    const { field, fileNameFallback } = options;
    const { env } = await import('../../../config/env.js');
    const bucket =
      field === 'logo_url'
        ? env.STORAGE_BUCKET_PROJECT_LOGOS
        : env.STORAGE_BUCKET_PROJECT_COVERS;

    let project!: ProjectRow;
    const uploaded = await uploadPublicImageReplacingPrevious({
      file,
      bucket,
      ownerKey: projectId,
      fileNameFallback,
      previousPublicUrl: existing[field],
      persistUrl: async (publicUrl) => {
        project = await projectsRepository.update(
          projectId,
          { [field]: publicUrl },
          actorId,
          expectedUpdatedAt
        );
      },
    });

    return {
      success: true,
      url: project[field]!,
      path: uploaded.path,
      project,
    };
  }
}

export const projectsService = new ProjectsService();
