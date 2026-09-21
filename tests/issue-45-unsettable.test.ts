import { describe, it, expect, beforeAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * Tests for GitHub issue #45:
 * unsettable="true" was ignored - eIsSet degraded to a value comparison, so
 * "never set" and "set to the default" were indistinguishable (worst for
 * EEnum attributes, whose intrinsic default is the first literal). Like Java
 * EMF, an unsettable feature now carries a separate ESet flag.
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/45
 */
describe('Issue #45: unsettable features get a separate ESet flag', () => {
  let impl: string;

  beforeAll(async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-45-'));
    try {
      const configPath = path.join(tmpDir, 'model.genconfig.xmi');
      await writeFile(configPath, generateGenConfigXMI(
        'http://example.org/mqtt', 'emf', './generated', 'Mqtt', 'org.example'
      ), 'utf-8');
      const result = await generateInMemory({
        ecorePath: path.resolve(__dirname, 'fixtures/unsettable-model.ecore'),
        configPath
      });
      expect(result.success).toBe(true);
      const file = result.files.find(f => path.basename(f.path) === 'OperationFlavorImpl.ts');
      if (!file) throw new Error('OperationFlavorImpl.ts not found');
      impl = file.content;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('should emit an ESet flag field per unsettable feature', () => {
    expect(impl).toContain('private _qosIsSet = false;');
    expect(impl).toContain('private _correlationIsSet = false;');
    // requestTopic is not unsettable - no flag
    expect(impl).not.toContain('_requestTopicIsSet');
  });

  it('setter should raise the flag', () => {
    expect(impl).toMatch(/this\._qos = value;\s*\n\s*this\._qosIsSet = true;/);
  });

  it('eIsSet should read the flag instead of comparing against the default', () => {
    expect(impl).toMatch(/case OperationFlavorImpl\.QOS:\s*\n\s*return this\._qosIsSet;/);
    expect(impl).toMatch(/case OperationFlavorImpl\.CORRELATION:\s*\n\s*return this\._correlationIsSet;/);
    // the non-unsettable feature keeps the state-based check
    expect(impl).toMatch(/case OperationFlavorImpl\.REQUEST_TOPIC:\s*\n\s*return this\._requestTopic !== undefined;/);
  });

  it('eUnset should restore the default and clear the flag', () => {
    expect(impl).toMatch(/case OperationFlavorImpl\.QOS:\s*\n\s*this\._qos = MqttQos\.AT_MOST_ONCE;\s*\n\s*this\._qosIsSet = false;/);
    expect(impl).toMatch(/case OperationFlavorImpl\.CORRELATION:\s*\n\s*this\._correlation = true;\s*\n\s*this\._correlationIsSet = false;/);
  });
});
