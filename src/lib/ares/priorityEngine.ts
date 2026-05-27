import type { AresProject } from "./types";

export function sortProjectsForAttention(projects: AresProject[]) {
  return [...projects].sort((a, b) => {
    const blockerWeight = Number(b.blocker.trim().length > 0) - Number(a.blocker.trim().length > 0);
    if (blockerWeight !== 0) return blockerWeight;
    const priorityWeight = Number(b.priority === "高") - Number(a.priority === "高");
    if (priorityWeight !== 0) return priorityWeight;
    return a.progress - b.progress;
  });
}

export function getTopProjects(projects: AresProject[], limit = 3) {
  return sortProjectsForAttention(projects).slice(0, limit);
}

export function getBlockedProjects(projects: AresProject[]) {
  return projects.filter((project) => project.blocker.trim().length > 0);
}
