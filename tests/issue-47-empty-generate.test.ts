import { describe, it, expect } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';
import { EcoreLoader } from '../src/loader/EcoreLoader.js';
import { GenConfigLoader } from '../src/genconfig/GenConfigLoader.js';

/**
 * Tests for GitHub issue #47:
 * with @emfts/core >= 0.3 an unresolved reference is a TYPED proxy (an empty
 * BasicEPackage/BasicEClass answering getNsURI()/getName() with null) instead
 * of an EProxyImpl. The nsURI-based ecorePackage reference of a GenConfig then
 * resolved to the empty proxy, the generator saw no classifiers and silently
 * overwrote the existing output with empty files - reporting success.
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/47
 */
describe('Issue #47: nsURI package references and the empty-model guard', () => {
  const basePath = path.resolve(__dirname, 'fixtures/base-model.ecore');

  it('should resolve an nsURI ecorePackage reference to the registered model', async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-47-'));
    try {
      const configPath = path.join(tmpDir, 'model.genconfig.xmi');
      await writeFile(configPath, generateGenConfigXMI(
        'http://example.org/base', 'emf', './generated', 'Base', 'org.example'
      ), 'utf-8');

      const ecoreLoader = new EcoreLoader();
      const ePackage = await ecoreLoader.load(basePath);
      const configLoader = new GenConfigLoader();
      configLoader.registerPackage(ePackage);
      const genConfig = await configLoader.load(configPath);

      // the registered model, not a typed empty proxy
      expect(genConfig.ecorePackage).toBe(ePackage);
      expect(genConfig.ecorePackage.getEClassifiers().length).toBeGreaterThan(0);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('should fail instead of succeeding with empty files when the model has no classifiers', async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-47-'));
    try {
      const ecorePath = path.join(tmpDir, 'empty.ecore');
      await writeFile(ecorePath, `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="empty" nsURI="http://example.org/empty" nsPrefix="empty"/>
`, 'utf-8');
      const configPath = path.join(tmpDir, 'model.genconfig.xmi');
      await writeFile(configPath, generateGenConfigXMI(
        'http://example.org/empty', 'emf', './generated', 'Empty', 'org.example'
      ), 'utf-8');

      const result = await generateInMemory({ ecorePath, configPath });
      expect(result.success).toBe(false);
      expect(result.files).toHaveLength(0);
      expect(result.diagnostics.some(d =>
        d.level === 'error' && d.message.includes('no classifiers')
      )).toBe(true);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
