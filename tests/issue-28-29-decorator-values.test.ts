import { describe, it, expect, beforeAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * Tests for GitHub issues #28 and #29 (decorator mode value semantics):
 * - #28: enums must carry the EEnumLiteral literal as string member value
 * - #29: generic type arguments, reference default instantiation,
 *        attribute defaults, many-valued initialization
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/28
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/29
 */
describe('Issues #28/#29: decorator mode value semantics', () => {
  const ecorePath = path.resolve(__dirname, 'fixtures/events-model.ecore');

  let files: Array<{ path: string; content: string }>;

  beforeAll(async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-28-29-'));
    try {
      const configPath = path.join(tmpDir, 'events.genconfig.xmi');
      const xmi = generateGenConfigXMI(
        'http://example.org/events', 'decorator', './generated', 'Events', 'org.example'
      );
      await writeFile(configPath, xmi, 'utf-8');
      const result = await generateInMemory({ ecorePath, configPath });
      expect(result.success).toBe(true);
      files = result.files;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  function getFile(name: string, marker?: string): string {
    const file = files.find(f =>
      path.basename(f.path) === name && (!marker || f.content.includes(marker))
    );
    if (!file) throw new Error(`File ${name} not found`);
    return file.content;
  }

  describe('#28: enum literals as string member values', () => {
    it('should use the EEnumLiteral literal as member value', () => {
      const content = getFile('Comparator.ts');
      expect(content).toContain('eq = "=="');
      expect(content).toContain('neq = "!="');
      expect(content).toContain('lt = "<"');
      expect(content).toContain('gte = ">="');
    });

    it('should not emit numeric members', () => {
      const content = getFile('Comparator.ts');
      expect(content).not.toMatch(/=\s*\d+\s*[,}]/);
    });
  });

  describe('#29.1: generic type arguments', () => {
    it('should emit type arguments from eGenericType', () => {
      const content = getFile('TextSettings.ts', '@ModelClass');
      expect(content).toContain('fontSize: VariableWrapper<string>');
    });
  });

  describe('#29.2: reference defaults instantiate the referenced class', () => {
    it('should emit new instance instead of the raw literal', () => {
      const content = getFile('TextSettings.ts', '@ModelClass');
      expect(content).toContain('= new VariableWrapper<string>();');
      expect(content).not.toContain('= 12');
    });
  });

  describe('#29.3: attribute defaults', () => {
    it('should default an enum-typed attribute without explicit default to the first literal (EMF semantics)', () => {
      const content = getFile('Condition.ts', '@ModelClass');
      expect(content).toContain('comparator: Comparator = Comparator.eq;');
    });

    it('should resolve a defaultValueLiteral given as literal to the member name', () => {
      const content = getFile('Condition.ts', '@ModelClass');
      // defaultValueLiteral="!=" resolves to the member named neq
      expect(content).toContain('fallback: Comparator = Comparator.neq;');
    });

    it('should default a numeric attribute to its literal', () => {
      const content = getFile('Condition.ts', '@ModelClass');
      expect(content).toContain('threshold: number = 5;');
    });
  });

  describe('#29 regression: decorator argument stays a plain runtime type name', () => {
    it('should not leak generic type arguments into @Reference', () => {
      const content = getFile('TextSettings.ts', '@ModelClass');
      expect(content).toContain("@Reference('VariableWrapper')");
      expect(content).not.toContain("@Reference('VariableWrapper<");
    });

    it('should keep the plain name even when the eType is an unresolved cross-package proxy', () => {
      const content = getFile('TextSettings.ts', '@ModelClass');
      expect(content).toContain("@Reference('RemoteWrapper')");
      // since #33 a single-valued reference to a (presumed) concrete class is instantiated
      expect(content).toContain('remote: RemoteWrapper<string> = new RemoteWrapper<string>();');
      expect(content).not.toContain("@Reference('RemoteWrapper<");
    });

    it('should emit a bare nsURI href literally, never resolved against the model directory', () => {
      const content = getFile('TextSettings.ts', '@ModelClass');
      // the loader absolutizes the relative href against the model location -
      // the emitted import must be the bare specifier from the model
      expect(content).toContain("import { BareWrapper } from 'org.example.bare.composables';");
      expect(content).not.toMatch(/from '[^']*\/org\.example\.bare\.composables'/);
    });
  });

  describe('#29.4: many-valued features initialize to []', () => {
    it('should initialize a many-valued reference to an empty array', () => {
      const content = getFile('Mapping.ts', '@ModelClass');
      expect(content).toContain('conditions: Condition[] = [];');
    });
  });
});
