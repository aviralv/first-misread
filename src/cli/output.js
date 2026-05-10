import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { contentHash } from './history-fs.js';
import { signalStrength } from '../core/models.js';

const SEVERITY_EMOJI = { high: '\u{1f534}', medium: '\u{1f7e1}', low: '\u26aa' };

export function generateSummary(title, metadata, results, aggregated, totalPersonas, strengths, takeaways) {
  const lines = [
    '# First Misread Report',
    '',
    `**Content**: "${title}"`,
    `**Word count**: ${metadata.wordCount.toLocaleString()} | **Est. read time**: ${metadata.estimatedReadTimeMinutes} min`,
    `**Personas run**: ${totalPersonas} total`,
    '',
    '## Top Findings',
    '',
  ];

  for (let i = 0; i < Math.min(aggregated.length, 5); i++) {
    const f = aggregated[i];
    const emoji = SEVERITY_EMOJI[f.severity] || '';
    const signal = signalStrength(f.personas);
    lines.push(`${i + 1}. **${emoji} ${f.descriptions[0].what_happened}** (${signal})`);
    lines.push(`   > "${f.passage}"`);
    lines.push(`   Flagged by: ${f.personas.join(', ')}`);
    lines.push('');
  }

  if ((strengths && strengths.length > 0) || (takeaways && takeaways.length > 0)) {
    lines.push("## What's Landing");
    lines.push('');

    if (strengths && strengths.length > 0) {
      lines.push('### Load-Bearing Passages');
      lines.push('');
      for (let i = 0; i < strengths.length; i++) {
        const s = strengths[i];
        lines.push(`${i + 1}. "${s.passage}" (${s.location}) — ${s.why}`);
        lines.push('');
      }
    }

    if (takeaways && takeaways.length > 0) {
      lines.push('### Reader Takeaways');
      lines.push('');
      for (let i = 0; i < takeaways.length; i++) {
        const t = takeaways[i];
        lines.push(`${i + 1}. "${t.passage}" (${t.location}) — ${t.takeaway}`);
        lines.push('');
      }
    }
  }

  lines.push('## Persona Verdicts');
  lines.push('');
  lines.push('| Persona | Verdict | Key Issue |');
  lines.push('|---------|---------|-----------|');
  for (const r of results) {
    const keyIssue = r.findings.length > 0 ? r.findings[0].what_happened : 'No issues';
    lines.push(`| ${r.persona} | ${r.overall_verdict} | ${keyIssue} |`);
  }
  lines.push('');

  return lines.join('\n');
}

export function generatePersonaDetails(results) {
  const lines = ['# Persona Details', ''];

  for (const result of results) {
    lines.push(`## ${result.persona}`);
    lines.push('');
    lines.push(`**Behavior:** ${result.behavior_executed}`);
    lines.push(`**Time spent:** ${result.time_simulated}`);
    lines.push(`**Verdict:** ${result.overall_verdict}`);
    lines.push('');

    if (!result.findings.length) {
      lines.push('*No issues found.*');
      lines.push('');
      continue;
    }

    lines.push('### Findings');
    lines.push('');
    for (const f of result.findings) {
      const emoji = SEVERITY_EMOJI[f.severity] || '';
      lines.push(`#### ${emoji} ${f.type.replace(/_/g, ' ')} (${f.severity})`);
      lines.push('');
      lines.push(`> "${f.passage}"`);
      lines.push('');
      lines.push(`**Location:** ${f.location}`);
      lines.push(`**What happened:** ${f.what_happened}`);
      lines.push(`**Persona understood:** ${f.what_persona_understood}`);
      lines.push(`**Author likely meant:** ${f.what_author_likely_meant}`);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function writeOutput(baseDir, slug, title, metadata, results, aggregated, strengths, takeaways, inputText, model, parentRunId) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '').slice(0, 15);
  const runId = `${timestamp}-${slug}`;
  const outputDir = join(baseDir, runId);
  mkdirSync(outputDir, { recursive: true });

  const totalPersonas = results.length;
  const summary = generateSummary(title, metadata, results, aggregated, totalPersonas, strengths, takeaways);
  writeFileSync(join(outputDir, 'summary.md'), summary);

  const details = generatePersonaDetails(results);
  writeFileSync(join(outputDir, 'persona-details.md'), details);

  const record = {
    run_id: runId,
    timestamp: now.toISOString(),
    slug,
    content_hash: contentHash(inputText),
    word_count: metadata.wordCount,
    model,
    personas_run: results.map(r => r.persona),
    parent_run_id: parentRunId || null,
    metadata,
    findings: aggregated,
    persona_verdicts: results.map(r => ({
      persona: r.persona,
      verdict: r.overall_verdict || '',
      key_issue: r.findings.length > 0 ? r.findings[0].what_happened : 'none',
    })),
  };

  return { outputDir, record };
}
