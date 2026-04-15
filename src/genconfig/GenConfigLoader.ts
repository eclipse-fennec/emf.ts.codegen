import { readFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { EPackage, EClass, EStructuralFeature, ResourceSet } from 'emfts';
import type {
  GenConfig,
  GenerationSettings,
  PackageSettings,
  ClassDefaults,
  FeatureDefaults,
  ClassOverride,
  FeatureOverride,
  GenConfigMode,
  GenConfigPropertyMode
} from './GenConfig.js';
import {
  createDefaultGenerationSettings,
  createDefaultPackageSettings,
  createDefaultClassDefaults,
  createDefaultFeatureDefaults
} from './GenConfig.js';

/**
 * Loads GenConfig from XMI files
 */
export class GenConfigLoader {
  private resourceSet: ResourceSet | null = null;
  private genconfigPackage: EPackage | null = null;
  private ecorePackages: Map<string, EPackage> = new Map();

  /**
   * Initialize the loader
   */
  async init(): Promise<void> {
    const { BasicResourceSet, getEcorePackage, ECORE_NS_URI, XMIResource, URI } = await import('emfts');

    // Initialize Ecore
    getEcorePackage();

    // Create resource set
    this.resourceSet = new BasicResourceSet();
    this.resourceSet.getPackageRegistry().set(ECORE_NS_URI, getEcorePackage());

    // Load genconfig.ecore metamodel
    const genconfigEcorePath = resolve(dirname(import.meta.url.replace('file://', '')), '../../model/genconfig.ecore');
    await this.loadGenConfigMetamodel(genconfigEcorePath);
  }

  /**
   * Load the genconfig.ecore metamodel
   */
  private async loadGenConfigMetamodel(path: string): Promise<void> {
    const { XMIResource, URI } = await import('emfts');

    const content = await readFile(path, 'utf-8');
    const uri = URI.createURI(path);
    const resource = new XMIResource(uri);
    resource.setResourceSet(this.resourceSet!);
    resource.loadFromString(content);

    const contents = resource.getContents();
    if (contents.length > 0) {
      this.genconfigPackage = contents[0] as EPackage;
      const nsURI = this.genconfigPackage.getNsURI();
      if (nsURI) {
        this.resourceSet!.getPackageRegistry().set(nsURI, this.genconfigPackage);
      }
    }
  }

  /**
   * Register an EPackage for reference resolution
   */
  registerPackage(ePackage: EPackage): void {
    const nsURI = ePackage.getNsURI();
    if (nsURI) {
      this.ecorePackages.set(nsURI, ePackage);
      if (this.resourceSet) {
        this.resourceSet.getPackageRegistry().set(nsURI, ePackage);
      }
    }
  }

  /**
   * Load a GenConfig from XMI file
   */
  async load(configPath: string): Promise<GenConfig> {
    if (!this.resourceSet) {
      await this.init();
    }

    const { XMIResource, URI } = await import('emfts');

    // Load the .genconfig.xmi file
    const content = await readFile(configPath, 'utf-8');
    const uri = URI.createURI(configPath);
    const resource = new XMIResource(uri);
    resource.setResourceSet(this.resourceSet!);
    resource.loadFromString(content);

    const contents = resource.getContents();
    if (contents.length === 0) {
      throw new Error(`No content found in ${configPath}`);
    }

    const root = contents[0];
    return this.convertToGenConfig(root);
  }

  /**
   * Convert dynamic EObject to GenConfig
   */
  private convertToGenConfig(obj: any): GenConfig {
    // Resolve ecorePackage reference
    const ecorePackageRef = this.getFeatureValue(obj, 'ecorePackage');
    let ecorePackage = this.resolvePackageReference(ecorePackageRef);

    // Fallback: if ecorePackage not specified in XMI, use the first registered package
    // (typical when the CLI provides the model via -m flag)
    if (!ecorePackage && this.ecorePackages.size > 0) {
      ecorePackage = this.ecorePackages.values().next().value ?? null;
    }

    if (!ecorePackage) {
      throw new Error('Could not resolve ecorePackage reference. Either specify ecorePackage in the GenConfig XMI or register a package via registerPackage() before loading.');
    }

    // Get generation settings
    const generationObj = this.getFeatureValue(obj, 'generation');
    const generation = this.convertGenerationSettings(generationObj);

    // Get package settings
    const packageObj = this.getFeatureValue(obj, 'package');
    const packageSettings = this.convertPackageSettings(packageObj);

    // Get class defaults (optional)
    const classDefaultsObj = this.getFeatureValue(obj, 'classDefaults');
    const classDefaults = classDefaultsObj
      ? this.convertClassDefaults(classDefaultsObj)
      : createDefaultClassDefaults();

    // Get feature defaults (optional)
    const featureDefaultsObj = this.getFeatureValue(obj, 'featureDefaults');
    const featureDefaults = featureDefaultsObj
      ? this.convertFeatureDefaults(featureDefaultsObj)
      : createDefaultFeatureDefaults(generation.mode);

    // Get class overrides (optional)
    const classOverridesObj = this.getFeatureValue(obj, 'classOverrides') || [];
    const classOverrides = this.convertClassOverrides(classOverridesObj, ecorePackage);

    return {
      ecorePackage,
      generation,
      package: packageSettings,
      classDefaults,
      featureDefaults,
      classOverrides
    };
  }

  /**
   * Convert GenerationSettings
   */
  private convertGenerationSettings(obj: any): GenerationSettings {
    if (!obj) {
      return createDefaultGenerationSettings();
    }

    const modeValue = this.getFeatureValue(obj, 'mode');
    const mode = this.convertMode(modeValue);

    return {
      mode,
      outputDir: this.getFeatureValue(obj, 'outputDir') || './generated',
      fileExtension: this.getFeatureValue(obj, 'fileExtension') || '.ts',
      headerComment: this.getFeatureValue(obj, 'headerComment')
    };
  }

  /**
   * Convert mode value (can be enum literal or string)
   */
  private convertMode(value: any): GenConfigMode {
    if (!value) return 'emf';

    // Handle enum literal object
    if (typeof value === 'object' && value !== null) {
      const literal = value.getLiteral?.() || value.literal || value.name;
      if (literal) return literal as GenConfigMode;
    }

    // Handle string
    if (typeof value === 'string') {
      return value as GenConfigMode;
    }

    // Handle number (enum ordinal)
    if (typeof value === 'number') {
      const modes: GenConfigMode[] = ['emf', 'decorator', 'plain'];
      return modes[value] || 'emf';
    }

    return 'emf';
  }

  /**
   * Convert PackageSettings
   */
  private convertPackageSettings(obj: any): PackageSettings {
    if (!obj) {
      throw new Error('Package settings are required');
    }

    return {
      prefix: this.getFeatureValue(obj, 'prefix') || '',
      basePackage: this.getFeatureValue(obj, 'basePackage'),
      generateFactory: this.getFeatureValue(obj, 'generateFactory') ?? true,
      generatePackage: this.getFeatureValue(obj, 'generatePackage') ?? true,
      generateIndex: this.getFeatureValue(obj, 'generateIndex') ?? true
    };
  }

  /**
   * Convert ClassDefaults
   */
  private convertClassDefaults(obj: any): ClassDefaults {
    return {
      generateInterface: this.getFeatureValue(obj, 'generateInterface') ?? true,
      generateImpl: this.getFeatureValue(obj, 'generateImpl') ?? true,
      rootExtendsClass: this.getFeatureValue(obj, 'rootExtendsClass') || 'BasicEObject',
      rootExtendsInterface: this.getFeatureValue(obj, 'rootExtendsInterface') || 'EObject'
    };
  }

  /**
   * Convert FeatureDefaults
   */
  private convertFeatureDefaults(obj: any): FeatureDefaults {
    const propertyValue = this.getFeatureValue(obj, 'property');
    return {
      notify: this.getFeatureValue(obj, 'notify') ?? true,
      property: this.convertPropertyMode(propertyValue)
    };
  }

  /**
   * Convert property mode value
   */
  private convertPropertyMode(value: any): GenConfigPropertyMode {
    if (!value) return 'editable';

    if (typeof value === 'object' && value !== null) {
      const literal = value.getLiteral?.() || value.literal || value.name;
      if (literal) return literal as GenConfigPropertyMode;
    }

    if (typeof value === 'string') {
      return value as GenConfigPropertyMode;
    }

    if (typeof value === 'number') {
      const modes: GenConfigPropertyMode[] = ['editable', 'readonly', 'none'];
      return modes[value] || 'editable';
    }

    return 'editable';
  }

  /**
   * Convert ClassOverrides array
   */
  private convertClassOverrides(objs: any[], ecorePackage: EPackage): ClassOverride[] {
    const overrides: ClassOverride[] = [];

    for (const obj of objs) {
      const ecoreClassRef = this.getFeatureValue(obj, 'ecoreClass');
      const ecoreClass = this.resolveClassReference(ecoreClassRef, ecorePackage);

      if (!ecoreClass) {
        console.warn(`Could not resolve ecoreClass reference: ${ecoreClassRef}`);
        continue;
      }

      const featureOverridesObj = this.getFeatureValue(obj, 'featureOverrides') || [];
      const featureOverrides = this.convertFeatureOverrides(featureOverridesObj, ecoreClass);

      overrides.push({
        ecoreClass,
        generateInterface: this.getFeatureValue(obj, 'generateInterface'),
        generateImpl: this.getFeatureValue(obj, 'generateImpl'),
        extendsClass: this.getFeatureValue(obj, 'extendsClass'),
        implementsInterfaces: this.getFeatureValue(obj, 'implementsInterfaces'),
        featureOverrides
      });
    }

    return overrides;
  }

  /**
   * Convert FeatureOverrides array
   */
  private convertFeatureOverrides(objs: any[], ecoreClass: EClass): FeatureOverride[] {
    const overrides: FeatureOverride[] = [];

    for (const obj of objs) {
      const ecoreFeatureRef = this.getFeatureValue(obj, 'ecoreFeature');
      const ecoreFeature = this.resolveFeatureReference(ecoreFeatureRef, ecoreClass);

      if (!ecoreFeature) {
        console.warn(`Could not resolve ecoreFeature reference: ${ecoreFeatureRef}`);
        continue;
      }

      const propertyValue = this.getFeatureValue(obj, 'property');

      overrides.push({
        ecoreFeature,
        notify: this.getFeatureValue(obj, 'notify'),
        property: propertyValue !== undefined ? this.convertPropertyMode(propertyValue) : undefined,
        customGetter: this.getFeatureValue(obj, 'customGetter'),
        customSetter: this.getFeatureValue(obj, 'customSetter')
      });
    }

    return overrides;
  }

  /**
   * Resolve EPackage reference from URI
   */
  private resolvePackageReference(ref: any): EPackage | null {
    if (!ref) return null;

    // If it's already an EPackage
    if (typeof ref === 'object' && 'getNsURI' in ref) {
      return ref as EPackage;
    }

    // If it's a proxy, get the URI
    if (typeof ref === 'object' && ref.eIsProxy?.()) {
      const proxyURI = ref.eProxyURI?.()?.toString?.();
      if (proxyURI) {
        return this.resolvePackageFromURI(proxyURI);
      }
    }

    // If it's a string URI
    if (typeof ref === 'string') {
      return this.resolvePackageFromURI(ref);
    }

    return null;
  }

  /**
   * Resolve EPackage from URI string
   */
  private resolvePackageFromURI(uri: string): EPackage | null {
    // Remove fragment (#/ or #//)
    const nsURI = uri.replace(/#\/?.*$/, '');

    // Look up in registered packages
    return this.ecorePackages.get(nsURI) || null;
  }

  /**
   * Resolve EClass reference from URI
   */
  private resolveClassReference(ref: any, defaultPackage: EPackage): EClass | null {
    if (!ref) return null;

    // If it's already an EClass
    if (typeof ref === 'object' && 'getEStructuralFeatures' in ref) {
      return ref as EClass;
    }

    // Get URI string
    let uri: string | null = null;

    if (typeof ref === 'object' && ref.eIsProxy?.()) {
      uri = ref.eProxyURI?.()?.toString?.();
    } else if (typeof ref === 'string') {
      uri = ref;
    }

    if (!uri) return null;

    // Parse URI: nsURI#//ClassName
    const match = uri.match(/^(.+)#\/\/(.+)$/);
    if (!match) return null;

    const [, nsURI, className] = match;
    const ePackage = this.ecorePackages.get(nsURI) || defaultPackage;

    // Find classifier by name
    const classifiers = ePackage.getEClassifiers?.() || [];
    for (const classifier of classifiers) {
      if (classifier.getName?.() === className) {
        return classifier as EClass;
      }
    }

    return null;
  }

  /**
   * Resolve EStructuralFeature reference from URI
   */
  private resolveFeatureReference(ref: any, defaultClass: EClass): EStructuralFeature | null {
    if (!ref) return null;

    // If it's already an EStructuralFeature
    if (typeof ref === 'object' && 'getEContainingClass' in ref) {
      return ref as EStructuralFeature;
    }

    // Get URI string
    let uri: string | null = null;

    if (typeof ref === 'object' && ref.eIsProxy?.()) {
      uri = ref.eProxyURI?.()?.toString?.();
    } else if (typeof ref === 'string') {
      uri = ref;
    }

    if (!uri) return null;

    // Parse URI: nsURI#//ClassName/featureName
    const match = uri.match(/^(.+)#\/\/(.+)\/(.+)$/);
    if (!match) return null;

    const [, nsURI, className, featureName] = match;

    // Find the class first
    const ePackage = this.ecorePackages.get(nsURI);
    let eClass: EClass | null = null;

    if (ePackage) {
      const classifiers = ePackage.getEClassifiers?.() || [];
      for (const classifier of classifiers) {
        if (classifier.getName?.() === className) {
          eClass = classifier as EClass;
          break;
        }
      }
    }

    if (!eClass) {
      eClass = defaultClass;
    }

    // Find feature by name
    const features = eClass.getEStructuralFeatures?.() || [];
    for (const feature of features) {
      if (feature.getName?.() === featureName) {
        return feature;
      }
    }

    // Also check inherited features
    const allFeatures = eClass.getEAllStructuralFeatures?.() || [];
    for (const feature of allFeatures) {
      if (feature.getName?.() === featureName) {
        return feature;
      }
    }

    return null;
  }

  /**
   * Get feature value from dynamic EObject
   */
  private getFeatureValue(obj: any, featureName: string): any {
    if (!obj) return undefined;

    let value: any = undefined;

    // Try direct getter
    const getterName = `get${featureName.charAt(0).toUpperCase()}${featureName.slice(1)}`;
    if (typeof obj[getterName] === 'function') {
      value = obj[getterName]();
    }
    // Try isXxx for booleans
    else {
      const isGetterName = `is${featureName.charAt(0).toUpperCase()}${featureName.slice(1)}`;
      if (typeof obj[isGetterName] === 'function') {
        value = obj[isGetterName]();
      }
      // Try eGet
      else if (typeof obj.eGet === 'function' && typeof obj.eClass === 'function') {
        const eClass = obj.eClass();
        if (eClass) {
          const feature = eClass.getEStructuralFeature?.(featureName);
          if (feature) {
            value = obj.eGet(feature);
          }
        }
      }
      // Try direct property access
      else if (featureName in obj) {
        value = obj[featureName];
      }
    }

    // Handle value conversion
    if (value === undefined || value === null) {
      return value;
    }

    // Check if it's an EList or iterable (but not string)
    if (typeof value === 'object' && typeof value[Symbol.iterator] === 'function') {
      // Check if it's meant to be a multi-valued feature
      const eClass = obj.eClass?.();
      const feature = eClass?.getEStructuralFeature?.(featureName);
      const upperBound = feature?.getUpperBound?.() ?? 1;

      if (upperBound === -1 || upperBound > 1) {
        // Multi-valued - return as array
        return Array.from(value);
      } else {
        // Single-valued but came as iterable - might be a string that got split
        // Check if all elements are single characters
        const arr = Array.from(value);
        if (arr.length > 0 && arr.every((c: any) => typeof c === 'string' && c.length === 1)) {
          // It's a string that got split into characters - join it back
          return arr.join('');
        }
        // Return first element for single-valued
        return arr[0];
      }
    }

    // Convert string "true"/"false" to boolean
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }

    return value;
  }
}
