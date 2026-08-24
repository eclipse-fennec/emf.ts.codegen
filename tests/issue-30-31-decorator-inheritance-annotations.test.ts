import { describe, it, expect, beforeAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * Tests for GitHub issues #30 and #31 (decorator mode):
 * - #30: a supertype that stays an unresolved cross-package proxy must keep
 *        its extends clause (the import was already emitted, extends dropped)
 * - #31: custom decorator eAnnotations (source '<specifier>/<Decorator>')
 *        become an import plus a decorator with the details as options;
 *        optional operation parameters (lowerBound 0) get '?'
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/30
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/31
 */
describe('Issues #30/#31: decorator inheritance and custom annotations', () => {
  const ecorePath = path.resolve(__dirname, 'fixtures/events-model.ecore');

  let content: string;

  beforeAll(async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-30-31-'));
    try {
      const configPath = path.join(tmpDir, 'events.genconfig.xmi');
      const xmi = generateGenConfigXMI(
        'http://example.org/events', 'decorator', './generated', 'Events', 'org.example',
        new Map([['http://example.org/actions', 'org.example.actions']])
      );
      await writeFile(configPath, xmi, 'utf-8');
      const result = await generateInMemory({ ecorePath, configPath });
      expect(result.success).toBe(true);
      const file = result.files.find(f =>
        path.basename(f.path) === 'ActionSet.ts' && f.content.includes('@ModelClass')
      );
      if (!file) throw new Error('ActionSet.ts class file not found');
      content = file.content;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  describe('#30: extends survives an unresolved supertype proxy', () => {
    it('should emit the extends clause with the proxy name', () => {
      expect(content).toContain('export class ActionSet extends ActionBase {');
    });

    it('should import the supertype via the import mapping', () => {
      expect(content).toContain("import { ActionBase } from 'org.example.actions';");
    });
  });

  describe('#31: custom decorator eAnnotations', () => {
    it('should emit the decorator with the details as options object', () => {
      expect(content).toContain('@WidgetAction({eventType: "system.changePage"})');
    });

    it('should import the decorator from the annotation source specifier', () => {
      expect(content).toContain("import { WidgetAction } from 'org.example.actions';");
    });

    it('should not treat GenModel annotations as custom decorators', () => {
      expect(content).not.toContain('@GenModel');
    });
  });

  describe('#31: optional operation parameters', () => {
    it('should mark a lowerBound-0 parameter optional', () => {
      expect(content).toContain('changePage(pageId?: string): void');
    });

    it('should not mark an optional-before-required parameter (TS forbids it)', () => {
      expect(content).toContain('mixedParams(first: string, second: string): void');
    });
  });
});
