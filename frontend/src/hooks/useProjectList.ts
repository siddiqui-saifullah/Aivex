import { useState, useCallback } from 'react';
import {
    getProjects,
    createProject,
    deleteProject,
    updateProjectName
} from '../services/project.service';
import { useToast } from '../context/toast.context';
import type { SessionUser } from '../context/user.context';
import type { ProjectListState } from '../constants/options';
import type { Project } from '../types';

/**
 * Hook to manage project list state and operations
 */
export const useProjectList = (user: SessionUser | null) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [state, setState] = useState<ProjectListState>('loading');
    const { success, error: showError } = useToast();

    const fetchProjects = useCallback(async () => {
        setState('loading');
        if (!user) {
            setProjects([]);
            setState('empty');
            return;
        }
        try {
            const data = await getProjects();
            setProjects(data);
            setState(data.length ? 'success' : 'empty');
        } catch {
            setState('error');
        }
    }, [user]);

    const handleDelete = useCallback(async (id: string) => {
        const prevProjects = [...projects];
        const newProjects = projects.filter(p => p.id !== id);
        setProjects(newProjects);
        if (newProjects.length === 0) setState('empty');

        try {
            await deleteProject(id);
            success('Project deleted successfully');
        } catch {
            setProjects(prevProjects);
            setState('success');
            showError('Failed to delete project');
        }
    }, [projects, success, showError]);

    const handleRename = useCallback(async (project: Project, newName: string) => {
        if (!newName || newName === project.name) return;

        const prevProjects = [...projects];
        setProjects(projects.map(p => p.id === project.id ? { ...p, name: newName } : p));

        try {
            await updateProjectName(project.id, newName);
            success('Project renamed successfully');
        } catch {
            setProjects(prevProjects);
            showError('Failed to rename project');
        }
    }, [projects, success, showError]);

    const handleCreate = useCallback(async (data: { name: string; stack?: string }) => {
        const p = await createProject(data);
        setProjects((prev) => [p, ...prev]);
        setState('success');
        success('Project created successfully');
    }, [success]);

    return {
        projects,
        state,
        fetchProjects,
        handleDelete,
        handleRename,
        handleCreate
    };
};
