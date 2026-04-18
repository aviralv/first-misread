import { analyzeContent } from './analyzer.js';
import { selectDynamicPersonas } from './selector.js';
import { simulateAll } from './simulator.js';
import { aggregateFindings } from './aggregator.js';
import { identifyStrengths } from './strengths.js';

const MIN_WORDS = 50;
const MAX_WORDS = 2500;

export function stripObsidianComments(text) {
  return text.replace(/%%[\s\S]*?%%/g, '');
}

export function validateInput(text) {
  text = stripObsidianComments(text).trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_WORDS) {
    throw new Error(`Input too short: ${wordCount} words (minimum ${MIN_WORDS})`);
  }
  if (wordCount > MAX_WORDS) {
    throw new Error(`Input too long: ${wordCount} words (maximum ${MAX_WORDS})`);
  }
  return text;
}

export async function runPipeline(client, text, onProgress, personas) {
  const emit = onProgress || (() => {});

  text = validateInput(text);

  const metadata = analyzeContent(text);
  emit({ type: 'metadata', metadata });

  const { core, dynamic } = personas;
  const selectedDynamic = await selectDynamicPersonas(client, text, metadata, dynamic);
  const allPersonas = [...core, ...selectedDynamic];

  emit({
    type: 'personas-selected',
    personas: allPersonas.map(p => p.name),
  });

  const personaResults = await simulateAll(client, allPersonas, text, metadata, emit);
  const aggregatedFindings = aggregateFindings(personaResults);

  const strengthsResult = await identifyStrengths(client, text, metadata, personaResults);
  const strengths = strengthsResult ? strengthsResult.strengths : null;
  const takeaways = strengthsResult ? strengthsResult.takeaways : null;

  emit({ type: 'complete' });

  return {
    metadata,
    personas: allPersonas,
    personaResults,
    aggregatedFindings,
    strengths,
    takeaways,
  };
}
