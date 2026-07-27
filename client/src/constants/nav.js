import {
  Users,
  CheckSquare,
  BookUser,
  BarChart2,
  Building2,
  Megaphone,
  MessageSquare,
  Target,
} from 'lucide-react';

/** Primary hub navigation — shared by Sidebar + MobileBottomNav. */
export const NAV_ITEMS = [
  { to: '/team-ops', label: 'Team Hub', shortLabel: 'Team', icon: Users },
  { to: '/tasks', label: 'Task Hub', shortLabel: 'Tasks', icon: CheckSquare, taskHub: true },
  { to: '/transactions', label: 'Transactions', shortLabel: 'Trans', icon: Building2 },
  { to: '/opportunities', label: 'Opportunities', shortLabel: 'Opps', icon: Target },
  { to: '/marketing', label: 'Marketing', shortLabel: 'Market', icon: Megaphone },
  { to: '/crm', label: 'CRM Hub', shortLabel: 'CRM', icon: BookUser },
  { to: '/revenue', label: 'Revenue', shortLabel: 'Revenue', icon: BarChart2 },
  { to: '/feedback', label: 'Feedback', shortLabel: 'Feedback', icon: MessageSquare },
];

/** Approximate height of MobileBottomNav (icon+label+padding) for content padding. */
export const MOBILE_BOTTOM_NAV_HEIGHT_PX = 64;
