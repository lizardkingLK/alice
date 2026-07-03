import {
  projectsRepository,
  type ProjectRowWithOwner,
} from './projects.repository';

export class ProjectsService {
  async listProjects(): Promise<ProjectRowWithOwner[]> {
    return await projectsRepository.listAll();
  }
}

export const projectsService = new ProjectsService();
