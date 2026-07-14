import { useState, useEffect, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import TaskHubPersonHeader from '../components/TaskHubPersonHeader';
import ProjectListPanel from '../components/projects/ProjectListPanel';
import { AddProjectButton, AddProjectForm } from '../components/projects/AddProjectControls';
import { getTeamProfile } from '../data/teamProfiles';
import { useAuth } from '../context/AuthContext';

export default function UserProjectDashboard() {
  const { userId } = useParams();
  const { user } = useAuth();

  const [member, setMember] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddProject, setShowAddProject] = useState(false);

  const numericUserId = Number(userId);
  const canWrite = user && (user.id === numericUserId || user.role === 'admin');

  const fetchMember = useCallback(async () => {
    const res = await fetch(`/api/team/${userId}`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setMember(json.member);
    }
  }, [userId]);

  const fetchProjects = useCallback(async () => {
    const res = await fetch(`/api/projects?user_id=${userId}`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setProjects(json.projects || []);
    }
  }, [userId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await fetchProjects();
    setLoading(false);
  }, [fetchProjects]);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleCreateProject(data) {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user_id: numericUserId, ...data }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    await fetchProjects();
    setShowAddProject(false);
    return json.project;
  }

  async function handleUpdateProject(projectId, data) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (res.ok) {
      await fetchProjects();
    }
  }

  async function handleDeleteProject(projectId) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    }
  }

  if (!userId) return <Navigate to="/tasks" replace />;

  const profile = member ? getTeamProfile(member.email) : null;

  return (
    <DashboardLayout
      title={member ? `${member.name}'s Task Hub` : 'Task Hub'}
      fillViewport
      className="p-0 overflow-hidden"
    >
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <TaskHubPersonHeader
          userId={userId}
          title="Project Dashboard"
          member={member}
          profile={profile}
        />

        <div className="border-t border-sky bg-surface-container-lowest px-6 lg:px-8 lg:pl-10 py-6">
          {loading ? (
            <p className="text-sm text-on-surface-variant">Loading…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="min-w-[12rem] flex-1 max-w-sm">
                  {showAddProject ? (
                    <AddProjectForm
                      onSave={handleCreateProject}
                      onCancel={() => setShowAddProject(false)}
                    />
                  ) : (
                    <AddProjectButton
                      onClick={() => setShowAddProject(true)}
                      readOnly={!canWrite}
                    />
                  )}
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                </p>
              </div>

              {projects.length === 0 && !showAddProject ? (
                <div className="flex flex-col items-center justify-center text-center py-20 px-4">
                  <p className="text-lg font-semibold text-primary mb-1">No projects yet</p>
                  <p className="text-sm text-on-surface-variant mb-5 max-w-sm">
                    Track bigger initiatives here with an optional target date. Day-to-day work lives under Admin Tasks.
                  </p>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => setShowAddProject(true)}
                      className="text-sm font-bold bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      + Add a project
                    </button>
                  )}
                </div>
              ) : (
                <ProjectListPanel
                  projects={projects}
                  onCreate={handleCreateProject}
                  onUpdate={handleUpdateProject}
                  onDelete={handleDeleteProject}
                  readOnly={!canWrite}
                />
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
