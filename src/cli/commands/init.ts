import { Command } from 'commander';
import { writeFile } from 'fs/promises';
import { XMIResource, URI, EProxyImpl } from '@emfts/core';
import type { EPackage } from '@emfts/core';
import { EcoreLoader } from '../../loader/EcoreLoader.js';
import { parseImportMappings } from '../import-mappings.js';
import { GenConfigPackage } from '../../genconfig/model/GenConfigPackage.js';
import { GenerationMode, getGenerationModeByLiteral } from '../../genconfig/model/GenerationMode.js';
import { PropertyMode } from '../../genconfig/model/PropertyMode.js';
import type { GenConfigFactory } from '../../genconfig/model/GenConfigFactory.js';

export const initCommand = new Command('init')
  .description('Initialize a GenConfig file from an Ecore model')
  .requiredOption('-m, --model <path>', 'Path to .ecore model file')
  .option('-o, --output <path>', 'Output path for .genconfig.xmi file')
  .option('--mode <mode>', 'Generation mode: plain, decorator, or emf', 'emf')
  .option('--base-package <package>', 'Base package path for generated code')
  .option('--prefix <prefix>', 'Prefix for generated class names')
  .option('--output-dir <dir>', 'Output directory for generated code', './generated')
  .option('-d, --dependency <paths...>', 'Dependent .ecore model files (loaded before main model)')
  .option('--import-mapping <mappings...>', 'Import path mappings for referenced packages, written to the GenConfig (format: nsURI=importPath)')
  .option('-a, --annotations <package>', 'Decorator mode: import annotations from this package instead of generating ModelAnnotations')
  .action(async (options) => {
    try {
      const ecoreLoader = new EcoreLoader();

      // Load dependency models first so their packages are registered
      if (options.dependency) {
        for (const depPath of options.dependency) {
          console.log('Loading dependency:', depPath);
          await ecoreLoader.load(depPath);
        }
      }

      console.log('Loading Ecore model:', options.model);

      // Load main model (proxies to dependencies will resolve)
      const ePackage = await ecoreLoader.load(options.model);

      const packageName = ePackage.getName() || 'Model';
      const nsURI = ePackage.getNsURI() || `http://example.org/${packageName.toLowerCase()}`;

      console.log('Loaded package:', packageName, 'nsURI:', nsURI);

      // Generate prefix from package name (capitalize first letter)
      const prefix = options.prefix || packageName.charAt(0).toUpperCase() + packageName.slice(1);
      const basePackage = options.basePackage || 'org.example';
      const mode = options.mode;
      const outputDir = options.outputDir;
      const referencedPackages = parseImportMappings(options.importMapping);

      // Generate GenConfig XMI content
      const xmiContent = generateGenConfigXMI(nsURI, mode, outputDir, prefix, basePackage, referencedPackages, options.annotations);

      // Determine output path
      const outputPath = options.output ?? options.model.replace(/\.ecore$/, '.genconfig.xmi');

      // Write file
      await writeFile(outputPath, xmiContent, 'utf-8');

      console.log('Created GenConfig:', outputPath);
      console.log('Mode:', mode);
      console.log('Prefix:', prefix);
      console.log('Base package:', basePackage);
      console.log('Output directory:', outputDir);
      if (options.annotations) {
        console.log('Annotations package:', options.annotations);
      }
      for (const [refNsURI, importPath] of referencedPackages) {
        console.log(`Referenced package: ${refNsURI} → ${importPath}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Build the GenConfig model via the generated factory (dogfooding: the
 * genconfig model classes are generated from model/genconfig.ecore by this
 * codegen itself) and serialize it with the XMI resource
 */
export function generateGenConfigXMI(
  nsURI: string,
  mode: string,
  outputDir: string,
  prefix: string,
  basePackage: string,
  referencedPackages?: Map<string, string>,
  annotationsPackage?: string
): string {
  const factory = GenConfigPackage.eINSTANCE.getEFactoryInstance() as GenConfigFactory;

  const genConfig = factory.createGenConfig();

  // Reference the Ecore package by nsURI, not by file path
  const ecorePackageProxy = new EProxyImpl(URI.createURI(`${nsURI}#/`));
  genConfig.ecorePackage = ecorePackageProxy as unknown as EPackage;

  const generation = factory.createGenerationSettings();
  generation.mode = getGenerationModeByLiteral(mode) ?? GenerationMode.emf;
  generation.outputDir = outputDir;
  if (annotationsPackage) {
    generation.annotationsPackage = annotationsPackage;
  }
  genConfig.generation = generation;

  const packageSettings = factory.createPackageSettings();
  packageSettings.prefix = prefix;
  packageSettings.basePackage = basePackage;
  packageSettings.generateFactory = true;
  packageSettings.generatePackage = true;
  packageSettings.generateIndex = true;
  genConfig.package = packageSettings;

  const classDefaults = factory.createClassDefaults();
  classDefaults.generateInterface = true;
  classDefaults.generateImpl = true;
  classDefaults.rootExtendsClass = 'BasicEObject';
  classDefaults.rootExtendsInterface = 'EObject';
  genConfig.classDefaults = classDefaults;

  const featureDefaults = factory.createFeatureDefaults();
  featureDefaults.notify = true;
  featureDefaults.property = PropertyMode.editable;
  genConfig.featureDefaults = featureDefaults;

  for (const [refNsURI, importPath] of referencedPackages ?? []) {
    const referencedPackage = factory.createReferencedPackage();
    referencedPackage.nsURI = refNsURI;
    referencedPackage.importPath = importPath;
    genConfig.referencedPackages.add(referencedPackage);
  }

  const resource = new XMIResource(URI.createURI('genconfig.xmi'));
  resource.getContents().add(genConfig);
  return resource.saveToString();
}
