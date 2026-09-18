import { describe, it, expect, beforeAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';

/**
 * Tests for GitHub issue #41:
 * a classOverride with generateInterface="false"/generateImpl="false"
 * suppressed the class files, but the factory and the index still imported
 * them - the generated package did not compile.
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/41
 */
describe('Issue #41: classOverrides reach the factory and the index', () => {
  function configXMI(mode: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<genconfig:GenConfig xmlns:xmi="http://www.omg.org/XMI" xmi:version="2.0" xmlns:genconfig="http://www.emfts.org/genconfig/1.0" ecorePackage="http://example.org/services#/">
  <generation mode="${mode}" outputDir="./generated"/>
  <package prefix="Services" basePackage="org.example" generateFactory="true" generatePackage="true" generateIndex="true"/>
  <classDefaults generateInterface="true" generateImpl="true" rootExtendsClass="BasicEObject" rootExtendsInterface="EObject"/>
  <classOverrides generateInterface="false" generateImpl="false">
    <ecoreClass href="http://example.org/services#//BoolProperty"/>
  </classOverrides>
</genconfig:GenConfig>
`;
  }

  async function generateWith(mode: string) {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-41-'));
    try {
      const configPath = path.join(tmpDir, 'model.genconfig.xmi');
      await writeFile(configPath, configXMI(mode), 'utf-8');
      const result = await generateInMemory({
        ecorePath: path.resolve(__dirname, 'fixtures/typed-properties.ecore'),
        configPath
      });
      expect(result.success).toBe(true);
      return result.files;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  function getFile(files: Array<{ path: string; content: string }>, name: string): string {
    const file = files.find(f => path.basename(f.path) === name);
    if (!file) throw new Error(`File ${name} not found`);
    return file.content;
  }

  describe('emf mode', () => {
    let files: Array<{ path: string; content: string }>;

    beforeAll(async () => {
      files = await generateWith('emf');
    });

    it('should not write the suppressed class files', () => {
      const names = files.map(f => path.basename(f.path));
      expect(names).not.toContain('BoolProperty.ts');
      expect(names).not.toContain('BoolPropertyImpl.ts');
      expect(names).toContain('IntProperty.ts');
      expect(names).toContain('IntPropertyImpl.ts');
    });

    it('factory should not import or create the suppressed class', () => {
      const factory = getFile(files, 'ServicesFactory.ts');
      expect(factory).not.toContain('BoolProperty');
      expect(factory).toContain('createIntProperty');
    });

    it('index should not re-export the suppressed class', () => {
      const index = getFile(files, 'index.ts');
      expect(index).not.toContain('BoolProperty');
      expect(index).toContain("export type { IntProperty } from './IntProperty.js';");
      expect(index).toContain("export { IntPropertyImpl } from './IntPropertyImpl.js';");
    });

    it('package should keep the model metadata of the suppressed class', () => {
      // the EClass still exists in the model - only its TS files are suppressed
      const pkg = getFile(files, 'ServicesPackage.ts');
      expect(pkg).toContain('BOOL_PROPERTY');
    });
  });

  describe('decorator mode', () => {
    it('package index should not re-export the suppressed class', async () => {
      const files = await generateWith('decorator');
      const index = getFile(files, 'index.ts');
      expect(index).not.toContain('BoolProperty');
      expect(index).toContain("export * from './IntProperty.js';");
    });
  });
});
