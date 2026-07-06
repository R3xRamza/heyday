import tessaPhoto from '../assets/team/tessa.jpg';
import adamPhoto from '../assets/team/adam.jpg';
import margaretPhoto from '../assets/team/margaret.jpg';
import meredithPhoto from '../assets/team/meredith.jpg';

export const TEAM_PROFILES = {
  'tessa@theheydaygroup.com': {
    role: 'Operations',
    img: tessaPhoto,
  },
  'adam@theheydaygroup.com': {
    role: 'Marketing',
    img: adamPhoto,
  },
  'margaret@theheydaygroup.com': {
    role: 'Operations',
    img: margaretPhoto,
  },
  'meredith@theheydaygroup.com': {
    role: 'Owner/Lead',
    img: meredithPhoto,
  },
};

export function getTeamProfile(email) {
  return TEAM_PROFILES[email] || { role: 'Team Member', img: null };
}

export function getTeamProfileByUserId(userId, members = []) {
  const member = members.find((m) => m.id === userId);
  return member ? getTeamProfile(member.email) : { role: 'Team Member', img: null };
}
