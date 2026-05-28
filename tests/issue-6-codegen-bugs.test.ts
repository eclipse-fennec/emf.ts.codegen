import { describe, it, expect, beforeAll } from 'vitest';
import { generateInMemory } from '../src/index.js';
import * as path from 'path';

/**
 * Tests for GitHub issue #6:
 * - Bug 1: Missing imports for EOperation parameter/return types
 * - Bug 2: No Impl generated for abstract root EClasses (interface=true supertype)
 * - Bug 3: Multiple interface inheritance: Impl misses mixin properties
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/6
 */
describe('Issue #6: Codegen bugs with complex models', () => {
  const ecorePath = path.resolve(__dirname, 'fixtures/multi-inheritance.ecore');
  const configPath = path.resolve(__dirname, 'fixtures/multi-inheritance.genconfig.xmi');

  let files: Array<{ path: string; content: string }>;

  beforeAll(async () => {
    const result = await generateInMemory({ ecorePath, configPath });
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

  function hasFile(name: string): boolean {
    return files.some(f => path.basename(f.path) === name);
  }

  describe('Bug 1: EOperation parameter/return types must be imported', () => {
    it('should import return type (Diagnostic) in DiscoveryHook interface', () => {
      const content = getFile('DiscoveryHook.ts');
      // Diagnostic is the return type of onLookup() and validate()
      expect(content).toMatch(/import\s+type\s*\{[^}]*Diagnostic[^}]*\}/);
    });

    it('should import parameter type (Capability) in DiscoveryHook interface', () => {
      const content = getFile('DiscoveryHook.ts');
      // Capability is a parameter type of onLookup() and validate()
      expect(content).toMatch(/import\s+type\s*\{[^}]*Capability[^}]*\}/);
    });

    it('should have correct operation signatures in DiscoveryHook', () => {
      const content = getFile('DiscoveryHook.ts');
      expect(content).toContain('onLookup(interfaceName: string, filter: string, capability: Capability): Diagnostic');
      expect(content).toContain('validate(capability: Capability): Diagnostic');
    });
  });

  describe('Bug 2: Abstract root EClasses and interface supertypes', () => {
    it('should NOT generate Impl for interface EClasses (NamedElement)', () => {
      // NamedElement is interface="true", so no Impl should be generated
      expect(hasFile('NamedElementImpl.ts')).toBe(false);
    });

    it('should generate Impl for abstract non-interface classes (VersionedElement)', () => {
      // VersionedElement is abstract but not interface, so Impl should be generated
      expect(hasFile('VersionedElementImpl.ts')).toBe(true);
    });

    it('should generate Impl for abstract non-interface classes (ParameterConstraint)', () => {
      expect(hasFile('ParameterConstraintImpl.ts')).toBe(true);
    });

    it('VersionedElement extends NamedElement (interface) -> Impl should use BasicEObject', () => {
      const content = getFile('VersionedElementImpl.ts');
      // NamedElement is an interface, so VersionedElementImpl should fall back to BasicEObject
      expect(content).toContain('extends BasicEObject');
      expect(content).not.toContain('extends NamedElementImpl');
    });

    it('VersionedElementImpl should include mixin name property from NamedElement', () => {
      const content = getFile('VersionedElementImpl.ts');
      // The 'name' feature from NamedElement should be generated as a mixin
      expect(content).toMatch(/get name\(\)/);
      expect(content).toMatch(/set name\(/);
      expect(content).toMatch(/private _name/);
    });

    it('ServiceComponent extends VersionedElement -> Impl should extend VersionedElementImpl', () => {
      const content = getFile('ServiceComponentImpl.ts');
      // VersionedElement is abstract but NOT interface, so ServiceComponent extends its Impl
      expect(content).toContain('extends VersionedElementImpl');
    });

    it('should export abstract Impl classes in index', () => {
      const content = getFile('index.ts');
      expect(content).toContain('VersionedElementImpl');
      expect(content).toContain('ParameterConstraintImpl');
    });
  });

  describe('Bug 3: Multiple inheritance - mixin properties', () => {
    it('ExpressionConstraint interface should extend both supertypes', () => {
      const content = getFile('ExpressionConstraint.ts');
      expect(content).toMatch(/extends\s+ParameterConstraint\s*,\s*NamedElement/);
    });

    it('ExpressionConstraintImpl should extend ParameterConstraintImpl (first non-interface supertype)', () => {
      const content = getFile('ExpressionConstraintImpl.ts');
      expect(content).toContain('extends ParameterConstraintImpl');
    });

    it('ExpressionConstraintImpl should have mixin name property from NamedElement', () => {
      const content = getFile('ExpressionConstraintImpl.ts');
      // 'name' comes from NamedElement (interface supertype, not covered by ParameterConstraintImpl)
      expect(content).toMatch(/get name\(\)/);
      expect(content).toMatch(/set name\(/);
      expect(content).toMatch(/private _name/);
    });

    it('ExpressionConstraintImpl should have own expression property', () => {
      const content = getFile('ExpressionConstraintImpl.ts');
      expect(content).toMatch(/get expression\(\)/);
      expect(content).toMatch(/set expression\(/);
    });

    it('ExpressionConstraintImpl eGet should handle mixin feature (name)', () => {
      const content = getFile('ExpressionConstraintImpl.ts');
      // The eGet switch should include a case for the mixin 'name' feature
      expect(content).toMatch(/case\s+ExpressionConstraintImpl\.NAME/);
      expect(content).toContain('return this.name');
    });

    it('ExpressionConstraintImpl eSet should handle mixin feature (name)', () => {
      const content = getFile('ExpressionConstraintImpl.ts');
      // The eSet switch should include a case for the mixin 'name' feature
      expect(content).toMatch(/this\.name\s*=\s*newValue/);
    });
  });
});
