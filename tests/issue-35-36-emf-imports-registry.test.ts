import { describe, it, expect } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * Tests for GitHub issues #35 and #36 (emf mode):
 * - #35: a reference type instantiated in a field initializer was imported
 *        type-only - `import type` is erased, `new T()` threw at runtime
 * - #36: the generated package resolved foreign types from the registry but
 *        never registered itself; generateFactory="false" left a dangling
 *        factory import in the package and index
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/35
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/36
 */
describe('Issues #35/#36: emf mode imports and package registry', () => {
  const basePath = path.resolve(__dirname, 'fixtures/base-model.ecore');
  const wrapperPath = path.resolve(__dirname, 'fixtures/wrapper-model.ecore');

  async function generateWith(configXMI: string, ecorePath: string, dependencies?: string[]) {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-35-36-'));
    try {
      const configPath = path.join(tmpDir, 'model.genconfig.xmi');
      await writeFile(configPath, configXMI, 'utf-8');
      const result = await generateInMemory({ ecorePath, configPath, dependencies });
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

  describe('#35: instantiated reference types get a value import', () => {
    it('should emit a value import for a type used in new', async () => {
      const files = await generateWith(
        generateGenConfigXMI('http://example.org/wrapper', 'emf', './generated', 'Wrapper', 'org.example',
          new Map([['http://example.org/base', '@base/model']])),
        wrapperPath, [basePath]
      );
      const impl = getFile(files, 'WrapperSettingsImpl.ts');
      expect(impl).toContain('= new Expression();');
      expect(impl).toContain("import { Expression } from '@base/model';");
      expect(impl).not.toContain("import type { Expression }");
    });

    it('should keep type-only imports for types not used as values', async () => {
      const files = await generateWith(
        generateGenConfigXMI('http://example.org/composite', 'emf', './generated', 'Composite', 'org.example',
          new Map([['http://example.org/base', '@base/model']])),
        path.resolve(__dirname, 'fixtures/composite-model.ecore'), [basePath]
      );
      // CompositeComponent has no instantiated cross-package types
      const impl = getFile(files, 'CompositeComponentImpl.ts');
      expect(impl).not.toMatch(/^import \{ Component \}/m);
    });
  });

  describe('#36.1: the generated package registers itself', () => {
    it('should enter itself into the EPackageRegistry in init()', async () => {
      const files = await generateWith(
        generateGenConfigXMI('http://example.org/base', 'emf', './generated', 'Base', 'org.example'),
        basePath
      );
      const pkg = getFile(files, 'BasePackage.ts');
      expect(pkg).toContain('EPackageRegistry.INSTANCE.set(BasePackage.eNS_URI, this);');
    });

    it('should resolve foreign packages with an actionable error instead of a null dereference', async () => {
      const files = await generateWith(
        generateGenConfigXMI('http://example.org/wrapper', 'emf', './generated', 'Wrapper', 'org.example',
          new Map([['http://example.org/base', '@base/model']])),
        wrapperPath, [basePath]
      );
      const pkg = getFile(files, 'WrapperPackage.ts');
      expect(pkg).toContain('function requireEPackage(');
      expect(pkg).toContain("requireEPackage('http://example.org/base').getEClassifier('Expression')!");
      expect(pkg).not.toMatch(/EPackageRegistry\.INSTANCE\.getEPackage\('[^']*'\)!/);
    });
  });

  describe('#36.2: generateFactory="false" leaves no dangling references', () => {
    const typeOnlyConfig = `<?xml version="1.0" encoding="UTF-8"?>
<genconfig:GenConfig xmlns:xmi="http://www.omg.org/XMI" xmi:version="2.0" xmlns:genconfig="http://www.emfts.org/genconfig/1.0" ecorePackage="http://example.org/base#/">
  <generation mode="emf" outputDir="./generated"/>
  <package prefix="Base" basePackage="org.example" generateFactory="false" generatePackage="true" generateIndex="true"/>
  <classDefaults generateInterface="false" generateImpl="false" rootExtendsClass="BasicEObject" rootExtendsInterface="EObject"/>
</genconfig:GenConfig>
`;

    it('should not import or wire the factory in the package', async () => {
      const files = await generateWith(typeOnlyConfig, basePath);
      const pkg = getFile(files, 'BasePackage.ts');
      expect(pkg).not.toContain('Factory');
    });

    it('should not export the factory or class files from the index', async () => {
      const files = await generateWith(typeOnlyConfig, basePath);
      const index = getFile(files, 'index.ts');
      expect(index).not.toContain('Factory');
      expect(index).not.toContain('Component');
      expect(index).toContain("export { BasePackage } from './BasePackage.js';");
    });
  });
});
