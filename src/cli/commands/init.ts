import { Command } from 'commander';
import { writeFile } from 'fs/promises';
import { EcoreLoader } from '../../loader/EcoreLoader.js';
import { parseImportMappings } from '../import-mappings.js';

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
      const xmiContent = generateGenConfigXMI(nsURI, mode, outputDir, prefix, basePackage, referencedPackages);

      // Determine output path
      const outputPath = options.output ?? options.model.replace(/\.ecore$/, '.genconfig.xmi');

      // Write file
      await writeFile(outputPath, xmiContent, 'utf-8');

      console.log('Created GenConfig:', outputPath);
      console.log('Mode:', mode);
      console.log('Prefix:', prefix);
      console.log('Base package:', basePackage);
      console.log('Output directory:', outputDir);
      for (const [refNsURI, importPath] of referencedPackages) {
        console.log(`Referenced package: ${refNsURI} → ${importPath}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

export function generateGenConfigXMI(
  nsURI: string,
  mode: string,
  outputDir: string,
  prefix: string,
  basePackage: string,
  referencedPackages?: Map<string, string>
): string {
  let referencedPackagesXML = '';
  for (const [refNsURI, importPath] of referencedPackages ?? []) {
    referencedPackagesXML += `  <referencedPackages nsURI="${escapeXML(refNsURI)}" importPath="${escapeXML(importPath)}"/>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<genconfig:GenConfig
    xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:genconfig="http://www.emfts.org/genconfig/1.0"
    ecorePackage="${nsURI}#/">
  <generation mode="${mode}" outputDir="${outputDir}"/>
  <package prefix="${prefix}" basePackage="${basePackage}" generateFactory="true" generatePackage="true" generateIndex="true"/>
  <classDefaults generateInterface="true" generateImpl="true" rootExtendsClass="BasicEObject" rootExtendsInterface="EObject"/>
  <featureDefaults notify="true" property="editable"/>
${referencedPackagesXML}</genconfig:GenConfig>
`;
}

function escapeXML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
