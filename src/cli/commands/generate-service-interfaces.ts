import { Command } from 'commander';
import { ServiceInterfaceGenerator } from '../../generator/ServiceInterfaceGenerator.js';

export const generateServiceInterfacesCommand = new Command('generate-service-interfaces')
  .description('Generate TypeScript interfaces from DDSR Broker Catalog')
  .option('-b, --broker <url>', 'Broker catalog URL (e.g. http://localhost:8887/ddsr/rest/catalog)')
  .option('-m, --model <path>', 'Path to catalog export XMI file (offline mode)')
  .requiredOption('-o, --output <path>', 'Output directory for generated interfaces')
  .option('-i, --interface <names...>', 'Generate only specific interface(s) by name')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const verbose = options.verbose;

    if (!options.broker && !options.model) {
      console.error('Error: Either --broker <url> or --model <path> is required');
      process.exit(1);
    }

    try {
      const generator = new ServiceInterfaceGenerator({
        outputDir: options.output,
        verbose,
        interfaceFilter: options.interface,
      });

      if (verbose) {
        if (options.broker) {
          console.log('Broker URL:', options.broker);
        } else {
          console.log('Model file:', options.model);
        }
        console.log('Output directory:', options.output);
        if (options.interface) {
          console.log('Filter interfaces:', options.interface.join(', '));
        }
      }

      console.log('Generating service interfaces...');

      let files: string[];
      if (options.broker) {
        files = await generator.generateFromUrl(options.broker);
      } else {
        files = await generator.generateFromFile(options.model);
      }

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
