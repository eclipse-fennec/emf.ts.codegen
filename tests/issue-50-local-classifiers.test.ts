import { describe, it, expect, beforeAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * Tests for GitHub issue #50 (follow-up to #37):
 * local EEnums and EDataTypes were never created in the generated package -
 * no Literals entry, nothing in getEClassifiers(), and attributes typed by
 * them ended up with no eType at all, so XMI readers got no EDataType to
 * convert enum values against and reflective consumers could not tell an
 * enum from free text.
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/50
 */
describe('Issue #50: local EEnums and EDataTypes as package metadata', () => {
  let pkg: string;

  beforeAll(async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-50-'));
    try {
      const configPath = path.join(tmpDir, 'model.genconfig.xmi');
      await writeFile(configPath, generateGenConfigXMI(
        'http://example.org/uimodel', 'emf', './generated', 'Uimodel', 'org.example'
      ), 'utf-8');
      const result = await generateInMemory({
        ecorePath: path.resolve(__dirname, 'fixtures/local-classifiers.ecore'),
        configPath
      });
      expect(result.success).toBe(true);
      const file = result.files.find(f => path.basename(f.path) === 'UimodelPackage.ts');
      if (!file) throw new Error('UimodelPackage.ts not found');
      pkg = file.content;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('should create the local EEnum with its literals, name, value and literal string', () => {
    expect(pkg).toContain('const layoutTypeEnumType = new BasicEEnum();');
    expect(pkg).toContain("layoutTypeEnumType.setName('LayoutType');");
    expect(pkg).toContain('literal.setName("GRID");');
    expect(pkg).toContain('literal.setLiteral("grid");');
    expect(pkg).toContain('literal.setValue(2);');
    expect(pkg).toContain('layoutTypeEnumType.addLiteral(literal);');
  });

  it('should set the generated string constant as the literal instance (#53)', () => {
    // createFromString then returns the value the generated type declares
    expect(pkg).toContain("import { LayoutType } from './LayoutType.js';");
    expect(pkg).toContain('literal.setInstance(LayoutType.GRID);');
  });

  it('should assign the Literals entry and register the enum as classifier', () => {
    expect(pkg).toContain('LAYOUT_TYPE: null as unknown as EEnum,');
    expect(pkg).toContain('UimodelPackage.Literals.LAYOUT_TYPE = layoutTypeEnumType;');
    expect(pkg).toContain('this.getEClassifiers().push(layoutTypeEnumType);');
  });

  it('should create the local EDataType with instanceClassName and its annotations', () => {
    expect(pkg).toContain('const localizedEStringDataType = new BasicEDataType();');
    expect(pkg).toContain('localizedEStringDataType.setInstanceClassName("java.lang.String");');
    expect(pkg).toContain('annotation.setSource("http:///org/eclipse/emf/ecore/util/ExtendedMetaData");');
    expect(pkg).toContain('annotation.getDetails().putByKey("baseType", "http://www.eclipse.org/emf/2002/Ecore#EString");');
    expect(pkg).toContain('localizedEStringDataType.getEAnnotations().push(annotation);');
    expect(pkg).toContain('this.getEClassifiers().push(localizedEStringDataType);');
  });

  it('should set the eType of attributes typed by local classifiers', () => {
    expect(pkg).toContain(
      '(UimodelPackage.Literals.LAYOUT_STYLE__LAYOUT as BasicEAttribute).setEType(UimodelPackage.Literals.LAYOUT_TYPE);'
    );
    expect(pkg).toContain(
      '(UimodelPackage.Literals.LAYOUT_STYLE__LABEL as BasicEAttribute).setEType(UimodelPackage.Literals.LOCALIZED_E_STRING);'
    );
  });
});
