import { Command } from 'commander';
import { EcoreLoader } from '../../loader/EcoreLoader.js';
import { GenConfigLoader } from '../../genconfig/GenConfigLoader.js';
import { GenConfigConverter } from '../../genconfig/GenConfigConverter.js';
import { CodeGenerator } from '../../generator/CodeGenerator.js';

export const generateCommand = new Command('generate')
  .description('Generate TypeScript code from Ecore model')
  .requiredOption('-m, --model <path>', 'Path to .ecore model file')
  .requiredOption('-c, --config <path>', 'Path to .genconfig.xmi file')
  .option('-o, --output <path>', 'Output directory override')
  .option('-d, --dependency <paths...>', 'Dependent .ecore model files (loaded before main model)')
  .option('--import-mapping <mappings...>', 'Import path mappings for referenced packages (format: nsURI=importPath)')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const verbose = options.verbose;

    try {
      const ecoreLoader = new EcoreLoader();

      // Load dependency models first so their packages are registered
      if (options.dependency) {
        for (const depPath of options.dependency) {
          if (verbose) {
            console.log('Loading dependency:', depPath);
          }
          const depPackage = await ecoreLoader.load(depPath);
          if (verbose) {
            console.log('  Registered package:', getName(depPackage), 'nsURI:', depPackage.getNsURI());
          }
        }
      }

      // Load main model (proxies to dependencies will resolve)
      if (verbose) {
        console.log('Loading Ecore model:', options.model);
      }
      const ePackage = await ecoreLoader.load(options.model);

      if (verbose) {
        console.log('Loaded package:', getName(ePackage), 'nsURI:', ePackage.getNsURI());
        const classifiers = ePackage.getEClassifiers();
        console.log('Classifiers:', classifiers.length);
        for (const c of classifiers) {
          console.log('  -', getName(c));
        }
      }

      // Load GenConfig
      if (verbose) {
        console.log('Loading GenConfig:', options.config);
      }
      const configLoader = new GenConfigLoader();
      // Register all loaded packages (main + dependencies)
      for (const [, pkg] of ecoreLoader.getAllPackages()) {
        configLoader.registerPackage(pkg);
      }
      const genConfig = await configLoader.load(options.config);

      // Convert to internal GenModel
      const converter = new GenConfigConverter();
      const genModel = converter.convert(genConfig);

      // Override output directory if specified on command line
      const outputDir = options.output || genConfig.generation.outputDir;

      // Parse import mappings (nsURI=importPath)
      const referencedPackages = new Map<string, string>();
      if (options.importMapping) {
        for (const mapping of options.importMapping) {
          const eqIdx = mapping.indexOf('=');
          if (eqIdx === -1) {
            console.warn(`[WARN] Invalid import mapping (expected nsURI=importPath): ${mapping}`);
            continue;
          }
          const nsURI = mapping.substring(0, eqIdx);
          const importPath = mapping.substring(eqIdx + 1);
          referencedPackages.set(nsURI, importPath);
        }
      }

      if (verbose) {
        console.log('Generation mode:', genConfig.generation.mode);
        console.log('Output directory:', outputDir);
        console.log('Generate interfaces:', genConfig.classDefaults?.generateInterface ?? true);
        console.log('Generate classes:', genConfig.classDefaults?.generateImpl ?? true);
        console.log('Generate factory:', genConfig.package.generateFactory);
        if (referencedPackages.size > 0) {
          console.log('Referenced packages:');
          for (const [nsURI, importPath] of referencedPackages) {
            console.log(`  ${nsURI} → ${importPath}`);
          }
        }
      }

      // Generate code
      const generator = new CodeGenerator(genModel, {
        outputDirectory: outputDir,
        referencedPackages: referencedPackages.size > 0 ? referencedPackages : undefined,
      });

      console.log('Generating code...');
      const result = await generator.run();

      // Print diagnostics
      for (const diag of result.diagnostics) {
        if (diag.level === 'error') {
          console.error(`[ERROR] ${diag.message}`);
        } else if (diag.level === 'warning') {
          console.warn(`[WARN] ${diag.message}`);
        } else if (verbose) {
          console.log(`[INFO] ${diag.message}`);
        }
      }

      if (result.success) {
        console.log(`Successfully generated ${result.files.length} files to ${outputDir}`);
        if (verbose) {
          for (const file of result.files) {
            console.log('  -', file);
          }
        }
      } else {
        console.error('Generation failed with errors');
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      if (verbose && error instanceof Error) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

/**
 * Get name from ENamedElement (works with both static and dynamic EObjects)
 */
function getName(obj: any): string {
  // Try direct method first
  if (typeof obj.getName === 'function') {
    return obj.getName() ?? '';
  }
  // Try eGet for dynamic objects
  if (typeof obj.eGet === 'function' && typeof obj.eClass === 'function') {
    const eClass = obj.eClass();
    if (eClass) {
      const nameFeature = eClass.getEStructuralFeature?.('name');
      if (nameFeature) {
        return obj.eGet(nameFeature) ?? '';
      }
    }
  }
  // Fallback to property access
  return obj.name ?? '';
}
