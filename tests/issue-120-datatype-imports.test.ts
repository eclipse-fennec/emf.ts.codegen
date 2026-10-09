import { describe, it, expect, beforeAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * Tests for eclipse-fennec/emf.ts#120 (a codegen issue filed in the core repo):
 * - a model-defined EDataType with an instanceClassName (Instant, Promise, ...)
 *   produced `import type { Instant } from './Instant.js'` although no such
 *   file is ever generated; it now maps along its instanceClassName
 * - a reference to the Ecore metamodel EObject must come from @emfts/core,
 *   never from a path import, and never twice
 *
 * @see https://github.com/eclipse-fennec/emf.ts/issues/120
 */
describe('emf.ts#120: EDataTypes with instanceClassName and Ecore EObject refs', () => {
  let files: Array<{ path: string; content: string }>;

  beforeAll(async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-120-'));
    try {
      const configPath = path.join(tmpDir, 'model.genconfig.xmi');
      await writeFile(configPath, generateGenConfigXMI(
        'http://example.org/atlas', 'emf', './generated', 'Atlas', 'org.example'
      ), 'utf-8');
      const result = await generateInMemory({
        ecorePath: path.resolve(__dirname, 'fixtures/datatype-model.ecore'),
        configPath
      });
      expect(result.success).toBe(true);
      files = result.files;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  function getFile(name: string): string {
    const file = files.find(f => path.basename(f.path) === name);
    if (!file) throw new Error(`File ${name} not found`);
    return file.content;
  }

  it('should not generate files for plain EDataTypes', () => {
    const names = files.map(f => path.basename(f.path));
    expect(names).not.toContain('Instant.ts');
    expect(names).not.toContain('Promise.ts');
  });

  it('should not import plain EDataTypes from nonexistent files', () => {
    for (const file of files) {
      expect(file.content).not.toMatch(/from '\.\/(Instant|Promise|Void)(\.js)?'/);
    }
  });

  it('should map a text-serialized instanceClassName to string', () => {
    const iface = getFile('ObjectMetadata.ts');
    expect(iface).toContain('uploadTime: string;');
    expect(iface).toContain('reviewTime?: string;');
  });

  it('should map an unknown instanceClassName to unknown and java.lang.Void to void', () => {
    const iface = getFile('ObjectMetadata.ts');
    // org.osgi.util.promise.Promise has no TS equivalent
    expect(iface).toMatch(/refresh\(\): unknown;/);
  });

  it('should import the Ecore EObject from @emfts/core only, never from a path', () => {
    const iface = getFile('ObjectMetadata.ts');
    expect(iface).toContain('objectRef?: EObject;');
    expect(iface).not.toMatch(/from '[^']*eclipse\.org/);
    // exactly one import that names EObject
    const eobjectImports = iface.split('\n').filter(l => /^import.*\bEObject\b/.test(l));
    expect(eobjectImports).toHaveLength(1);
    expect(eobjectImports[0]).toContain("'@emfts/core'");
  });
});
