import type { Project } from '@/app/projects/_services/projects.service.base';

export function filterActiveProjects(projects: Project[]): Project[] {
  return projects
    .filter((project) => project.status === 'active' && !project.deleted_at)
    .sort((a, b) => a.name.localeCompare(b.name));
}
