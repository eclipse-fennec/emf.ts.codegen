import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { GenPackage } from '../../genmodel/GenPackage.js';
import type { GenClass } from '../../genmodel/GenClass.js';
import type { GenEnum } from '../../genmodel/GenEnum.js';
import { BaseGenerator } from './BaseGenerator.js';
import { GeneratedFile } from '../GeneratedFile.js';
import * as EObjectHelper from '../../util/EObjectHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generator for EMF-conformant TypeScript classes
 */
export class EmfGenerator extends BaseGenerator {
  constructor(context: import('../GeneratorContext.js').GeneratorContext) {
    super(context);
    context.typeMapper.useEList = true;
  }

  protected getTemplateDir(): string {
    return join(__dirname, '../../templates/partials/emf');
  }

  async generateClass(genClass: GenClass, genPackage: GenPackage): Promise<GeneratedFile> {
    this.context.setCurrentPackage(genPackage);
    this.context.setCurrentClass(genClass);

    const eClass = genClass.ecoreClass;
    const className = genClass.implClassName ?? `${EObjectHelper.getName(eClass)}Impl`;
    const interfaceName = genClass.interfaceName ?? EObjectHelper.getName(eClass) ?? 'Unknown';
    const nsURI = genPackage.ecorePackage.getNsURI() ?? '';
    const packagePrefix = genPackage.prefix;

    const isAbstractValue = EObjectHelper.isAbstract(eClass);
    const superTypes = EObjectHelper.getESuperTypes(eClass);

    // Determine the extends class - use first non-interface supertype's impl or rootExtendsClass
    let extendsClass = this.context.genModel.rootExtendsClass;
    let extendsImport: string | null = null;
    let primarySuperType: any = null;

    const currentNsURI = genPackage.ecorePackage.getNsURI();
    for (const st of superTypes) {
      if (!EObjectHelper.isInterface(st)) {
        primarySuperType = st;
        const superTypeName = EObjectHelper.getName(st);
        if (superTypeName) {
          extendsClass = `${superTypeName}Impl`;
          // Check if supertype is from a different package
          const stPackage = EObjectHelper.getEPackage(st);
          const stNsURI = stPackage?.getNsURI?.();
          if (stNsURI && stNsURI !== currentNsURI) {
            // Cross-package: import Impl directly from its file, not via index
            const registeredPath = this.context.importResolver.getRegisteredPath(stNsURI);
            if (registeredPath) {
              extendsImport = `${registeredPath}/${extendsClass}`;
            } else {
              extendsImport = `./${extendsClass}`;
            }
          } else {
            extendsImport = `./${extendsClass}`;
          }
        }
        break;
      }
    }

    // Calculate inherited feature count for feature ID offset
    const countInheritedFeatures = (cls: any): number => {
      let count = 0;
      for (const st of EObjectHelper.getESuperTypes(cls)) {
        count += EObjectHelper.getEStructuralFeatures(st).length;
        count += countInheritedFeatures(st);
      }
      return count;
    };
    const inheritedFeatureCount = countInheritedFeatures(eClass);

    // Generate feature IDs (eLiterals) - offset by inherited feature count
    const featureIds: Array<{ name: string; id: number; feature: any }> = [];
    let featureId = inheritedFeatureCount;
    for (const genFeature of genClass.genFeatures) {
      const featureName = EObjectHelper.getName(genFeature.ecoreFeature) ?? 'unknown';
      featureIds.push({
        name: this.toUpperSnake(featureName),
        id: featureId++,
        feature: genFeature
      });
    }

    // Collect mixin features from non-primary supertypes (Bug 3: multiple inheritance)
    const mixinFeatures = this.collectMixinFeatures(eClass, primarySuperType);

    // Resolve additional imports for mixin feature types
    const mixinImports = this.context.importResolver.resolveImportsForFeatures(
      mixinFeatures.map(mf => mf.feature),
      eClass,
      genPackage
    );

    const content = await this.render('class-file', {
      genClass,
      genPackage,
      eClass,
      className,
      interfaceName,
      nsURI,
      packagePrefix,
      isAbstract: isAbstractValue,
      superTypes,
      extendsClass,
      extendsImport,
      features: genClass.genFeatures,
      featureIds,
      mixinFeatures,
      mixinImports,
      operations: genClass.genOperations,
      typeParameters: EObjectHelper.getETypeParameters(eClass),
      rootExtendsClass: this.context.genModel.rootExtendsClass
    });

    const path = this.getClassPath(genClass, genPackage, 'Impl');
    return this.createFile(path, content);
  }

  async generateInterface(genClass: GenClass, genPackage: GenPackage): Promise<GeneratedFile> {
    this.context.setCurrentPackage(genPackage);
    this.context.setCurrentClass(genClass);

    const eClass = genClass.ecoreClass;
    const interfaceName = genClass.interfaceName ?? EObjectHelper.getName(eClass) ?? 'Unknown';

    const content = await this.render('interface-file', {
      genClass,
      genPackage,
      eClass,
      interfaceName,
      superTypes: EObjectHelper.getESuperTypes(eClass),
      features: genClass.genFeatures,
      operations: genClass.genOperations,
      typeParameters: EObjectHelper.getETypeParameters(eClass),
      rootExtendsInterface: this.context.genModel.rootExtendsInterface
    });

    const path = this.getInterfacePath(genClass, genPackage);
    return this.createFile(path, content);
  }

  async generateEnum(genEnum: GenEnum, genPackage: GenPackage): Promise<GeneratedFile> {
    this.context.setCurrentPackage(genPackage);

    const eEnum = genEnum.ecoreEnum;
    const enumName = EObjectHelper.getName(eEnum) ?? 'Unknown';
    const literals = EObjectHelper.getELiterals(eEnum);

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

  async generatePackageFile(genPackage: GenPackage): Promise<GeneratedFile> {
    this.context.setCurrentPackage(genPackage);

    const ePackage = genPackage.ecorePackage;
    const packageName = genPackage.prefix ?? EObjectHelper.getName(ePackage) ?? 'Model';
    const nsURI = ePackage.getNsURI() ?? '';
    const nsPrefix = ePackage.getNsPrefix() ?? packageName.toLowerCase();

    // Collect class literals
    const classLiterals: Array<{
      className: string;
      upperName: string;
      features: Array<{ name: string; upperName: string }>
    }> = [];

    for (const genClass of genPackage.genClasses) {
      const className = EObjectHelper.getName(genClass.ecoreClass) ?? 'Unknown';
      const features = genClass.genFeatures.map(f => ({
        name: EObjectHelper.getName(f.ecoreFeature) ?? 'unknown',
        upperName: this.toUpperSnake(EObjectHelper.getName(f.ecoreFeature) ?? 'unknown')
      }));

      classLiterals.push({
        className,
        upperName: this.toUpperSnake(className),
        features
      });
    }

    const content = await this.render('package-file', {
      genPackage,
      ePackage,
      packageName,
      nsURI,
      nsPrefix,
      classLiterals,
      genClasses: genPackage.genClasses,
      genEnums: genPackage.genEnums
    });

    const packagePath = this.getPackagePath(genPackage);
    return this.createFile(join(packagePath, `${packageName}Package.ts`), content);
  }

  async generateFactory(genPackage: GenPackage): Promise<GeneratedFile | null> {
    this.context.setCurrentPackage(genPackage);

    const ePackage = genPackage.ecorePackage;
    const packageName = genPackage.prefix ?? EObjectHelper.getName(ePackage) ?? 'Model';

    // Filter non-abstract classes
    const concreteClasses = genPackage.genClasses.filter(
      gc => !EObjectHelper.isAbstract(gc.ecoreClass) && !EObjectHelper.isInterface(gc.ecoreClass)
    );

    const content = await this.render('factory-file', {
      genPackage,
      ePackage,
      packageName,
      concreteClasses
    });

    const packagePath = this.getPackagePath(genPackage);
    return this.createFile(join(packagePath, `${packageName}Factory.ts`), content);
  }

  /**
   * Generate barrel index file
   */
  async generateIndex(genPackage: GenPackage): Promise<GeneratedFile> {
    const ePackage = genPackage.ecorePackage;
    const packageName = genPackage.prefix ?? EObjectHelper.getName(ePackage) ?? 'Model';

    const exports: string[] = [];

    // Export interfaces
    for (const genClass of genPackage.genClasses) {
      const name = EObjectHelper.getName(genClass.ecoreClass);
      if (name) {
        exports.push(name);
      }
    }

    // Export implementations (including abstract classes, as they're extended by subclasses)
    for (const genClass of genPackage.genClasses) {
      if (!EObjectHelper.isInterface(genClass.ecoreClass)) {
        const implName = genClass.implClassName ?? `${EObjectHelper.getName(genClass.ecoreClass)}Impl`;
        exports.push(implName);
      }
    }

    // Export enums
    for (const genEnum of genPackage.genEnums) {
      const name = EObjectHelper.getName(genEnum.ecoreEnum);
      if (name) {
        exports.push(name);
      }
    }

    const content = await this.render('index-file', {
      genPackage,
      packageName,
      exports,
      genClasses: genPackage.genClasses,
      genEnums: genPackage.genEnums
    });

    const packagePath = this.getPackagePath(genPackage);
    return this.createFile(join(packagePath, 'index.ts'), content);
  }

  /**
   * Collect features from non-primary supertypes that need to be generated as mixins.
   * These are features inherited from interface supertypes or non-first supertypes
   * that aren't covered by the primary extends chain.
   */
  private collectMixinFeatures(eClass: any, primarySuperType: any): Array<{ name: string; upperName: string; id: number; feature: any }> {
    // Collect all feature names from the primary extends chain
    const primaryChainFeatureNames = new Set<string>();
    if (primarySuperType) {
      this.collectAllFeatureNames(primarySuperType, primaryChainFeatureNames);
    }

    // Collect all inherited features in order (matching countInheritedFeatures traversal)
    const allInherited = this.collectAllInheritedFeaturesOrdered(eClass);

    // Mixin features = inherited features not covered by primary chain
    const mixinFeatures: Array<{ name: string; upperName: string; id: number; feature: any }> = [];
    const seen = new Set<string>();
    for (let i = 0; i < allInherited.length; i++) {
      const featureName = EObjectHelper.getName(allInherited[i]);
      if (featureName && !primaryChainFeatureNames.has(featureName) && !seen.has(featureName)) {
        seen.add(featureName);
        mixinFeatures.push({
          name: featureName,
          upperName: this.toUpperSnake(featureName),
          id: i,
          feature: allInherited[i]
        });
      }
    }

    return mixinFeatures;
  }

  /**
   * Recursively collect all feature names from a class and its supertypes
   */
  private collectAllFeatureNames(cls: any, names: Set<string>): void {
    for (const f of EObjectHelper.getEStructuralFeatures(cls)) {
      const name = EObjectHelper.getName(f);
      if (name) names.add(name);
    }
    for (const st of EObjectHelper.getESuperTypes(cls)) {
      this.collectAllFeatureNames(st, names);
    }
  }

  /**
   * Collect all inherited features in order (matching the traversal used by countInheritedFeatures)
   */
  private collectAllInheritedFeaturesOrdered(cls: any): any[] {
    const features: any[] = [];
    for (const st of EObjectHelper.getESuperTypes(cls)) {
      features.push(...this.collectAllInheritedFeaturesOrdered(st));
      features.push(...EObjectHelper.getEStructuralFeatures(st));
    }
    return features;
  }

  private toUpperSnake(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  }
}
