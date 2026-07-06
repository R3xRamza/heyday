import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/shared/Icon';
import TeamAvatar from '../components/TeamAvatar';
import { getTeamProfile } from '../data/teamProfiles';
import TeamTaskOverviewPanel from '../components/tasks/TeamTaskOverviewPanel';
import TeamAdminTasksPanel from '../components/tasks/TeamAdminTasksPanel';

function TeamMemberCardSkeleton() {
  return (
    <div className="rounded-xl border border-outline-variant/15 shadow-executive bg-white p-4 animate-pulse">
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-full bg-surface-container-low shrink-0" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-4 w-24 bg-surface-container-low rounded" />
          <div className="h-2.5 w-16 bg-surface-container-low rounded" />
        </div>
      </div>
      <div className="mb-3 space-y-1.5">
        <div className="flex justify-between">
          <div className="h-2.5 w-14 bg-surface-container-low rounded" />
          <div className="h-2.5 w-10 bg-surface-container-low rounded" />
        </div>
        <div className="h-1.5 w-full bg-surface-container-low rounded-full" />
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 h-12 rounded-md bg-surface-container-low" />
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-outline-variant/15 flex justify-between">
        <div className="h-3 w-16 bg-surface-container-low rounded" />
        <div className="h-3 w-20 bg-surface-container-low rounded" />
      </div>
    </div>
  );
}

function TeamMemberTaskCard({ member, profile, onOpenTasks }) {
  const { stats } = member;
  const hasTasks = stats.total > 0;

  return (
    <button
      type="button"
      onClick={onOpenTasks}
      className="group w-full bg-white p-4 rounded-xl border border-outline-variant/15 shadow-executive hover:border-secondary/40 hover:-translate-y-0.5 transition-all text-left flex flex-col items-stretch"
    >
      <div className="flex items-start gap-2.5 mb-3">
        <TeamAvatar
          email={member.email}
          name={member.name}
          size="md"
          borderClassName="border-2 border-surface-container"
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-base text-primary truncate group-hover:text-secondary transition-colors">
            {member.name}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant truncate">
            {profile.role}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-baseline text-[10px] mb-1">
          <span className="text-on-surface-variant font-bold uppercase tracking-wide">Progress</span>
          <span className="text-secondary font-black tabular-nums">
            {hasTasks ? `${stats.complete}/${stats.total}` : '—'}
          </span>
        </div>
        {hasTasks ? (
          <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-secondary h-full rounded-full transition-all"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
        ) : (
          <p className="text-[10px] text-on-surface-variant">No tasks</p>
        )}
      </div>

      <div className="flex gap-1.5">
        <div className="flex-1 rounded-md bg-surface-container-low px-2 py-1.5 text-center">
          <div className="text-lg font-black text-primary leading-none tabular-nums">{stats.pending}</div>
          <div className="text-[8px] uppercase font-bold text-on-surface-variant mt-0.5">Pending</div>
        </div>
        <div className="flex-1 rounded-md bg-secondary/10 px-2 py-1.5 text-center">
          <div className="text-lg font-black text-secondary leading-none tabular-nums">{stats.active}</div>
          <div className="text-[8px] uppercase font-bold text-on-surface-variant mt-0.5">Active</div>
        </div>
        <div
          className={`flex-1 rounded-md px-2 py-1.5 text-center ${
            stats.overdue > 0 ? 'bg-error/10' : 'bg-surface-container-low'
          }`}
        >
          <div
            className={`text-lg font-black leading-none tabular-nums ${
              stats.overdue > 0 ? 'text-error' : 'text-primary'
            }`}
          >
            {stats.overdue}
          </div>
          <div
            className={`text-[8px] uppercase font-bold mt-0.5 ${
              stats.overdue > 0 ? 'text-error' : 'text-on-surface-variant'
            }`}
          >
            Overdue
          </div>
        </div>
      </div>

      <div
        className="mt-3 pt-3 border-t border-outline-variant/15 flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Link
          to={`/tasks/${member.id}/projects`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline shrink-0"
        >
          <Icon name="folder" className="!text-[14px]" />
          Projects
        </Link>
        <Link
          to={`/tasks/${member.id}/admin`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline shrink-0"
        >
          <Icon name="assignment" className="!text-[14px]" />
          Admin tasks
        </Link>
      </div>
    </button>
  );
}

export default function TeamTaskOverview() {
  const navigate = useNavigate();
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [overviewTasks, setOverviewTasks] = useState([]);
  const [adminTasks, setAdminTasks] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const fetchTeam = useCallback(() => {
    setLoadingTeam(true);
    fetch('/api/team', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setTeamMembers(json.members || []))
      .finally(() => setLoadingTeam(false));
  }, []);

  const fetchOverview = useCallback(() => {
    setLoadingOverview(true);
    fetch('/api/tasks/team-overview', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setOverviewTasks(json.tasks || []))
      .finally(() => setLoadingOverview(false));
  }, []);

  const fetchAdmin = useCallback(() => {
    setLoadingAdmin(true);
    fetch('/api/tasks/team-admin-overview', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setAdminTasks(json.tasks || []))
      .finally(() => setLoadingAdmin(false));
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    fetchAdmin();
  }, [fetchAdmin]);

  const emailByUserId = useMemo(
    () => Object.fromEntries(teamMembers.map((m) => [m.id, m.email])),
    [teamMembers],
  );

  return (
    <DashboardLayout title="Team Task Hub" className="p-8">
      <div className="max-w-[1440px] mx-auto">
        <div className="grid grid-cols-12 gap-gutter items-start">
          <section className="col-span-12 mb-4">
            {loadingTeam ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
                {[0, 1, 2, 3].map((i) => (
                  <TeamMemberCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
                {teamMembers.map((member) => (
                  <TeamMemberTaskCard
                    key={member.id}
                    member={member}
                    profile={getTeamProfile(member.email)}
                    onOpenTasks={() => navigate(`/tasks/${member.id}`)}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-gutter items-stretch">
            <div className="lg:col-span-8">
              <TeamTaskOverviewPanel
                tasks={overviewTasks}
                loading={loadingOverview}
                emailByUserId={emailByUserId}
              />
            </div>
            <div className="lg:col-span-4">
              <TeamAdminTasksPanel
                tasks={adminTasks}
                teamMembers={teamMembers}
                loading={loadingAdmin}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
