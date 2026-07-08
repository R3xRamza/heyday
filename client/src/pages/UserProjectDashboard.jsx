import { useState, useEffect, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import TaskHubPersonHeader from '../components/TaskHubPersonHeader';
import ProjectListPanel from '../components/projects/ProjectListPanel';
import { TodoColumnList } from '../components/projects/ProjectTodoBoard';
import { ColumnHeader } from '../components/projects/dashboardShared';
import { AddProjectButton, AddProjectForm } from '../components/projects/AddProjectControls';
import { AddTaskRow, AddTaskSpacer } from '../components/projects/AddTaskControls';
import { formatLastSaved } from '../utils/projectDashboard';
import { getTeamProfile } from '../data/teamProfiles';
import { useAuth } from '../context/AuthContext';

export default function UserProjectDashboard() {
  const { userId } = useParams();
  const { user } = useAuth();

  const [member, setMember] = useState(null);
  const [projects, setProjects] = useState([]);
  const [items, setItems] = useState([]);
  const [todosUpdatedAt, setTodosUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddProject, setShowAddProject] = useState(false);

  const numericUserId = Number(userId);
  const canWrite = user && (user.id === numericUserId || user.role === 'admin');

  const pending = items.filter((i) => !i.is_complete);
  const done = items.filter((i) => i.is_complete);

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

  const fetchTodos = useCallback(async () => {
    const res = await fetch(`/api/user-todos?user_id=${userId}`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setItems(json.items || []);
      setTodosUpdatedAt(json.updated_at);
    }
  }, [userId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProjects(), fetchTodos()]);
    setLoading(false);
  }, [fetchProjects, fetchTodos]);

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
    setProjects((prev) => [json.project, ...prev]);
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
      const json = await res.json();
      setProjects((prev) => prev.map((p) => (p.id === projectId ? json.project : p)));
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

  function syncTodos(json) {
    if (json.item) {
      setItems((prev) => {
        const exists = prev.some((i) => i.id === json.item.id);
        if (exists) return prev.map((i) => (i.id === json.item.id ? json.item : i));
        return [...prev, json.item];
      });
    }
    if (json.updated_at !== undefined) setTodosUpdatedAt(json.updated_at);
  }

  async function handleAddItem(body) {
    const res = await fetch('/api/user-todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        user_id: numericUserId,
        title: body.title,
        notes: body.notes,
        due_date: body.due_date,
      }),
    });
    if (res.ok) syncTodos(await res.json());
  }

  async function handleToggleItem(item) {
    const is_complete = !item.is_complete;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_complete } : i)));
    const res = await fetch(`/api/user-todos/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_complete }),
    });
    if (res.ok) {
      syncTodos(await res.json());
    } else {
      fetchTodos();
    }
  }

  async function handleUpdateItem(itemId, body) {
    const res = await fetch(`/api/user-todos/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (res.ok) syncTodos(await res.json());
  }

  async function handleDeleteItem(itemId) {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    const res = await fetch(`/api/user-todos/${itemId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      const json = await res.json();
      if (json.updated_at !== undefined) setTodosUpdatedAt(json.updated_at);
    } else {
      fetchTodos();
    }
  }

  if (!userId) return <Navigate to="/tasks" replace />;

  const profile = member ? getTeamProfile(member.email) : null;
  const doneMeta = `${done.length} of ${items.length} done · last saved ${formatLastSaved(todosUpdatedAt)}`;

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

        <div className={`sticky top-0 z-10 h-[calc(100vh-4.25rem)] overflow-hidden border-t border-sky bg-surface-container-lowest`}>
          {loading ? (
            <p className="p-6 text-sm text-on-surface-variant">Loading…</p>
          ) : (
            <div className="h-full grid grid-cols-1 lg:grid-cols-[380px_1fr_1fr] grid-rows-[auto_auto_1fr] gap-x-4 gap-y-0 px-6 lg:px-8 lg:pl-10 pt-2 pb-4 overflow-hidden">
              {/* Row 1: add buttons */}
              <div className="pr-4 lg:border-r border-outline-variant/15">
                {showAddProject ? (
                  <AddProjectForm onSave={handleCreateProject} onCancel={() => setShowAddProject(false)} />
                ) : (
                  <AddProjectButton onClick={() => setShowAddProject(true)} readOnly={!canWrite} />
                )}
              </div>
              <div className="px-2">
                <AddTaskRow onAdd={handleAddItem} readOnly={!canWrite} />
              </div>
              <div className="px-2">
                <AddTaskSpacer />
              </div>

              {/* Row 2: aligned headers */}
              <div className="pr-4 lg:border-r border-outline-variant/15">
                <ColumnHeader label="Projects" count={projects.length} badgeClass="bg-sky/30 text-feather" />
              </div>
              <div className="px-2">
                <ColumnHeader label="In Progress" count={pending.length} badgeClass="bg-lemon text-feather" />
              </div>
              <div className="px-2">
                <ColumnHeader
                  label="Done"
                  count={done.length}
                  badgeClass="bg-primary text-white"
                  trailing={doneMeta}
                />
              </div>

              {/* Row 3: scrollable content */}
              <div className="min-h-0 overflow-y-auto custom-scrollbar pr-4 lg:border-r border-outline-variant/15">
                <ProjectListPanel
                  embedded
                  projects={projects}
                  onCreate={handleCreateProject}
                  onUpdate={handleUpdateProject}
                  onDelete={handleDeleteProject}
                  readOnly={!canWrite}
                />
              </div>
              <div className="min-h-0 overflow-y-auto custom-scrollbar px-2 space-y-3">
                <TodoColumnList
                  items={pending}
                  emptyMessage={canWrite ? 'No tasks in progress.' : 'No pending tasks.'}
                  onToggle={handleToggleItem}
                  onUpdate={handleUpdateItem}
                  onDelete={handleDeleteItem}
                  readOnly={!canWrite}
                />
              </div>
              <div className="min-h-0 overflow-y-auto custom-scrollbar px-2 space-y-3 rounded-xl bg-sky/15">
                <TodoColumnList
                  items={done}
                  emptyMessage="No completed tasks yet."
                  onToggle={handleToggleItem}
                  onUpdate={handleUpdateItem}
                  onDelete={handleDeleteItem}
                  readOnly={!canWrite}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
