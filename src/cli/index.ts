#!/usr/bin/env node

import { Command } from 'commander';
import { generateCommand } from './commands/generate.js';
import { initCommand } from './commands/init.js';
import { generateRestClientCommand } from './commands/generate-rest-client.js';

const program = new Command();

program
  .name('emfts-codegen')
  .description('TypeScript code generator for Ecore models using emfts')
  .version('1.0.0');

program.addCommand(generateCommand);
program.addCommand(initCommand);
program.addCommand(generateRestClientCommand);

program.parse();
