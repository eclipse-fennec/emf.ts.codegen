import { describe, it, expect, beforeAll } from 'vitest';
import { generateInMemory } from '../src/index.js';
import * as path from 'path';

/**
 * Tests for cross-package reference support (Issue #9)
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/9
 */
describe('Issue #9: Cross-package references', () => {
  const basePath = path.resolve(__dirname, 'fixtures/base-model.ecore');
  const extPath = path.resolve(__dirname, 'fixtures/ext-model.ecore');
  const configPath = path.resolve(__dirname, 'fixtures/ext-model.genconfig.xmi');

  let files: Array<{ path: string; content: string }>;

  beforeAll(async () => {
    const result = await generateInMemory({
      ecorePath: extPath,
      configPath,
      dependencies: [basePath],
      referencedPackages: new Map([
        ['http://example.org/base', '@base/model'],
      ]),
    });
    expect(result.success).toBe(true);
    files = result.files;
  });

  function getFile(name: string): string {
    const file = files.find(f => path.basename(f.path) === name);
    if (!file) {
      const available = files.map(f => path.basename(f.path)).join(', ');
      throw new Error(`File ${name} not found. Available: ${available}`);
    }
    return file.content;
  }

  it('should generate without crashing', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('should generate ChartView interface', () => {
    const content = getFile('ChartView.ts');
    expect(content).toContain('export interface ChartView');
  });

  it('should import Component from external package in interface', () => {
    const content = getFile('ChartView.ts');
    expect(content).toContain("from '@base/model'");
  });

  it('should extend Component in interface', () => {
    const content = getFile('ChartView.ts');
    expect(content).toMatch(/extends\s+Component/);
  });

  it('should generate ChartViewImpl', () => {
    const content = getFile('ChartViewImpl.ts');
    expect(content).toContain('export class ChartViewImpl');
  });

  it('should import Expression type for cross-package feature reference', () => {
    const content = getFile('ChartView.ts');
    expect(content).toContain('Expression');
  });

  it('ChartViewImpl should extend ComponentImpl from external package', () => {
    const content = getFile('ChartViewImpl.ts');
    // Component is abstract (not interface), so its Impl is imported from the external package
    expect(content).toContain('extends ComponentImpl');
    expect(content).toContain("import { ComponentImpl } from '@base/model'");
  });

  it('ChartViewImpl should NOT have mixin name property (inherited via ComponentImpl)', () => {
    const content = getFile('ChartViewImpl.ts');
    // 'name' is inherited through ComponentImpl, no mixin needed
    expect(content).not.toMatch(/private _name/);
  });
});
