import { describe, it, expect } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { EcoreLoader } from '../src/loader/EcoreLoader.js';
import { GenConfigLoader } from '../src/genconfig/GenConfigLoader.js';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';
import { parseImportMappings } from '../src/cli/import-mappings.js';

/**
 * Tests for GitHub issue #25:
 * - init does not resolve href references to other packages
 * - unresolved eSubpackages proxies crashed with "subPkg.getNsURI is not a function"
 * - init lacked --dependency/--import-mapping options
 * - --import-mapping is persisted as referencedPackages in the GenConfig
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/25
 */
describe('Issue #25: init with cross-package href references', () => {
  const basePath = path.resolve(__dirname, 'fixtures/base-model.ecore');
  const compositePath = path.resolve(__dirname, 'fixtures/composite-model.ecore');

  describe('EcoreLoader with unresolved eSubpackages proxies', () => {
    it('should reject with a message naming the missing package instead of crashing', async () => {
      const loader = new EcoreLoader();
      await expect(loader.load(compositePath)).rejects.toThrow(
        /Unresolved eSubpackages reference 'http:\/\/example\.org\/base#\/'.*--dependency/s
      );
    });

    it('should resolve eSubpackages and eSuperTypes when the dependency is loaded first', async () => {
      const loader = new EcoreLoader();
      await loader.load(basePath);
      const pkg = await loader.load(compositePath);

      const subPackages = Array.from((pkg as any).getESubpackages());
      expect(subPackages).toHaveLength(1);
      expect((subPackages[0] as any).getNsURI()).toBe('http://example.org/base');

      const composite = pkg.getEClassifier('CompositeComponent') as any;
      const superType = Array.from(composite.getESuperTypes())[0] as any;
      expect(superType.eIsProxy?.()).toBeFalsy();
      expect(superType.getName()).toBe('Component');
    });
  });

  describe('parseImportMappings', () => {
    it('should parse nsURI=importPath mappings', () => {
      const mappings = parseImportMappings([
        'http://example.org/base=@base/model',
        'http://example.org/other=@other/model',
      ]);
      expect(mappings.get('http://example.org/base')).toBe('@base/model');
      expect(mappings.get('http://example.org/other')).toBe('@other/model');
    });

    it('should skip mappings without =', () => {
      const mappings = parseImportMappings(['invalid-mapping']);
      expect(mappings.size).toBe(0);
    });
  });

  describe('generateGenConfigXMI with referencedPackages', () => {
    it('should emit referencedPackages elements', () => {
      const xmi = generateGenConfigXMI(
        'http://example.org/composite', 'emf', './generated', 'Composite', 'org.example',
        new Map([['http://example.org/base', '@base/model']])
      );
      expect(xmi).toContain('<referencedPackages nsURI="http://example.org/base" importPath="@base/model"/>');
    });

    it('should escape XML special characters in attribute values', () => {
      const xmi = generateGenConfigXMI(
        'http://example.org/composite', 'emf', './generated', 'Composite', 'org.example',
        new Map([['http://example.org/base?a=1&b="x"', '@base/<model>']])
      );
      expect(xmi).toContain('nsURI="http://example.org/base?a=1&amp;b=&quot;x&quot;"');
      expect(xmi).toContain('importPath="@base/&lt;model&gt;"');
    });

    it('should emit no referencedPackages element without mappings', () => {
      const xmi = generateGenConfigXMI(
        'http://example.org/composite', 'emf', './generated', 'Composite', 'org.example'
      );
      expect(xmi).not.toContain('<referencedPackages');
    });
  });

  describe('referencedPackages round-trip (init → GenConfigLoader → generate)', () => {
    it('should load referencedPackages from the GenConfig and use them for imports', async () => {
      const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-25-'));
      try {
        const configPath = path.join(tmpDir, 'composite.genconfig.xmi');
        const xmi = generateGenConfigXMI(
          'http://example.org/composite', 'emf', './generated', 'Composite', 'org.example',
          new Map([['http://example.org/base', '@base/model']])
        );
        await writeFile(configPath, xmi, 'utf-8');

        // GenConfigLoader parses the referencedPackages
        const ecoreLoader = new EcoreLoader();
        await ecoreLoader.load(basePath);
        const ePackage = await ecoreLoader.load(compositePath);
        const configLoader = new GenConfigLoader();
        configLoader.registerPackage(ePackage);
        const genConfig = await configLoader.load(configPath);
        expect(genConfig.referencedPackages).toEqual([
          { nsURI: 'http://example.org/base', importPath: '@base/model' },
        ]);

        // generate uses them without explicit referencedPackages option
        const result = await generateInMemory({
          ecorePath: compositePath,
          configPath,
          dependencies: [basePath],
        });
        expect(result.success).toBe(true);
        const composite = result.files.find(f => path.basename(f.path) === 'CompositeComponent.ts');
        expect(composite).toBeDefined();
        expect(composite!.content).toContain('@base/model');
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
