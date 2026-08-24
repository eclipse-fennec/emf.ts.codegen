import { describe, it, expect, beforeAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * Tests for GitHub issue #27:
 * decorator mode must emit GenModel documentation annotations as
 * @Documentation decorators - on features and on the class - and multiline
 * values must be emitted as valid string literals (JSON.stringify).
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/27
 */
describe('Issue #27: GenModel documentation as @Documentation', () => {
  const ecorePath = path.resolve(__dirname, 'fixtures/base-model.ecore');

  let files: Array<{ path: string; content: string }>;

  beforeAll(async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-27-'));
    try {
      const configPath = path.join(tmpDir, 'base.genconfig.xmi');
      const xmi = generateGenConfigXMI(
        'http://example.org/base', 'decorator', './generated', 'Base', 'org.example'
      );
      await writeFile(configPath, xmi, 'utf-8');
      const result = await generateInMemory({ ecorePath, configPath });
      expect(result.success).toBe(true);
      files = result.files;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  function getClassFile(name: string): string {
    const file = files.find(f => path.basename(f.path) === name && f.content.includes('@ModelClass'));
    if (!file) throw new Error(`Class file ${name} not found`);
    return file.content;
  }

  it('should emit @Documentation for a documented feature', () => {
    const content = getClassFile('Component.ts');
    expect(content).toContain('@Documentation("The component name.")');
    // decorator directly above the feature
    expect(content).toMatch(/@Documentation\("The component name\."\)\s*\n\s*@Attribute\(\)/);
  });

  it('should emit @Documentation on the class', () => {
    const content = getClassFile('Component.ts');
    expect(content).toMatch(/@Documentation\("Base class for all UI components\."\)\s*\n@ModelClass/);
  });

  it('should emit multiline documentation as a valid string literal', () => {
    const content = getClassFile('Expression.ts');
    // JSON.stringify keeps the line break escaped and the quotes intact
    expect(content).toContain('@Documentation("The expression body.\\nSupports the \\"OCL\\" dialect.")');
    // no raw line break inside the emitted decorator argument
    expect(content).not.toMatch(/@Documentation\("The expression body\.\n/);
  });

  it('should not emit @Documentation for undocumented features', () => {
    const content = getClassFile('Expression.ts');
    // 'language' has no documentation annotation
    expect(content).toMatch(/@Attribute\(\)\s*\n\s*language/);
  });
});
