import { describe, it, expect } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * Tests for GitHub issue #57:
 * a cross-package supertype Impl was imported as a subpath of the import
 * mapping (`@scope/pkg/XImpl`) even for bare specifiers - packages do not
 * export such subpaths. A bare mapping is now used literally (the package
 * entry re-exports the Impl); a relative directory mapping keeps the direct
 * file import (avoiding an index cycle), now with the .js extension.
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/57
 */
describe('Issue #57: cross-package supertype Impl imports', () => {
  const basePath = path.resolve(__dirname, 'fixtures/base-model.ecore');
  const compositePath = path.resolve(__dirname, 'fixtures/composite-model.ecore');

  async function generateExtendsImport(mapping: string): Promise<string> {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-57-'));
    try {
      const configPath = path.join(tmpDir, 'model.genconfig.xmi');
      await writeFile(configPath, generateGenConfigXMI(
        'http://example.org/composite', 'emf', './generated', 'Composite', 'org.example',
        new Map([['http://example.org/base', mapping]])
      ), 'utf-8');
      const result = await generateInMemory({
        ecorePath: compositePath,
        configPath,
        dependencies: [basePath]
      });
      expect(result.success).toBe(true);
      const impl = result.files.find(f => path.basename(f.path) === 'CompositeComponentImpl.ts');
      if (!impl) throw new Error('CompositeComponentImpl.ts not found');
      const line = impl.content.split('\n').find(l => l.includes('import { ComponentImpl }'));
      if (!line) throw new Error('ComponentImpl import not found');
      return line;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  it('should import the supertype Impl from a bare specifier mapping literally', async () => {
    const line = await generateExtendsImport('@base/model');
    expect(line).toBe("import { ComponentImpl } from '@base/model';");
  });

  it('should import directly from the file for a relative directory mapping, with .js extension', async () => {
    const line = await generateExtendsImport('../base/src/generated');
    expect(line).toBe("import { ComponentImpl } from '../base/src/generated/ComponentImpl.js';");
  });

  it('should use a mapping that already names a module file literally', async () => {
    const line = await generateExtendsImport('../base/src/generated/index.js');
    expect(line).toBe("import { ComponentImpl } from '../base/src/generated/index.js';");
  });
});
