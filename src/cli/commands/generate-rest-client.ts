import { Command } from 'commander';
import { RestClientGenerator } from '../../generator/RestClientGenerator.js';

export const generateRestClientCommand = new Command('generate-rest-client')
  .description('Generate TypeScript fetch client from REST API Ecore model + XMI instance')
  .requiredOption('-m, --metamodel <path>', 'Path to rest-api.ecore metamodel')
  .requiredOption('-i, --instance <path>', 'Path to API instance .xmi file')
  .requiredOption('-o, --output <path>', 'Output directory for generated client')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const verbose = options.verbose;

    try {
      if (verbose) {
        console.log('REST API metamodel:', options.metamodel);
        console.log('API instance:', options.instance);
        console.log('Output directory:', options.output);
      }

      const generator = new RestClientGenerator({
        outputDir: options.output,
        verbose,
      });

      console.log('Generating REST client...');
      const files = await generator.generate(options.metamodel, options.instance);
      console.log(`Successfully generated ${files.length} files to ${options.output}`);

      if (verbose) {
        for (const file of files) {
          console.log('  -', file);
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      if (verbose && error instanceof Error) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });
