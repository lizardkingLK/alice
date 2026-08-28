import { requireUserWithRole } from '../../../lib/auth-helpers';
import { ALL_PROJECTS } from '../../../lib/project-access';
import {
  ProjectStatusEnum,
  UserRoleEnum,
  type ListProjectsQuery,
  type ProjectListRow,
  type ProjectDetailRow,
  type ProjectMemberRow,
} from '@repo/types';
import { uploadPublicImageReplacingPrevious } from '../../../lib/public-image-upload';
import { encryptSecretIfPresent } from '../../../lib/secrets/token-crypto';
import type { ProjectsRepository } from './projects.repository';
import type {
  CreateProjectInput,
  ProjectMemberWithUser,
  ProjectRow,
  ProjectRowWithOwner,
  UpdateProjectInput,
} from './projects.types';

export type { CreateProjectInput, UpdateProjectInput } from './projects.types';

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
    'Unauthorized. Only administrators can create or permanently delete projects.'
  );
}

/**
 * Write-only GitHub PAT semantics:
 * - create: encrypt non-empty; null clears
 * - update: omit / empty string → leave unchanged; null → clear; non-empty → encrypt
 */
function prepareGithubTokenForPersist(
  input: CreateProjectInput | UpdateProjectInput,
  mode: 'create' | 'update'
): CreateProjectInput | UpdateProjectInput {
  if (!('github_token' in input) || input.github_token === undefined) {
    return input;
  }

  if (mode === 'update' && input.github_token === '') {
    const rest = { ...input };
    delete rest.github_token;
    return rest;
  }

  if (input.github_token === null || input.github_token === '') {
    return { ...input, github_token: null };
  }

  return {
    ...input,
    github_token: encryptSecretIfPresent(input.github_token) ?? null,
  };
}

type ProjectImageField = 'logo_url' | 'cover_picture';

type ProjectImageUploadResult = {
  readonly success: true;
  readonly url: string;
  readonly path: string;
  readonly project: ProjectRow;
};

export class ProjectsService {
  constructor(private readonly projectsRepository: ProjectsRepository) {}

  async listProjectsPaginated(
    query: ListProjectsQuery,
    actorId: string
  ): Promise<{
    projects: (ProjectListRow & { team_count: number })[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const accessible = await this.projectsRepository.listAccessibleProjectIds(actorId);
    if (accessible !== ALL_PROJECTS && accessible.length === 0) {
      return {
        projects: [],
        totalCount: 0,
        page: query.page,
        limit: query.limit,
        totalPages: 0,
      };
    }

    return await this.projectsRepository.listPaginated({
      accessibleIds: accessible,
      filters: {
        status: query.status,
        search: query.search,
      },
      page: query.page,
      limit: query.limit,
    });
  }

  async getProjectDetail(
    projectId: string,
    actorId: string
  ): Promise<ProjectDetailRow | null> {
    const accessible = await this.projectsRepository.listAccessibleProjectIds(actorId);
    if (accessible !== ALL_PROJECTS && !accessible.includes(projectId)) {
      throw new Error('Unauthorized project workspace access.');
    }
    return await this.projectsRepository.getDetailById(projectId);
  }

  async listProjectMembersPrisma(
    projectId: string,
    actorId: string
  ): Promise<ProjectMemberRow[]> {
    const accessible = await this.projectsRepository.listAccessibleProjectIds(actorId);
    if (accessible !== ALL_PROJECTS && !accessible.includes(projectId)) {
      throw new Error('Unauthorized project workspace access.');
    }
    return await this.projectsRepository.listMembersPrisma(projectId);
  }

  async getProjectById(projectId: string): Promise<ProjectRowWithOwner> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found.');
    }
    return project;
  }

  async listMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
    return await this.projectsRepository.listMembers(projectId);
  }

  async addMember(
    actorId: string,
    projectId: string,
    userId: string
  ): Promise<void> {
    await requireProjectManager(actorId);

    const currentMembers = await this.projectsRepository.listMembers(projectId);
    if (currentMembers.some((m) => m.user_id === userId)) {
      throw new Error('User is already a member of this project.');
    }

    await this.projectsRepository.addMember(projectId, userId, actorId);
  }

  async removeMember(
    actorId: string,
    projectId: string,
    userId: string
  ): Promise<void> {
    await requireProjectManager(actorId);

    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    if (project.owner_id === userId) {
      throw new Error(
        'Cannot remove the project owner from members. Change the project owner first.'
      );
    }

    await this.projectsRepository.removeMember(projectId, userId);
  }

  async createProject(
    actorId: string,
    input: CreateProjectInput
  ): Promise<ProjectRow> {
    await requireAdmin(actorId);

    const duplicate = await this.projectsRepository.findByKey(input.key);
    if (duplicate) {
      throw new Error(`A project with the key "${input.key}" already exists.`);
    }

    const prepared = prepareGithubTokenForPersist(
      input,
      'create'
    ) as CreateProjectInput;

    return await this.projectsRepository.create(prepared, actorId);
  }

  async updateProject(
    actorId: string,
    projectId: string,
    input: UpdateProjectInput,
    expectedUpdatedAt: string
  ): Promise<ProjectRow> {
    await requireProjectManager(actorId);

    if (input.key) {
      const duplicate = await this.projectsRepository.findByKey(
        input.key,
        projectId
      );
      if (duplicate) {
        throw new Error(
          `Another project with the key "${input.key}" already exists.`
        );
      }
    }

    const prepared = prepareGithubTokenForPersist(
      input,
      'update'
    ) as UpdateProjectInput;

    const previous =
      prepared.owner_id !== undefined
        ? await this.projectsRepository.findById(projectId)
        : null;

    const updated = await this.projectsRepository.update(
      projectId,
      prepared,
      actorId,
      expectedUpdatedAt
    );

    // Keep membership in sync when ownership is reassigned.
    if (
      prepared.owner_id &&
      previous &&
      prepared.owner_id !== previous.owner_id
    ) {
      await this.projectsRepository.ensureOwnerIsMember(
        projectId,
        prepared.owner_id,
        actorId
      );
    }

    return updated;
  }

  async softDeleteProject(
    actorId: string,
    projectId: string,
    expectedUpdatedAt: string
  ): Promise<ProjectRow> {
    await requireProjectManager(actorId);

    return await this.projectsRepository.update(
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

    return await this.projectsRepository.update(
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

    await this.projectsRepository.delete(projectId);
  }

  async linkImportedJiraParents(
    actorId: string,
    projectId: string,
    issues: { key: string; parentKey?: string | null }[]
  ): Promise<void> {
    await requireProjectManager(actorId);
    await this.projectsRepository.linkImportedJiraParents(projectId, issues);
  }

  async updateProjectLogo(
    actorId: string,
    projectId: string,
    file: Express.Multer.File,
    expectedUpdatedAt: string
  ): Promise<ProjectImageUploadResult> {
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
  ): Promise<ProjectImageUploadResult> {
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
  ): Promise<ProjectImageUploadResult> {
    await requireProjectManager(actorId);

    const existing = await this.projectsRepository.findById(projectId);
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
        project = await this.projectsRepository.update(
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
