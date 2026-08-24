import { describe, it, expect } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * Tests for GitHub issue #26:
 * decorator mode should support importing the annotations from a shared
 * package (annotationsPackage) instead of generating ModelAnnotations.ts
 * per model, and the generated fallback ModelAnnotations must use
 * Symbol.for() keys so multiple copies share metadata identities.
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/26
 */
describe('Issue #26: shared annotations package in decorator mode', () => {
  const ecorePath = path.resolve(__dirname, 'fixtures/base-model.ecore');
  const SHARED_PKG = 'org.example.lib.annotations';

  async function generateWithConfig(annotationsPackage?: string) {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-26-'));
    try {
      const configPath = path.join(tmpDir, 'base.genconfig.xmi');
      const xmi = generateGenConfigXMI(
        'http://example.org/base', 'decorator', './generated', 'Base', 'org.example',
        undefined, annotationsPackage
      );
      await writeFile(configPath, xmi, 'utf-8');

      const result = await generateInMemory({ ecorePath, configPath });
      expect(result.success).toBe(true);
      return result.files;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  function findFile(files: Array<{ path: string; content: string }>, name: string) {
    return files.find(f => path.basename(f.path) === name);
  }

  // Decorator mode emits interface and class under the same file name —
  // pick the class file (the one carrying the decorators)
  function findClassFile(files: Array<{ path: string; content: string }>, name: string) {
    return files.find(f => path.basename(f.path) === name && f.content.includes('@ModelClass'));
  }

  describe('with annotationsPackage configured', () => {
    it('should not generate ModelAnnotations.ts', async () => {
      const files = await generateWithConfig(SHARED_PKG);
      expect(findFile(files, 'ModelAnnotations.ts')).toBeUndefined();
    });

    it('should import annotations from the shared package in class files', async () => {
      const files = await generateWithConfig(SHARED_PKG);
      const component = findClassFile(files, 'Component.ts');
      expect(component).toBeDefined();
      // only the annotation decorators the class actually uses are imported (#32)
      expect(component!.content).toContain(
        `import { Documentation, Attribute, ModelClass } from '${SHARED_PKG}';`
      );
      expect(component!.content).not.toContain('./ModelAnnotations');
    });

    it('should not re-export ModelAnnotations from the package index', async () => {
      const files = await generateWithConfig(SHARED_PKG);
      const index = files.find(f => path.basename(f.path) === 'index.ts');
      expect(index).toBeDefined();
      expect(index!.content).not.toContain('ModelAnnotations');
    });

    it('should persist annotationsPackage in the GenConfig XMI', () => {
      const xmi = generateGenConfigXMI(
        'http://example.org/base', 'decorator', './generated', 'Base', 'org.example',
        undefined, SHARED_PKG
      );
      expect(xmi).toContain(`annotationsPackage="${SHARED_PKG}"`);
    });
  });

  describe('without annotationsPackage (default)', () => {
    it('should generate ModelAnnotations.ts and import from it', async () => {
      const files = await generateWithConfig();
      const annotations = findFile(files, 'ModelAnnotations.ts');
      expect(annotations).toBeDefined();

      const component = findClassFile(files, 'Component.ts');
      expect(component!.content).toContain("from './ModelAnnotations.js';");
    });

    it('generated ModelAnnotations should use Symbol.for() keys', async () => {
      const files = await generateWithConfig();
      const annotations = findFile(files, 'ModelAnnotations.ts');
      expect(annotations!.content).toContain("Symbol.for('emfts.modelClass')");
      expect(annotations!.content).not.toMatch(/Symbol\('[^)]*'\)/);
    });

    it('should not write annotationsPackage into the GenConfig XMI', () => {
      const xmi = generateGenConfigXMI(
        'http://example.org/base', 'decorator', './generated', 'Base', 'org.example'
      );
      expect(xmi).not.toContain('annotationsPackage');
    });
  });
});
