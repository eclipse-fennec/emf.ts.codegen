import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import ts from 'typescript';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * The generated code has to compile. The other tests pin what is emitted;
 * this one hands it to the TypeScript compiler, which catches what reading
 * the output does not — a subclass redeclaring a private member of its base
 * class, for instance (TS2415), which the helper for #61 produced for every
 * model with inheritance.
 */
describe('generated code type-checks', () => {
  const outDir = path.resolve(__dirname, '.generated-tmp/typecheck');
  let files: string[] = [];

  beforeAll(async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'typecheck-'));
    try {
      const configPath = path.join(tmpDir, 'model.genconfig.xmi');
      await writeFile(configPath, generateGenConfigXMI(
        'http://example.org/widgets', 'emf', './generated', 'Widgets', 'org.example'
      ), 'utf-8');
      const result = await generateInMemory({
        ecorePath: path.resolve(__dirname, 'fixtures/containment-model.ecore'),
        configPath
      });
      expect(result.success).toBe(true);
      for (const file of result.files) {
        const target = path.join(outDir, file.path);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, file.content, 'utf-8');
        if (target.endsWith('.ts')) files.push(target);
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    await rm(path.resolve(__dirname, '.generated-tmp'), { recursive: true, force: true });
  });

  it('compiles without errors', () => {
    const program = ts.createProgram(files, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ['lib.es2022.d.ts'],
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      esModuleInterop: true,
      noImplicitAny: false,
      baseUrl: path.resolve(__dirname, '..'),
    });
    const diagnostics = [
      ...program.getSemanticDiagnostics(),
      ...program.getSyntacticDiagnostics(),
    ].filter((d) => d.file && files.includes(d.file.fileName));

    const messages = diagnostics.map((d) => {
      const where = d.file && d.start !== undefined
        ? `${path.basename(d.file.fileName)}:${d.file.getLineAndCharacterOfPosition(d.start).line + 1}`
        : '?';
      return `${where} TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`;
    });
    expect(messages).toEqual([]);
  });
});
