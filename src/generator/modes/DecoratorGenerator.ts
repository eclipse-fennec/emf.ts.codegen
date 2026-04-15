import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { GenPackage } from '../../genmodel/GenPackage.js';
import type { GenClass } from '../../genmodel/GenClass.js';
import type { GenEnum } from '../../genmodel/GenEnum.js';
import { BaseGenerator } from './BaseGenerator.js';
import { GeneratedFile } from '../GeneratedFile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generator for decorator-based TypeScript classes
 */
export class DecoratorGenerator extends BaseGenerator {
  protected getTemplateDir(): string {
    return join(__dirname, '../../templates/partials/decorator');
  }

  async generateClass(genClass: GenClass, genPackage: GenPackage): Promise<GeneratedFile> {
    this.context.setCurrentPackage(genPackage);
    this.context.setCurrentClass(genClass);

    const eClass = genClass.ecoreClass;
    const className = genClass.implClassName ?? eClass.getName() ?? 'Unknown';
    const nsURI = genPackage.ecorePackage.getNsURI() ?? '';

    const content = await this.render('class-file', {
      genClass,
      genPackage,
      eClass,
      className,
      nsURI,
      isAbstract: eClass.isAbstract(),
      superTypes: eClass.getESuperTypes(),
      features: genClass.genFeatures,
      operations: genClass.genOperations,
      typeParameters: eClass.getETypeParameters()
    });

    const path = this.getClassPath(genClass, genPackage);
    return this.createFile(path, content);
  }

  async generateInterface(genClass: GenClass, genPackage: GenPackage): Promise<GeneratedFile> {
    this.context.setCurrentPackage(genPackage);
    this.context.setCurrentClass(genClass);

    const eClass = genClass.ecoreClass;
    const interfaceName = genClass.interfaceName ?? eClass.getName() ?? 'Unknown';

    const content = await this.render('interface-file', {
      genClass,
      genPackage,
      eClass,
      interfaceName,
      superTypes: eClass.getESuperTypes(),
      features: genClass.genFeatures,
      operations: genClass.genOperations,
      typeParameters: eClass.getETypeParameters()
    });

    const path = this.getInterfacePath(genClass, genPackage);
    return this.createFile(path, content);
  }

  async generateEnum(genEnum: GenEnum, genPackage: GenPackage): Promise<GeneratedFile> {
    this.context.setCurrentPackage(genPackage);

    const eEnum = genEnum.ecoreEnum;
    const enumName = this.getEnumName(eEnum);
    const literals = this.getEnumLiterals(eEnum);

    const content = await this.render('enum-file', {
      genEnum,
      genPackage,
      eEnum,
      enumName,
      literals,
      useStringValues: genEnum.useStringValues
    });

    const path = this.getEnumPath(genEnum, genPackage);
    return this.createFile(path, content);
  }

  /**
   * Get enum name, handling both proper EEnum instances and dynamically loaded objects
   */
  private getEnumName(eEnum: any): string {
    if (typeof eEnum.getName === 'function') {
      return eEnum.getName() ?? 'Unknown';
    }
    if (eEnum.name !== undefined) {
      return eEnum.name;
    }
    // Try eGet
    if (typeof eEnum.eGet === 'function' && typeof eEnum.eClass === 'function') {
      const eClass = eEnum.eClass();
      const feature = eClass?.getEStructuralFeature?.('name');
      if (feature) {
        return eEnum.eGet(feature) ?? 'Unknown';
      }
    }
    return 'Unknown';
  }

  /**
   * Get enum literals, handling both proper EEnum instances and dynamically loaded objects
   */
  private getEnumLiterals(eEnum: any): any[] {
    if (typeof eEnum.getELiterals === 'function') {
      return eEnum.getELiterals();
    }
    if (Array.isArray(eEnum.eLiterals)) {
      return eEnum.eLiterals;
    }
    // Try eGet
    if (typeof eEnum.eGet === 'function' && typeof eEnum.eClass === 'function') {
      const eClass = eEnum.eClass();
      const feature = eClass?.getEStructuralFeature?.('eLiterals');
      if (feature) {
        const result = eEnum.eGet(feature);
        return Array.isArray(result) ? result : [];
      }
    }
    return [];
  }

  async generatePackageFile(genPackage: GenPackage): Promise<GeneratedFile> {
    this.context.setCurrentPackage(genPackage);

    const ePackage = genPackage.ecorePackage;
    const packageName = genPackage.prefix ?? ePackage.getName() ?? 'Model';

    // Collect all exports
    const exports: string[] = [];

    for (const genClass of genPackage.genClasses) {
      const name = genClass.ecoreClass.getName();
      if (name) {
        exports.push(name);
      }
    }

    for (const genEnum of genPackage.genEnums) {
      const name = this.getEnumName(genEnum.ecoreEnum);
      if (name && name !== 'Unknown') {
        exports.push(name);
      }
    }

    const content = await this.render('package-file', {
      genPackage,
      ePackage,
      packageName,
      exports
    });

    const packagePath = this.getPackagePath(genPackage);
    return this.createFile(join(packagePath, 'index.ts'), content);
  }

  /**
   * Generate ModelAnnotations file
   */
  async generateModelAnnotations(genPackage: GenPackage): Promise<GeneratedFile> {
    const content = await this.render('model-annotations', {
      genPackage
    });

    const packagePath = this.getPackagePath(genPackage);
    return this.createFile(join(packagePath, 'ModelAnnotations.ts'), content);
  }
}
