#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { program } from 'commander';
import { createClient } from '../core/llm-client.js';
import { validateInput, runPipeline } from '../core/pipeline.js';
import { loadPersonasFromYaml } from './personas-loader.js';
import { writeOutput } from './output.js';
import { createFsHistory } from './history-fs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');
const PERSONAS_DIR = join(PROJECT_ROOT, 'personas');
const OUTPUT_DIR = join(PROJECT_ROOT, 'output');

const PROVIDER_DEFAULTS = {
  anthropic: { model: 'claude-sonnet-4-6', envKey: 'ANTHROPIC_API_KEY' },
  openai: { model: 'gpt-4o', envKey: 'OPENAI_API_KEY' },
  google: { model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY' },
  'openai-compatible': { model: '', envKey: '' },
};

program
  .name('first-misread')
  .description('Behavioral reading simulation for written content')
  .version('1.0.1')
  .argument('[input]', 'Path to a text file to analyze')
  .option('-t, --text <text>', 'Paste text directly instead of a file path')
  .option('-p, --provider <provider>', 'LLM provider: anthropic, openai, google, openai-compatible', 'anthropic')
  .option('-k, --api-key <key>', 'API key (overrides env var)')
  .option('-m, --model <model>', 'Model name (overrides provider default)')
  .option('--base-url <url>', 'Override API base URL')
  .option('--no-suggestions', 'Skip suggested alternatives for flagged passages')
  .option('--no-history', 'Skip history tracking')
  .option('--show-history <slug>', 'Show chain history for a slug')
  .option('-v, --verbose', 'Enable debug logging')
  .action(async (input, opts) => {
    if (opts.showHistory) {
      const history = createFsHistory(OUTPUT_DIR);
      const chains = history.getChains();
      const runs = history.getRuns();
      if (!(opts.showHistory in chains)) {
        console.error(`No chain found for: ${opts.showHistory}`);
        process.exit(1);
      }
      const runIds = chains[opts.showHistory];
      console.log(`Chain: ${opts.showHistory}`);
      console.log(`Runs: ${runIds.length} runs\n`);
      runIds.forEach((runId, i) => {
        const info = runs[runId] || {};
        console.log(`  v${i + 1}: ${runId} (${info.timestamp || 'unknown'})`);
      });
      return;
    }

    let content;
    let filePath = null;
    if (input) {
      filePath = resolve(input);
      content = readFileSync(filePath, 'utf8');
    } else if (opts.text) {
      content = opts.text;
    } else if (!process.stdin.isTTY) {
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      content = Buffer.concat(chunks).toString('utf8');
    } else {
      console.error('Error: Provide a file path, --text, or pipe via stdin');
      process.exit(1);
    }

    const providerDefaults = PROVIDER_DEFAULTS[opts.provider] || {};
    const apiKey = opts.apiKey || process.env[providerDefaults.envKey] || '';
    if (!apiKey) {
      const envHint = providerDefaults.envKey ? `Set ${providerDefaults.envKey} or use` : 'Use';
      console.error(`Error: No API key. ${envHint} --api-key`);
      process.exit(1);
    }

    const model = opts.model || providerDefaults.model;
    const client = createClient(opts.provider, {
      apiKey,
      model,
      baseUrl: opts.baseUrl || undefined,
    });

    const personas = loadPersonasFromYaml(PERSONAS_DIR);
    const slug = filePath ? basename(filePath, '.md').replace(/[^\w-]/g, '-') : 'untitled';
    const title = slug.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());

    console.error(`Analyzing "${title}" with ${opts.provider}/${model}...`);

    const onProgress = (msg) => {
      switch (msg.type) {
        case 'personas-selected':
          console.error(`Selected ${msg.personas.length} personas: ${msg.personas.join(', ')}`);
          break;
        case 'persona-started':
          console.error(`  Reading: ${msg.persona}...`);
          break;
        case 'persona-done':
          console.error(`  Done: ${msg.persona} (${msg.findingCount} findings)`);
          break;
      }
    };

    const result = await runPipeline(client, content, onProgress, personas);

    const { outputDir, record } = writeOutput(
      OUTPUT_DIR, slug, title,
      result.metadata, result.personaResults, result.aggregatedFindings,
      result.strengths, result.takeaways,
      content, model, null,
    );

    const history = createFsHistory(OUTPUT_DIR);
    history.saveRun(slug, record, content, opts.history === false);

    const summaryPath = join(outputDir, 'summary.md');
    console.log(readFileSync(summaryPath, 'utf8'));
    console.error(`\nFull results: ${outputDir}`);
  });

program.parse();
