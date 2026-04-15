// GenConfig (public API)
export * from './genconfig/index.js';

// Generator
export * from './generator/index.js';

// Loader
export * from './loader/index.js';

// Utilities
export * from './util/index.js';

// Re-export main classes
export { CodeGenerator } from './generator/CodeGenerator.js';
export { RestClientGenerator } from './generator/RestClientGenerator.js';
export { GenConfigLoader } from './genconfig/GenConfigLoader.js';
export { GenConfigConverter } from './genconfig/GenConfigConverter.js';
export { EcoreLoader } from './loader/EcoreLoader.js';
export { TypeMapper } from './generator/TypeMapper.js';
export { ImportResolver } from './generator/ImportResolver.js';

// Re-export types
export type { GenConfig, GenerationSettings, PackageSettings, ClassDefaults, FeatureDefaults, ClassOverride, FeatureOverride, GenConfigMode, GenConfigPropertyMode } from './genconfig/GenConfig.js';
export type { GeneratorOptions } from './generator/GeneratorOptions.js';
export type { GeneratedFile } from './generator/GeneratedFile.js';
export type { GenerationResult } from './generator/CodeGenerator.js';

// Internal types (for advanced usage)
export { GenerationMode, PropertyMode } from './genmodel/GenerationMode.js';

import { CodeGenerator, type GenerationResult } from './generator/CodeGenerator.js';
import { GenConfigLoader } from './genconfig/GenConfigLoader.js';
import { GenConfigConverter } from './genconfig/GenConfigConverter.js';
import { EcoreLoader } from './loader/EcoreLoader.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Options for the generate function
 */
export interface GenerateOptions {
  /** Path to the .ecore model file */
  ecorePath: string;
  /** Path to the .genconfig.xmi file */
  configPath: string;
  /** Output directory override (optional, uses config value if not specified) */
  outputDir?: string;
  /** Whether to write files to disk (default: true) */
  writeFiles?: boolean;
}

/**
 * Generate TypeScript code from Ecore models
 *
 * @example
 * ```typescript
 * import { generate } from 'emfts-codegen';
 *
 * const result = await generate({
 *   ecorePath: 'model/library.ecore',
 *   configPath: 'model/library.genconfig.xmi',
 *   outputDir: 'src/generated'  // optional override
 * });
 *
 * console.log(`Generated ${result.files.length} files`);
 * ```
 */
export async function generate(options: GenerateOptions): Promise<GenerationResult> {
  const { ecorePath, configPath, writeFiles = true } = options;

  // Load ecore model
  const ecoreLoader = new EcoreLoader();
  const ePackage = await ecoreLoader.load(ecorePath);

  // Load genconfig
  const configLoader = new GenConfigLoader();
  configLoader.registerPackage(ePackage);
  const genConfig = await configLoader.load(configPath);

  // Convert to internal GenModel
  const converter = new GenConfigConverter();
  const genModel = converter.convert(genConfig);

  // Use outputDir from options or from config
  const outputDir = options.outputDir || genConfig.generation.outputDir;

  // Generate code
  const generator = new CodeGenerator(genModel);
  const result = await generator.generate();

  // Write files if requested
  if (writeFiles) {
    await writeGeneratedFiles(result.files, outputDir);
  }

  return result;
}

/**
 * Generate code without writing to disk
 *
 * @example
 * ```typescript
 * import { generateInMemory } from 'emfts-codegen';
 *
 * const result = await generateInMemory({
 *   ecorePath: 'model/library.ecore',
 *   configPath: 'model/library.genconfig.xmi'
 * });
 *
 * for (const file of result.files) {
 *   console.log(`${file.path}:\n${file.content}`);
 * }
 * ```
 */
export async function generateInMemory(options: Omit<GenerateOptions, 'outputDir' | 'writeFiles'>): Promise<GenerationResult> {
  const { ecorePath, configPath } = options;

  // Load ecore model
  const ecoreLoader = new EcoreLoader();
  const ePackage = await ecoreLoader.load(ecorePath);

  // Load genconfig
  const configLoader = new GenConfigLoader();
  configLoader.registerPackage(ePackage);
  const genConfig = await configLoader.load(configPath);

  // Convert to internal GenModel
  const converter = new GenConfigConverter();
  const genModel = converter.convert(genConfig);

  // Generate code
  const generator = new CodeGenerator(genModel);
  return generator.generate();
}

/**
 * Helper to write generated files to disk
 */
async function writeGeneratedFiles(files: { path: string; content: string }[], outputDir: string): Promise<void> {
  for (const file of files) {
    const filePath = path.join(outputDir, file.path);
    const dirPath = path.dirname(filePath);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, file.content, 'utf-8');
  }
}
