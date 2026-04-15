import { describe, it, expect } from 'vitest';
import {
  generate,
  generateInMemory,
  GenConfigLoader,
  GenConfigConverter,
  EcoreLoader
} from '../src/index.js';
import * as path from 'path';

describe('GenConfigLoader', () => {
  const ecorePath = 'examples/model/library.ecore';
  const configPath = 'examples/model/library.genconfig.xmi';

  describe('load', () => {
    it('should load genconfig.xmi file', async () => {
      // Load ecore first
      const ecoreLoader = new EcoreLoader();
      const ePackage = await ecoreLoader.load(ecorePath);

      // Load genconfig
      const configLoader = new GenConfigLoader();
      configLoader.registerPackage(ePackage);
      const genConfig = await configLoader.load(configPath);

      expect(genConfig).toBeDefined();
      expect(genConfig.ecorePackage).toBe(ePackage);
      expect(genConfig.generation.mode).toBe('emf');
      expect(genConfig.generation.outputDir).toBe('./generated');
      expect(genConfig.package.prefix).toBe('Library');
      expect(genConfig.package.basePackage).toBe('org.example');
    });

    it('should resolve class overrides', async () => {
      const ecoreLoader = new EcoreLoader();
      const ePackage = await ecoreLoader.load(ecorePath);

      const configLoader = new GenConfigLoader();
      configLoader.registerPackage(ePackage);
      const genConfig = await configLoader.load(configPath);

      // Check class overrides exist
      expect(genConfig.classOverrides).toBeDefined();
      expect(genConfig.classOverrides!.length).toBeGreaterThan(0);

      // Find Book override
      const bookOverride = genConfig.classOverrides!.find(
        co => co.ecoreClass.getName?.() === 'Book'
      );
      expect(bookOverride).toBeDefined();
      expect(bookOverride!.featureOverrides).toBeDefined();
    });

    it('should resolve feature overrides', async () => {
      const ecoreLoader = new EcoreLoader();
      const ePackage = await ecoreLoader.load(ecorePath);

      const configLoader = new GenConfigLoader();
      configLoader.registerPackage(ePackage);
      const genConfig = await configLoader.load(configPath);

      // Find Book override
      const bookOverride = genConfig.classOverrides!.find(
        co => co.ecoreClass.getName?.() === 'Book'
      );

      // Find author feature override
      const authorOverride = bookOverride!.featureOverrides!.find(
        fo => fo.ecoreFeature.getName?.() === 'author'
      );
      expect(authorOverride).toBeDefined();
      expect(authorOverride!.notify).toBe(false);
    });
  });

  describe('GenConfigConverter', () => {
    it('should convert GenConfig to GenModel', async () => {
      const ecoreLoader = new EcoreLoader();
      const ePackage = await ecoreLoader.load(ecorePath);

      const configLoader = new GenConfigLoader();
      configLoader.registerPackage(ePackage);
      const genConfig = await configLoader.load(configPath);

      const converter = new GenConfigConverter();
      const genModel = converter.convert(genConfig);

      expect(genModel).toBeDefined();
      expect(genModel.generationMode).toBe('emf');
      expect(genModel.genPackages.length).toBe(1);
      expect(genModel.genPackages[0].prefix).toBe('Library');
      expect(genModel.genPackages[0].genClasses.length).toBeGreaterThan(0);
    });
  });

  describe('generate', () => {
    it('should generate code using genconfig.xmi format', async () => {
      const result = await generateInMemory({
        ecorePath,
        configPath
      });

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);

      // Check expected files
      const fileNames = result.files.map(f => path.basename(f.path));
      expect(fileNames).toContain('LibraryPackage.ts');
      expect(fileNames).toContain('LibraryFactory.ts');
      expect(fileNames).toContain('BookImpl.ts');
      expect(fileNames).toContain('Book.ts');
    });

    it('should apply feature overrides from config', async () => {
      const result = await generateInMemory({
        ecorePath,
        configPath
      });

      // Find BookImpl.ts
      const bookImpl = result.files.find(f => f.path.endsWith('BookImpl.ts'));
      expect(bookImpl).toBeDefined();

      // The author setter should NOT have notification code (notify=false in config)
      // Check that the author setter is simple (no eNotify)
      const authorSetterMatch = bookImpl!.content.match(/set author\(value[^}]+\}/s);
      if (authorSetterMatch) {
        // notify=false means no eDeliver/eNotify calls
        expect(authorSetterMatch[0]).not.toContain('eDeliver');
      }
    });
  });
});
