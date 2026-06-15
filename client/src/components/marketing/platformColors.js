const FALLBACK = {
  TikTok: '#000000',
  Instagram: '#E1306C',
  Facebook: '#1877F2',
  LinkedIn: '#4f2a50',
  YouTube: '#FF0000',
  Podcast: '#2c4a6e',
  'IG Grid': '#0d9488',
  'IG Story': '#38bdf8',
  Blog: '#7f1d1d',
  'Pop By': '#d4a574',
};

const PASTEL_CHIP = {
  Instagram: { bg: 'bg-pink-200', text: 'text-pink-950', border: 'border border-pink-300', icon: 'photo_camera' },
  TikTok: { bg: 'bg-neutral-800', text: 'text-white', border: 'border border-neutral-900', icon: 'play_circle' },
  YouTube: { bg: 'bg-red-200', text: 'text-red-950', border: 'border border-red-300', icon: 'play_circle' },
  Facebook: { bg: 'bg-blue-200', text: 'text-blue-950', border: 'border border-blue-300', icon: 'thumb_up' },
  LinkedIn: { bg: 'bg-purple-200', text: 'text-purple-950', border: 'border border-purple-300', icon: 'article' },
  Podcast: { bg: 'bg-indigo-200', text: 'text-indigo-950', border: 'border border-indigo-300', icon: 'podcasts' },
  'IG Grid': { bg: 'bg-teal-200', text: 'text-teal-950', border: 'border border-teal-300', icon: 'grid_on' },
  'IG Story': { bg: 'bg-cyan-200', text: 'text-cyan-950', border: 'border border-cyan-300', icon: 'auto_stories' },
  Blog: { bg: 'bg-rose-200', text: 'text-rose-950', border: 'border border-rose-300', icon: 'article' },
  'Pop By': { bg: 'bg-orange-200', text: 'text-orange-950', border: 'border border-orange-300', icon: 'celebration' },
  Newsletters: { bg: 'bg-violet-200', text: 'text-violet-950', border: 'border border-violet-300', icon: 'mail' },
};

export function colorForPlatform(platform, goals = []) {
  const g = goals.find((x) => x.platform === platform);
  return g?.color || FALLBACK[platform] || '#053e3f';
}

export function chipStyleForPlatform(platform) {
  const key = Object.keys(PASTEL_CHIP).find(
    (k) => k.toLowerCase() === (platform || '').toLowerCase(),
  );
  if (key) return PASTEL_CHIP[key];
  return { bg: 'bg-fuchsia-200', text: 'text-fuchsia-950', border: 'border border-fuchsia-300', icon: 'campaign' };
}
