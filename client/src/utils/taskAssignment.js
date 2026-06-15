export function resolveTaskRole(title) {
  const t = title;
  const upper = title.toUpperCase();

  if (/Meredith/i.test(t) || /^Agent to /i.test(t) || /Agent final review/i.test(t)) {
    return 'owner_lead';
  }

  if (
    upper.includes('MARKETING')
    || upper.includes('SOCIAL POST')
    || /^POST /i.test(t)
    || /Re-post/i.test(t)
    || /carousel/i.test(t)
    || /walk through|walkthrough tour|video tour/i.test(t)
    || /Heyday website|property website|property carousel/i.test(t)
    || /FB\/IG|FB groups|Instagram|Clubhouse|Workplace|Zenlist|ALN/i.test(t)
    || /Just Listed|Coming Soon on FB|sold social post|under contract social/i.test(t)
    || /Bifold|Open House planning|current listing carousel|listings reel/i.test(t)
    || /90 Day Plan|90 days on market|guess the price|detail shots|Neighborhood highlight/i.test(t)
    || /Remove "JUST LISTED"|syndicated sites|FLEX in MLS/i.test(t)
  ) {
    return 'marketing';
  }

  if (
    /Track Appraisal|Track Financing/i.test(t)
    || /\bCDA\b/i.test(t)
    || /commission received|Settlement Statement|Confirm Funding/i.test(t)
    || /Wire info|wire instructions/i.test(t)
    || /compliance in Skyslope/i.test(t)
    || /\bInvoice\b|\bW9\b/i.test(t)
    || /credit\/background check|Verify rental history|Summarize qualified applications/i.test(t)
    || /Confirm appraisal made value|Determine Appraisal due date/i.test(t)
    || /Homestead reminder/i.test(t)
  ) {
    return 'analyst';
  }

  return 'operations';
}

export function defaultAssigneeId(title, members) {
  const role = resolveTaskRole(title);
  const member = members.find((m) => m.role === role);
  return member?.id ?? '';
}

export function buildAssignments(taskList, members) {
  const init = {};
  taskList.forEach((task) => {
    const existing = task.assigned_to ?? task.suggested_assignee;
    init[task.id] = existing || defaultAssigneeId(task.title, members);
  });
  return init;
}
