const PREFIX_PATTERNS = [
  /^CLOSE OUT:\s*/i,
  /^PRIOR TO CLOSE:\s*/i,
  /^EXECUTED CONTRACT:\s*/i,
  /^POST-OPTION EXPIRATION:\s*/i,
  /^OPTION PERIOD:\s*/i,
  /^UNDER CONTRACT:\s*/i,
  /^APPLICATION:\s*/i,
  /^GO LIVE:\s*/i,
  /^COMING SOON:\s*/i,
  /^MARKETING PREP:\s*/i,
  /^MARKETING:\s*/i,
  /^Social Post\s*:\s*/i,
  /^Follow Up:\s*/i,
  /^Close Out:\s*/i,
];

const TITLE_SHORTCUTS = [
  [/Social Post\s*:\s*Just Sold/i, 'Just Sold'],
  [/Social Post\s*:\s*Under Contract/i, 'Under Contract'],
  [/Social Post\s*:\s*Review/i, 'Review post'],
  [/Confirm commission received/i, 'Commission in'],
  [/Schedule Inspection/i, 'Schedule inspection'],
  [/Schedule Walkthrough/i, 'Schedule walkthrough'],
  [/Schedule Closing/i, 'Schedule closing'],
  [/Request CDA/i, 'Request CDA'],
  [/Confirm Funding/i, 'Confirm funding'],
  [/Track Appraisal/i, 'Track appraisal'],
  [/Track Financing/i, 'Track financing'],
  [/Send Homestead reminder/i, 'Homestead reminder'],
  [/Collect birthdays/i, 'Collect birthdays'],
  [/Notify TC/i, 'Notify TC'],
  [/Enter transaction into Skyslope/i, 'Enter Skyslope'],
  [/Check for open permits/i, 'Check permits'],
  [/Order closing gift/i, 'Order closing gift'],
  [/Order Closing Gift/i, 'Order closing gift'],
  [/Order referral gift/i, 'Order referral gift'],
  [/Ask for [Rr]eview/i, 'Ask for review'],
  [/Write close out notes/i, 'Close out notes'],
  [/Write Thank You notes/i, 'Thank you notes'],
  [/Update FUB/i, 'Update FUB'],
  [/Add contact to Reach list/i, 'Reach list'],
  [/Leaseback\?/i, 'Leaseback reminders'],
  [/Add transaction to Zillow/i, 'Add to Zillow'],
  [/Check MLS/i, 'Check MLS status'],
  [/Request Final Closing Statement/i, 'Final closing stmt'],
  [/Confirm final walkthrough/i, 'Walkthrough & keys'],
  [/Remind Meredith.*wire/i, 'Meredith wire info'],
  [/Closing confirmation to Buyer/i, 'Closing confirm buyer'],
  [/Closing confirmation to Lender/i, 'Closing confirm lender'],
  [/Verify Closing Disclosure/i, 'Closing disclosure'],
  [/Confirm repairs are completed/i, 'Repairs complete'],
  [/Confirm Wire info/i, 'Wire info received'],
  [/Confirm Title Commitment/i, 'Title commitment'],
  [/Welcome email to buyer/i, 'Buyer welcome email'],
  [/Review contract for completion/i, 'Review contract'],
  [/Submit CDA info/i, 'Submit CDA'],
  [/Update contact in FUB to/i, 'FUB under contract'],
  [/Remove listing from Zillow/i, 'Remove from Zillow'],
  [/Pick up sign/i, 'Pick up sign'],
  [/Install sign and lockbox/i, 'Sign & lockbox'],
  [/Set listing to live/i, 'MLS go live'],
  [/Confirm listing on Zillow/i, 'Zillow confirm'],
  [/Send credit\/background check/i, 'Credit check link'],
  [/Summarize qualified applications/i, 'Summarize applications'],
  [/List property as FLEX in MLS/i, 'FLEX in MLS'],
  [/Schedule any applicable realtor property tours/i, 'Property tours'],
  [/Revise virtual tour website/i, 'Revise virtual tour'],
  [/Create Bifold or 2 Pager/i, 'Bifold or 2 pager'],
  [/Agent final review of the draft/i, 'MLS draft review'],
  [/Create and upload doc: Offer Instructions/i, 'Offer instructions'],
  [/Add open houses to MLS/i, 'Open houses to MLS'],
  [/Set up property website/i, 'Property website'],
  [/Add photos to MLS/i, 'Photos to MLS'],
  [/Add docs to MLS/i, 'Docs to MLS'],
  [/Draft listing in MLS/i, 'Draft MLS listing'],
  [/Create & draft listing in MLS/i, 'Draft MLS listing'],
  [/Seller to submit 10 Things/i, 'Seller 10 Things'],
  [/Obtain septic plans from county/i, 'Septic plans'],
  [/Schedule Floor Plan Graphics/i, 'Floor plan graphics'],
  [/Order energy audit/i, 'Energy audit'],
  [/Confirm all utilities are turned on/i, 'Utilities on'],
  [/Schedule photos\/videos\/drone/i, 'Photos/videos/drone'],
  [/Schedule staging consultation/i, 'Staging consult'],
  [/Determine what make ready work/i, 'Make-ready work'],
  [/Assign lockbox in Supra/i, 'Lockbox & showings'],
  [/Assign lockbox in Supraweb/i, 'Lockbox & showings'],
  [/Open House planning/i, 'Open house planning'],
  [/Add this language to private remarks/i, 'Private remarks note'],
  [/MARKETING:\s*Post sold social/i, 'Sold social post'],
  [/MARKETING:\s*Remove listing from current listings reel/i, 'Remove from reel'],
  [/MARKETING:\s*Post under contract social/i, 'Under contract post'],
  [/MARKETING:\s*Update listing status on website/i, 'Update listing status'],
  [/MARKETING:\s*Post Just Listed/i, 'Just Listed post'],
  [/MARKETING:\s*Add listing to Heyday website/i, 'Heyday website'],
  [/MARKETING:\s*eXp Luxury listing/i, 'eXp Luxury listing'],
  [/MARKETING:\s*Post Coming Soon/i, 'Coming Soon post'],
  [/Create on-site property marketing book/i, 'Property book'],
];

function stripPrefixes(title) {
  let text = title.trim();
  let prev;
  do {
    prev = text;
    for (const pattern of PREFIX_PATTERNS) {
      text = text.replace(pattern, '');
    }
    text = text.trim();
  } while (text !== prev && text.length > 0);
  return text.trim() || title.trim();
}

function cleanPhrase(text) {
  return text
    .replace(/\([^)]*\)/g, '')
    .replace(/\*/g, '')
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSegment(text) {
  let segment = text;
  if (segment.includes(',')) segment = segment.split(',')[0].trim();
  if (segment.includes(' - ') && segment.split(' - ')[0].length <= 24) {
    segment = segment.split(' - ')[0].trim();
  }
  if (segment.includes('/') && segment.length > 24) {
    segment = segment.split('/')[0].trim();
  }
  if (segment.includes('?') && segment.indexOf('?') < 28) {
    segment = segment.slice(0, segment.indexOf('?') + 1).trim();
  }
  return segment;
}

function shortenWords(text, maxWords = 3) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ');
}

function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function deriveNickname(title) {
  if (!title?.trim()) return '';

  for (const [pattern, replacement] of TITLE_SHORTCUTS) {
    if (pattern.test(title)) return replacement;
  }

  let text = cleanPhrase(stripPrefixes(title));
  text = firstSegment(text);

  if (text.length > 28) {
    text = shortenWords(text, 3);
  }
  if (text.length > 28) {
    text = shortenWords(text, 2);
  }

  return capitalize(text);
}
