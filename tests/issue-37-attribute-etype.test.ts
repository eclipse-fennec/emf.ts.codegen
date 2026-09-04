import { describe, it, expect, beforeAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * Tests for GitHub issue #37:
 * emf mode generated the Package with setEType() only for EReferences.
 * An EAttribute without eType gives the XMI reader no EDataType to convert
 * against, so every attribute value arrived as the raw document string.
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/37
 */
describe('Issue #37: EAttributes get their eType in the generated Package', () => {
  async function generatePackageSource(ecorePath: string, nsURI: string, prefix: string): Promise<string> {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-37-'));
    try {
      const configPath = path.join(tmpDir, 'model.genconfig.xmi');
      await writeFile(configPath, generateGenConfigXMI(nsURI, 'emf', './generated', prefix, 'org.example'), 'utf-8');
      const result = await generateInMemory({ ecorePath, configPath });
      expect(result.success).toBe(true);
      const pkg = result.files.find(f => path.basename(f.path) === `${prefix}Package.ts`);
      if (!pkg) throw new Error(`${prefix}Package.ts not found`);
      return pkg.content;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  let servicesPackage: string;

  beforeAll(async () => {
    servicesPackage = await generatePackageSource(
      path.resolve(__dirname, 'fixtures/typed-properties.ecore'), 'http://example.org/services', 'Services'
    );
  });

  it('should set the eType for Ecore-typed attributes', () => {
    expect(servicesPackage).toContain(
      "(ServicesPackage.Literals.INT_PROPERTY__VALUE as BasicEAttribute).setEType(getEcorePackage().getEClassifier('EInt')!);"
    );
    expect(servicesPackage).toContain(
      "(ServicesPackage.Literals.BOOL_PROPERTY__VALUE as BasicEAttribute).setEType(getEcorePackage().getEClassifier('EBoolean')!);"
    );
    expect(servicesPackage).toContain(
      "(ServicesPackage.Literals.DOUBLE_PROPERTY__VALUE as BasicEAttribute).setEType(getEcorePackage().getEClassifier('EDouble')!);"
    );
  });

  it('should set the eType for EString attributes as well', () => {
    expect(servicesPackage).toContain(
      "(ServicesPackage.Literals.INT_PROPERTY__NAME as BasicEAttribute).setEType(getEcorePackage().getEClassifier('EString')!);"
    );
  });

  it('should import getEcorePackage for the attribute eTypes', () => {
    expect(servicesPackage).toMatch(/import \{[^}]*getEcorePackage[^}]*\} from '@emfts\/core';/);
  });

  it('should skip attributes typed to local enums (no initialized Literals entry yet)', async () => {
    // GenerationSettings.mode is typed to the local EEnum GenerationMode -
    // emitting a Literals-based setEType for it would not compile
    const genconfigPackage = await generatePackageSource(
      path.resolve(__dirname, '../model/genconfig.ecore'), 'http://www.emfts.org/genconfig/1.0', 'GenConfig'
    );
    expect(genconfigPackage).not.toMatch(/GENERATION_SETTINGS__MODE as BasicEAttribute\)\.setEType/);
    // while the EString attribute on the same class is typed
    expect(genconfigPackage).toContain(
      "(GenConfigPackage.Literals.GENERATION_SETTINGS__OUTPUT_DIR as BasicEAttribute).setEType(getEcorePackage().getEClassifier('EString')!);"
    );
  });
});
