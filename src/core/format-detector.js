/**
 * Format detector — identifies the content format/genre based on
 * lightweight heuristics. No ML required.
 *
 * Detected formats: linkedin, essay, email, tweet, short-form
 * Each format carries calibration context that adjusts persona expectations.
 */

const SALUTATION_PATTERNS = /^(hi|hey|hello|dear|good morning|good afternoon|good evening)\b/im;
const SIGNOFF_PATTERNS = /^(best|regards|cheers|thanks|sincerely|kind regards|best regards|thank you)\b/im;
const HASHTAG_PATTERN = /#[a-zA-Z]\w{1,30}/g;

/**
 * Detect the format/genre of the input text.
 * Uses three signal sources in priority order:
 * 1. Explicit --format flag (highest priority)
 * 2. Frontmatter/filename hints (platform: linkedin, *-linkedin.md, etc.)
 * 3. Heuristic analysis of the text itself (fallback)
 */
export function detectFormat(text, metadata, explicitFormat = null, fileContext = null) {
  if (explicitFormat) {
    if (!FORMAT_CALIBRATIONS[explicitFormat]) {
      const valid = Object.keys(FORMAT_CALIBRATIONS).join(', ');
      throw new Error(`Unknown format "${explicitFormat}". Valid formats: ${valid}`);
    }
    return {
      format: explicitFormat,
      confidence: 'explicit',
      source: 'flag',
      calibration: FORMAT_CALIBRATIONS[explicitFormat],
    };
  }

  const contextFormat = detectFromContext(text, fileContext);
  if (contextFormat) {
    return {
      format: contextFormat,
      confidence: 'high',
      source: 'context',
      calibration: FORMAT_CALIBRATIONS[contextFormat],
    };
  }

  const signals = extractSignals(text, metadata);
  const scores = scoreFormats(signals);

  const detected = scores[0];
  return {
    format: detected.format,
    confidence: detected.score > 3 ? 'high' : detected.score > 1.5 ? 'medium' : 'low',
    source: 'heuristic',
    calibration: FORMAT_CALIBRATIONS[detected.format],
    signals,
  };
}

/**
 * Extract format from frontmatter or filename before falling back to heuristics.
 */
function detectFromContext(text, fileContext) {
  const frontmatterMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch) {
    const fm = frontmatterMatch[1];

    const platformMatch = fm.match(/^platform:\s*(.+)$/m);
    if (platformMatch) {
      const platform = platformMatch[1].trim().toLowerCase();
      if (platform === 'linkedin') return 'linkedin';
      if (platform === 'twitter' || platform === 'x') return 'tweet';
      if (platform === 'email' || platform === 'newsletter') return 'email';
      if (platform === 'substack' || platform === 'blog' || platform === 'essay') return 'essay';
    }

    const typeMatch = fm.match(/^type:\s*(.+)$/m);
    if (typeMatch) {
      const type = typeMatch[1].trim().toLowerCase();
      if (type === 'linkedin-post' || type === 'linkedin') return 'linkedin';
      if (type === 'tweet' || type === 'thread') return 'tweet';
      if (type === 'email') return 'email';
      if (type === 'essay' || type === 'article' || type === 'blog') return 'essay';
    }
  }

  if (fileContext && fileContext.filename) {
    const name = fileContext.filename.toLowerCase();
    if (name.includes('linkedin')) return 'linkedin';
    if (name.includes('tweet') || name.includes('thread')) return 'tweet';
    if (name.includes('email') || name.includes('newsletter')) return 'email';
  }

  return null;
}

function extractSignals(text, metadata) {
  const lines = text.split('\n');
  const nonEmptyLines = lines.filter(l => l.trim());
  const lineBreakRatio = nonEmptyLines.length > 0
    ? (lines.length - nonEmptyLines.length) / nonEmptyLines.length
    : 0;

  const hashtags = text.match(HASHTAG_PATTERN) || [];
  const hasSalutation = SALUTATION_PATTERNS.test(text.slice(0, 200));
  const hasSignoff = SIGNOFF_PATTERNS.test(text.slice(-200));

  return {
    wordCount: metadata.wordCount,
    headingCount: metadata.headingCount,
    paragraphCount: metadata.paragraphCount,
    avgSentenceLength: metadata.avgSentenceLength,
    lineBreakRatio,
    hashtagCount: hashtags.length,
    hasSalutation,
    hasSignoff,
    hasLists: metadata.hasLists,
    hasLinks: metadata.hasLinks,
  };
}

function scoreFormats(signals) {
  const scores = [];

  // LinkedIn scoring
  let linkedin = 0;
  if (signals.wordCount >= 50 && signals.wordCount <= 400) linkedin += 2;
  else if (signals.wordCount > 400 && signals.wordCount <= 600) linkedin += 0.5;
  if (signals.hashtagCount > 0) linkedin += 1.5;
  if (signals.lineBreakRatio > 0.4) linkedin += 1;
  if (signals.headingCount === 0) linkedin += 0.5;
  if (!signals.hasSalutation && !signals.hasSignoff) linkedin += 0.5;
  if (signals.avgSentenceLength < 16) linkedin += 0.5;
  scores.push({ format: 'linkedin', score: linkedin });

  // Tweet scoring
  let tweet = 0;
  if (signals.wordCount <= 70) tweet += 3;
  else if (signals.wordCount <= 100) tweet += 1;
  if (signals.paragraphCount <= 2) tweet += 1;
  if (signals.hashtagCount > 0 && signals.wordCount < 80) tweet += 1;
  scores.push({ format: 'tweet', score: tweet });

  // Email scoring
  let email = 0;
  if (signals.hasSalutation) email += 2.5;
  if (signals.hasSignoff) email += 2;
  if (signals.wordCount >= 50 && signals.wordCount <= 500) email += 0.5;
  scores.push({ format: 'email', score: email });

  // Essay scoring
  let essay = 0;
  if (signals.wordCount > 500) essay += 2;
  else if (signals.wordCount > 350) essay += 1;
  if (signals.headingCount > 0) essay += 1.5;
  if (signals.avgSentenceLength > 14) essay += 0.5;
  if (signals.hasLists) essay += 0.5;
  if (signals.paragraphCount > 5) essay += 0.5;
  scores.push({ format: 'essay', score: essay });

  // Short-form (fallback for anything that doesn't match well)
  let shortForm = 0;
  if (signals.wordCount >= 50 && signals.wordCount <= 350) shortForm += 1;
  if (signals.headingCount === 0) shortForm += 0.5;
  if (!signals.hasSalutation) shortForm += 0.3;
  scores.push({ format: 'short-form', score: shortForm });

  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Format calibrations — injected into persona system prompts to adjust
 * what each persona considers "good" for this format.
 */
export const FORMAT_CALIBRATIONS = {
  linkedin: {
    name: 'LinkedIn Post',
    description: 'Short-form professional content (150-350 words). Plain text only — no headings, no bold, no markdown. Line breaks are the only structural tool. Read on mobile in a scrolling feed.',
    expectations: {
      hook: 'First 2 lines must earn the "see more" click. The hook competes with job posts, humble brags, and company updates in a crowded feed.',
      evidence: 'An oddly specific detail or anecdote IS the evidence. Citations, data tables, and footnotes are not expected and would feel out of place.',
      structure: 'Line breaks create rhythm and breathing room. No headings, no bold text, no bullet lists. This is plain text on a mobile screen. Judging the piece for lacking structural formatting is a category error.',
      closing: 'Zooming out from personal to universal at the end is the expected pattern — an observation that universalizes the specific story. This is not "a second thesis" — it is the format\'s natural landing.',
      length: '150-350 words is optimal. Under 100 feels thin. Over 400 risks losing the feed reader.',
      vocabulary: 'The audience is professionals — some technical vocabulary is appropriate. But jargon without context excludes. The test: would someone in an adjacent field understand?',
    },
  },
  essay: {
    name: 'Essay / Long-form',
    description: 'Sustained argument or exploration (500-3000 words). Reader has opted in and committed attention. Full structural toolkit available: headings, emphasis, lists, links.',
    expectations: {
      hook: 'Opening paragraph earns sustained reading. Can be slower — the reader already chose to be here.',
      evidence: 'Claims should be supported. Specific examples, data, cited sources, or at minimum honest uncertainty. Assertion without support reads as shallow.',
      structure: 'Headings, bold, lists, and visual hierarchy expected for pieces over 800 words. Sequential reading is assumed — the piece can build an argument across sections.',
      closing: 'Should resolve or deliberately leave open. A neat bow requires earned conclusions. An open ending requires enough prior depth to feel intentional, not abandoned.',
      length: 'Appropriate to the argument. 500 words for a focused insight, 2000+ for a developed exploration. No padding, but no artificial compression either.',
      vocabulary: 'Higher tolerance for technical terms — reader committed time, expects depth. But still explain novel concepts on first use.',
    },
  },
  email: {
    name: 'Email',
    description: 'Action-oriented professional communication. Reader expects to understand the ask within 30 seconds. Everything not moving toward the action is overhead.',
    expectations: {
      hook: 'Subject line + first sentence. The reader decides in 5 seconds whether this needs action now or can wait.',
      evidence: 'Context sufficient to make a decision. Not an argument — a briefing.',
      structure: 'Clear ask, supporting context, deadline if relevant. Bullet points for multiple items.',
      closing: 'Explicit next step or ask. Never end with "thoughts?" without specifying what kind of input you need.',
      length: '50-300 words for most professional emails. Longer emails should probably be documents.',
      vocabulary: 'Match the recipient. Internal shorthand is fine for internal readers.',
    },
  },
  tweet: {
    name: 'Tweet / Micro-post',
    description: 'Maximum compression (under 280 characters). The hook IS the content. Reader decides in 1 second: engage or scroll.',
    expectations: {
      hook: 'The entire post is a hook. No separate "body" to evaluate.',
      evidence: 'Assertion is the genre norm. Bold claims without support are expected — this is provocation, not argumentation.',
      structure: 'None expected. Formatting is limited to line breaks at most.',
      closing: 'Optional. A reply-bait question or a mic-drop final line. Not required.',
      length: 'Under 280 characters is a hard constraint. Every word must earn its place.',
      vocabulary: 'Compressed, punchy. Abbreviations acceptable. Formality low.',
    },
  },
  'short-form': {
    name: 'Short-form Content',
    description: 'General short-form writing (100-500 words) without clear platform signals. Evaluate with moderate expectations across all criteria.',
    expectations: {
      hook: 'Opening should create interest within first 2-3 sentences.',
      evidence: 'At least one specific detail. Full argumentation not required but claims should feel grounded.',
      structure: 'Minimal formatting expected. Clear paragraphing is sufficient.',
      closing: 'Should land the point. Not required to be elaborate.',
      length: 'Appropriate to the content. Not padded, not cramped.',
      vocabulary: 'General audience unless signals suggest otherwise.',
    },
  },
};
