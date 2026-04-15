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
 * Generator for plain TypeScript classes (POJOs)
 */
export class PlainGenerator extends BaseGenerator {
  protected getTemplateDir(): string {
    return join(__dirname, '../../templates/partials/plain');
  }

  async generateClass(genClass: GenClass, genPackage: GenPackage): Promise<GeneratedFile> {
    this.context.setCurrentPackage(genPackage);
    this.context.setCurrentClass(genClass);

    const eClass = genClass.ecoreClass;
    const className = genClass.implClassName ?? eClass.getName() ?? 'Unknown';

    const content = await this.render('class-file', {
      genClass,
      genPackage,
      eClass,
      className,
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
    const enumName = eEnum.getName() ?? 'Unknown';
    const literals = eEnum.getELiterals();

    const content = await this.render('enum-file', {
      genEnum,
      genPackage,
      eEnum,
      enumName,
      literals,
      useStringValues: genEnum.useStringValues,
      generateAsConst: genEnum.generateAsConst
    });

    const path = this.getEnumPath(genEnum, genPackage);
    return this.createFile(path, content);
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
      const name = genEnum.ecoreEnum.getName();
      if (name) {
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
}
