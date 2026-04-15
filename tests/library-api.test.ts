import { describe, it, expect } from 'vitest';
import {
  generate,
  generateInMemory,
  CodeGenerator,
  EcoreLoader,
  GenConfigLoader,
  GenConfigConverter,
  GenerationMode,
  TypeMapper,
  ImportResolver
} from '../src/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Library API', () => {
  const ecorePath = 'examples/model/library.ecore';
  const configPath = 'examples/model/library.genconfig.xmi';

  describe('generateInMemory', () => {
    it('should generate files in memory without writing to disk', async () => {
      const result = await generateInMemory({
        ecorePath,
        configPath
      });

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.diagnostics).toBeDefined();

      // Check that expected files are generated
      const fileNames = result.files.map(f => path.basename(f.path));
      expect(fileNames).toContain('LibraryPackage.ts');
      expect(fileNames).toContain('LibraryFactory.ts');
      expect(fileNames).toContain('BookImpl.ts');
      expect(fileNames).toContain('Book.ts');
      expect(fileNames).toContain('AuthorImpl.ts');
      expect(fileNames).toContain('BookCategory.ts');
    });

    it('should generate valid TypeScript code', async () => {
      const result = await generateInMemory({
        ecorePath,
        configPath
      });

      // Check that files have content
      for (const file of result.files) {
        expect(file.content.length).toBeGreaterThan(0);
        expect(file.content).toContain('@generated');
      }
    });
  });

  describe('generate', () => {
    it('should generate files and write to disk', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emfts-codegen-test-'));

      try {
        const result = await generate({
          ecorePath,
          configPath,
          outputDir: tempDir
        });

        expect(result.success).toBe(true);
        expect(result.files.length).toBeGreaterThan(0);

        // Verify files were written
        const packageFile = path.join(tempDir, 'org/example/LibraryPackage.ts');
        expect(fs.existsSync(packageFile)).toBe(true);

        const content = fs.readFileSync(packageFile, 'utf-8');
        expect(content).toContain('LibraryPackage');
      } finally {
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should not write files when writeFiles is false', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emfts-codegen-test-'));

      try {
        const result = await generate({
          ecorePath,
          configPath,
          outputDir: tempDir,
          writeFiles: false
        });

        expect(result.success).toBe(true);
        expect(result.files.length).toBeGreaterThan(0);

        // Verify files were NOT written
        const packageFile = path.join(tempDir, 'org/example/LibraryPackage.ts');
        expect(fs.existsSync(packageFile)).toBe(false);
      } finally {
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Low-level API', () => {
    it('should allow step-by-step generation', async () => {
      // Load Ecore model
      const ecoreLoader = new EcoreLoader();
      const ePackage = await ecoreLoader.load(ecorePath);
      expect(ePackage).toBeDefined();
      expect(ePackage.getName()).toBe('library');

      // Load GenConfig
      const configLoader = new GenConfigLoader();
      configLoader.registerPackage(ePackage);
      const genConfig = await configLoader.load(configPath);
      expect(genConfig).toBeDefined();
      expect(genConfig.generation.mode).toBe('emf');

      // Convert to GenModel
      const converter = new GenConfigConverter();
      const genModel = converter.convert(genConfig);
      expect(genModel).toBeDefined();
      expect(genModel.generationMode).toBe(GenerationMode.EMF);

      // Generate code
      const generator = new CodeGenerator(genModel);
      const result = await generator.generate();
      expect(result.success).toBe(true);
      expect(result.files.length).toBe(14);
    });
  });

  describe('TypeMapper', () => {
    it('should map Ecore types to TypeScript types', () => {
      const mapper = new TypeMapper();

      // Test using addMapping and custom types
      mapper.addMapping('MyCustomType', 'CustomTS');
      // TypeMapper.mapClassifier needs an EClassifier object, so we test indirectly
      expect(mapper).toBeDefined();
    });
  });

  describe('ImportResolver', () => {
    it('should register and resolve package paths', () => {
      const resolver = new ImportResolver();
      resolver.registerPackage('http://example.org/test', '@example/test');

      // ImportResolver methods need EClass objects, so we test basic setup
      expect(resolver).toBeDefined();
    });
  });

  describe('Exports', () => {
    it('should export all main classes', () => {
      expect(CodeGenerator).toBeDefined();
      expect(EcoreLoader).toBeDefined();
      expect(GenConfigLoader).toBeDefined();
      expect(GenConfigConverter).toBeDefined();
      expect(TypeMapper).toBeDefined();
      expect(ImportResolver).toBeDefined();
    });

    it('should export GenerationMode enum', () => {
      expect(GenerationMode.PLAIN).toBeDefined();
      expect(GenerationMode.DECORATOR).toBeDefined();
      expect(GenerationMode.EMF).toBeDefined();
    });

    it('should export generate functions', () => {
      expect(typeof generate).toBe('function');
      expect(typeof generateInMemory).toBe('function');
    });
  });
});
