import { describe, it, expect, beforeAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * Tests for GitHub issue #61: the setter of a single-valued containment
 * reference stored the value and sent the notification, but never made the
 * owner the container of the value (and left the old value contained).
 * The runtime behavior is pinned in generated-library.test.ts; this pins the
 * emitted source, including that the many-valued case and plain attributes
 * stay untouched.
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/61
 */
describe('Issue #61: single-valued containment setter', () => {
  let impl: string;

  beforeAll(async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-61-'));
    try {
      const configPath = path.join(tmpDir, 'model.genconfig.xmi');
      await writeFile(configPath, generateGenConfigXMI(
        'http://example.org/widgets', 'emf', './generated', 'Widgets', 'org.example'
      ), 'utf-8');
      const result = await generateInMemory({
        ecorePath: path.resolve(__dirname, 'fixtures/containment-model.ecore'),
        configPath
      });
      expect(result.success).toBe(true);
      const file = result.files.find(f => path.basename(f.path) === 'WidgetImpl.ts');
      if (!file) throw new Error('WidgetImpl.ts not found');
      impl = file.content;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('setter should release the old value and contain the new one', () => {
    expect(impl).toContain('(oldValue as any).eSetContainer?.(null, null);');
    expect(impl).toContain('this.removeFromPreviousContainer(value);');
    expect(impl).toContain("(value as any).eSetContainer?.(this, this.eClass().getEStructuralFeature('selection'));");
  });

  it('should generate the previous-container helper once', () => {
    expect(impl.match(/private removeFromPreviousContainer/g)).toHaveLength(1);
  });

  it('eUnset should release the contained value', () => {
    expect(impl).toContain('if (this._selection) (this._selection as any).eSetContainer?.(null, null);');
  });

  it('should not touch the many-valued containment', () => {
    // the many-valued feature keeps createContainmentEList and gets no setter
    expect(impl).toContain('createContainmentEList');
    expect(impl).not.toContain('set archive(');
  });
});
