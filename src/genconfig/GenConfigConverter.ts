import type { EPackage, EClass, EEnum, EDataType, EStructuralFeature } from '@emfts/core';
import type { GenConfig, ClassOverride, FeatureOverride } from './GenConfig.js';
import type { GenModel } from '../genmodel/GenModel.js';
import type { GenPackage } from '../genmodel/GenPackage.js';
import type { GenClass } from '../genmodel/GenClass.js';
import type { GenEnum } from '../genmodel/GenEnum.js';
import type { GenDataType } from '../genmodel/GenDataType.js';
import type { GenFeature } from '../genmodel/GenFeature.js';
import type { GenOperation } from '../genmodel/GenOperation.js';
import { GenerationMode, PropertyMode } from '../genmodel/GenerationMode.js';
import { getName } from '../util/EObjectHelper.js';

/**
 * Converts GenConfig to GenModel for the CodeGenerator
 */
export class GenConfigConverter {
  /**
   * Convert GenConfig to GenModel
   */
  convert(config: GenConfig): GenModel {
    const genPackage = this.convertPackage(config);

    return {
      // Generation settings
      generationMode: this.convertMode(config.generation.mode),
      modelDirectory: config.generation.outputDir,

      // Class defaults
      rootExtendsClass: config.classDefaults?.rootExtendsClass || 'BasicEObject',
      rootExtendsInterface: config.classDefaults?.rootExtendsInterface || 'EObject',

      // Package settings
      generateFactory: config.package.generateFactory ?? true,
      generatePackage: config.package.generatePackage ?? true,
      generateInterfaces: config.classDefaults?.generateInterface ?? true,
      generateClasses: config.classDefaults?.generateImpl ?? true,

      // Required defaults
      generateResource: false,
      boundedGenericTypeNames: false,
      usedGenPackages: [],
      featureDelegation: 'None',
      suppressEMFTypes: false,
      suppressGenModelAnnotations: false,

      // Packages
      genPackages: [genPackage]
    };
  }

  /**
   * Convert mode string to GenerationMode enum
   */
  private convertMode(mode: string): GenerationMode {
    switch (mode) {
      case 'emf':
        return GenerationMode.EMF;
      case 'decorator':
        return GenerationMode.DECORATOR;
      case 'plain':
        return GenerationMode.PLAIN;
      default:
        return GenerationMode.EMF;
    }
  }

  /**
   * Convert package
   */
  private convertPackage(config: GenConfig): GenPackage {
    const ePackage = config.ecorePackage;
    const rawClassifiers = ePackage.getEClassifiers?.() || [];
    const classifiers = Array.isArray(rawClassifiers) ? rawClassifiers : Array.from(rawClassifiers as Iterable<any>);
    const pkgName = getName(ePackage) || 'model';

    // Build override maps for quick lookup
    const classOverrideMap = new Map<EClass, ClassOverride>();
    for (const override of config.classOverrides || []) {
      classOverrideMap.set(override.ecoreClass, override);
    }

    // Convert classes, enums, and data types
    const genClasses: GenClass[] = [];
    const genEnums: GenEnum[] = [];
    const genDataTypes: GenDataType[] = [];

    for (const classifier of classifiers) {
      if (this.isEClass(classifier)) {
        const classOverride = classOverrideMap.get(classifier as EClass);
        genClasses.push(this.convertClass(classifier as EClass, config, classOverride));
      } else if (this.isEEnum(classifier)) {
        genEnums.push(this.convertEnum(classifier as EEnum));
      } else if (this.isEDataType(classifier)) {
        genDataTypes.push(this.convertDataType(classifier as EDataType));
      }
    }

    return {
      ecorePackage: ePackage,
      prefix: config.package.prefix,
      basePackage: config.package.basePackage || '',
      interfacePackageSuffix: '',
      classPackageSuffix: 'impl',
      adapterFactory: false,
      generateResourceFactory: false,
      fileExtension: pkgName.toLowerCase(),
      genClasses,
      genEnums,
      genDataTypes,
      nestedGenPackages: []
    };
  }

  /**
   * Convert class
   */
  private convertClass(eClass: EClass, config: GenConfig, override?: ClassOverride): GenClass {
    // Build feature override map
    const featureOverrideMap = new Map<EStructuralFeature, FeatureOverride>();
    if (override?.featureOverrides) {
      for (const fo of override.featureOverrides) {
        featureOverrideMap.set(fo.ecoreFeature, fo);
      }
    }

    // Convert features
    const rawFeatures = eClass.getEStructuralFeatures?.() || [];
    const features = Array.isArray(rawFeatures) ? rawFeatures : Array.from(rawFeatures as Iterable<any>);
    const genFeatures: GenFeature[] = [];

    for (const feature of features) {
      const featureOverride = featureOverrideMap.get(feature);
      genFeatures.push(this.convertFeature(feature, config, featureOverride));
    }

    // Convert operations
    const rawOperations = eClass.getEOperations?.() || [];
    const operations = Array.isArray(rawOperations) ? rawOperations : Array.from(rawOperations as Iterable<any>);
    const genOperations: GenOperation[] = operations.map(op => this.convertOperation(op));

    return {
      ecoreClass: eClass,
      generateInterface: override?.generateInterface ?? config.classDefaults?.generateInterface ?? true,
      generateImpl: override?.generateImpl ?? config.classDefaults?.generateImpl ?? true,
      dynamic: false,
      genFeatures,
      genOperations
    };
  }

  /**
   * Convert feature
   */
  private convertFeature(feature: EStructuralFeature, config: GenConfig, override?: FeatureOverride): GenFeature {
    // Determine notify - use override, then feature defaults, then mode-based default
    let notify = override?.notify;
    if (notify === undefined) {
      notify = config.featureDefaults?.notify;
    }
    if (notify === undefined) {
      notify = config.generation.mode === 'emf';
    }

    // Determine property mode
    let property = override?.property;
    if (property === undefined) {
      property = config.featureDefaults?.property;
    }
    if (property === undefined) {
      property = 'editable';
    }

    return {
      ecoreFeature: feature,
      notify,
      property: this.convertPropertyMode(property),
      children: false,
      createChild: this.isContainment(feature),
      propertySortChoices: false
    };
  }

  /**
   * Convert property mode string to PropertyMode enum
   */
  private convertPropertyMode(mode: string): PropertyMode {
    switch (mode) {
      case 'readonly':
        return PropertyMode.READONLY;
      case 'none':
        return PropertyMode.NONE;
      case 'editable':
      default:
        return PropertyMode.EDITABLE;
    }
  }

  /**
   * Convert operation
   */
  private convertOperation(op: any): GenOperation {
    return {
      ecoreOperation: op,
      generateBody: false,
      body: undefined
    };
  }

  /**
   * Convert enum
   */
  private convertEnum(eEnum: EEnum): GenEnum {
    return {
      ecoreEnum: eEnum,
      useStringValues: false,
      generateAsConst: false
    };
  }

  /**
   * Convert data type
   */
  private convertDataType(dataType: EDataType): GenDataType {
    const typeName = getName(dataType) || 'any';
    return {
      ecoreDataType: dataType,
      tsType: this.mapDefaultTsType(typeName)
    };
  }

  /**
   * Map Ecore type name to TypeScript type
   */
  private mapDefaultTsType(typeName: string): string {
    switch (typeName) {
      case 'EString':
      case 'EChar':
      case 'ECharacterObject':
        return 'string';
      case 'EBoolean':
      case 'EBooleanObject':
        return 'boolean';
      case 'EInt':
      case 'EIntegerObject':
      case 'EByte':
      case 'EByteObject':
      case 'ELong':
      case 'ELongObject':
      case 'EShort':
      case 'EShortObject':
      case 'EFloat':
      case 'EFloatObject':
      case 'EDouble':
      case 'EDoubleObject':
      case 'EBigInteger':
      case 'EBigDecimal':
        return 'number';
      case 'EDate':
        return 'Date';
      case 'EJavaObject':
      case 'EJavaClass':
        return 'any';
      default:
        return typeName;
    }
  }

  /**
   * Check if classifier is an EClass
   */
  private isEClass(classifier: any): classifier is EClass {
    // Check for static interface
    if ('getEStructuralFeatures' in classifier) return true;

    // Check for dynamic object
    const eClass = classifier.eClass?.();
    const eClassName = eClass?.getName?.();
    return eClassName === 'EClass';
  }

  /**
   * Check if classifier is an EEnum
   */
  private isEEnum(classifier: any): classifier is EEnum {
    // Check for static interface
    if ('getELiterals' in classifier) return true;

    // Check for dynamic object
    const eClass = classifier.eClass?.();
    const eClassName = eClass?.getName?.();
    return eClassName === 'EEnum';
  }

  /**
   * Check if classifier is an EDataType (but not EEnum)
   */
  private isEDataType(classifier: any): classifier is EDataType {
    if (this.isEEnum(classifier)) return false;

    // Check for static interface
    if ('isSerializable' in classifier) return true;

    // Check for dynamic object
    const eClass = classifier.eClass?.();
    const eClassName = eClass?.getName?.();
    return eClassName === 'EDataType';
  }

  /**
   * Check if feature is containment
   */
  private isContainment(feature: EStructuralFeature): boolean {
    if ('isContainment' in feature && typeof (feature as any).isContainment === 'function') {
      return (feature as any).isContainment();
    }

    // Dynamic object
    if (typeof feature.eGet === 'function' && typeof feature.eClass === 'function') {
      const eClass = feature.eClass();
      if (eClass) {
        const containmentFeature = eClass.getEStructuralFeature?.('containment');
        if (containmentFeature) {
          return feature.eGet(containmentFeature) === true;
        }
      }
    }

    return false;
  }
}
