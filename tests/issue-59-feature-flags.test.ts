import { describe, it, expect, beforeAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * Tests for GitHub issue #59:
 * feature flags from the .ecore (unsettable, transient, derived, volatile,
 * changeable, iD, resolveProxies, eOpposite) were not carried into the
 * generated EStructuralFeature metadata - reflective code was told the Ecore
 * defaults regardless of the model.
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/59
 */
describe('Issue #59: feature flags reach the EStructuralFeature metadata', () => {
  let pkg: string;

  beforeAll(async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-59-'));
    try {
      const configPath = path.join(tmpDir, 'model.genconfig.xmi');
      await writeFile(configPath, generateGenConfigXMI(
        'http://example.org/flags', 'emf', './generated', 'Flags', 'org.example'
      ), 'utf-8');
      const result = await generateInMemory({
        ecorePath: path.resolve(__dirname, 'fixtures/flags-model.ecore'),
        configPath
      });
      expect(result.success).toBe(true);
      const file = result.files.find(f => path.basename(f.path) === 'FlagsPackage.ts');
      if (!file) throw new Error('FlagsPackage.ts not found');
      pkg = file.content;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('should emit every flag that differs from the Ecore default', () => {
    expect(pkg).toContain('widget_labels.setUnsettable(true);');
    expect(pkg).toContain('widget_cache.setTransient(true);');
    expect(pkg).toContain('widget_area.setDerived(true);');
    expect(pkg).toContain('widget_area.setVolatile(true);');
    expect(pkg).toContain('widget_area.setChangeable(false);');
    expect(pkg).toContain('widget_id.setID(true);');
    expect(pkg).toContain('widget_parent.setResolveProxies(false);');
  });

  it('should not emit flags that match the Ecore default', () => {
    expect(pkg).not.toContain('widget_id.setUnsettable');
    expect(pkg).not.toContain('setChangeable(true)');
    expect(pkg).not.toContain('setResolveProxies(true)');
  });

  it('should wire eOpposite pairs after all features exist', () => {
    expect(pkg).toContain(
      '(FlagsPackage.Literals.WIDGET__CHILDREN as BasicEReference).setEOpposite(FlagsPackage.Literals.WIDGET__PARENT as EReference);'
    );
    expect(pkg).toContain(
      '(FlagsPackage.Literals.WIDGET__PARENT as BasicEReference).setEOpposite(FlagsPackage.Literals.WIDGET__CHILDREN as EReference);'
    );
  });
});
