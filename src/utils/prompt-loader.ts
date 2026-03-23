/**
 * prompt-loader.ts — port from ThryvGuide
 * Loads JSON prompt templates, validates fields, compiles {{token}} replacements
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, '../../prompts');

export interface PromptMetadata {
  name: string;
  version: string;
  model: string;
  temperature: number;
  description?: string;
}

export interface LoadedPrompt {
  content: string;
  metadata: PromptMetadata;
}

/**
 * Resolve model alias from env or use direct model name
 */
function resolveModel(modelRef: string): string {
  const envVal = process.env[modelRef];
  return envVal || modelRef;
}

/**
 * Simple {{token}} template compiler
 */
function compile(template: string, vars: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    if (val === undefined) {
      console.warn(`[prompt-loader] Missing variable: {{${key}}}`);
      return `{{${key}}}`;
    }
    return typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
  });
}

/**
 * Load and compile a prompt template
 * @param promptName - filename without .json
 * @param variables - {{token}} replacements
 */
export function loadPrompt(
  promptName: string,
  variables: Record<string, any> = {},
): LoadedPrompt {
  const filePath = join(PROMPTS_DIR, `${promptName}.json`);

  let raw: any;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (e: any) {
    throw new Error(`[prompt-loader] Failed to load "${promptName}": ${e.message}`);
  }

  // Validate required fields
  for (const field of ['name', 'version', 'model', 'temperature', 'prompt']) {
    if (raw[field] === undefined) {
      throw new Error(`[prompt-loader] "${promptName}.json" missing required field: ${field}`);
    }
  }

  const content = compile(raw.prompt, variables);

  console.log(`[prompt-loader] Loaded "${promptName}" v${raw.version}`);

  return {
    content,
    metadata: {
      name: raw.name,
      version: raw.version,
      model: resolveModel(raw.model),
      temperature: raw.temperature,
      description: raw.description,
    },
  };
}
