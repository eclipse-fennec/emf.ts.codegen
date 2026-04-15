import type { EPackage, EClass, EStructuralFeature } from 'emfts';

/**
 * Generation mode for code output
 */
export type GenConfigMode = 'emf' | 'decorator' | 'plain';

/**
 * Property access mode for generated features
 */
export type GenConfigPropertyMode = 'editable' | 'readonly' | 'none';

/**
 * Root configuration for TypeScript code generation
 */
export interface GenConfig {
  /** Reference to the EPackage to generate code for */
  ecorePackage: EPackage;

  /** Generation settings */
  generation: GenerationSettings;

  /** Package settings */
  package: PackageSettings;

  /** Default settings for all classes */
  classDefaults?: ClassDefaults;

  /** Default settings for all features */
  featureDefaults?: FeatureDefaults;

  /** Per-class overrides */
  classOverrides?: ClassOverride[];
}

/**
 * Settings controlling how code is generated
 */
export interface GenerationSettings {
  /** Generation mode: emf, decorator, or plain */
  mode: GenConfigMode;

  /** Output directory for generated files */
  outputDir: string;

  /** File extension (default: .ts) */
  fileExtension?: string;

  /** Custom header comment */
  headerComment?: string;
}

/**
 * Settings for package structure and artifacts
 */
export interface PackageSettings {
  /** Prefix for Package/Factory classes (e.g. 'Library' -> LibraryPackage) */
  prefix: string;

  /** Base package path (e.g. 'org.example' -> org/example/) */
  basePackage?: string;

  /** Generate factory class (default: true) */
  generateFactory?: boolean;

  /** Generate package class (default: true) */
  generatePackage?: boolean;

  /** Generate index.ts barrel file (default: true) */
  generateIndex?: boolean;
}

/**
 * Default settings for all generated classes
 */
export interface ClassDefaults {
  /** Generate interface for each class (default: true) */
  generateInterface?: boolean;

  /** Generate implementation class (default: true) */
  generateImpl?: boolean;

  /** Root class to extend (default: BasicEObject) */
  rootExtendsClass?: string;

  /** Root interface to implement (default: EObject) */
  rootExtendsInterface?: string;
}

/**
 * Default settings for all generated features
 */
export interface FeatureDefaults {
  /** Generate notification in setters (default: true for EMF mode) */
  notify?: boolean;

  /** Property access mode (default: editable) */
  property?: GenConfigPropertyMode;
}

/**
 * Override settings for a specific EClass
 */
export interface ClassOverride {
  /** Reference to the EClass */
  ecoreClass: EClass;

  /** Override: generate interface */
  generateInterface?: boolean;

  /** Override: generate implementation */
  generateImpl?: boolean;

  /** Custom extends class */
  extendsClass?: string;

  /** Additional interfaces to implement */
  implementsInterfaces?: string[];

  /** Per-feature overrides */
  featureOverrides?: FeatureOverride[];
}

/**
 * Override settings for a specific EStructuralFeature
 */
export interface FeatureOverride {
  /** Reference to the EStructuralFeature */
  ecoreFeature: EStructuralFeature;

  /** Override: generate notification */
  notify?: boolean;

  /** Override: property access mode */
  property?: GenConfigPropertyMode;

  /** Custom getter body */
  customGetter?: string;

  /** Custom setter body */
  customSetter?: string;
}

/**
 * Create default generation settings
 */
export function createDefaultGenerationSettings(partial?: Partial<GenerationSettings>): GenerationSettings {
  return {
    mode: 'emf',
    outputDir: './generated',
    fileExtension: '.ts',
    ...partial
  };
}

/**
 * Create default package settings
 */
export function createDefaultPackageSettings(prefix: string, partial?: Partial<PackageSettings>): PackageSettings {
  return {
    prefix,
    generateFactory: true,
    generatePackage: true,
    generateIndex: true,
    ...partial
  };
}

/**
 * Create default class defaults
 */
export function createDefaultClassDefaults(partial?: Partial<ClassDefaults>): ClassDefaults {
  return {
    generateInterface: true,
    generateImpl: true,
    rootExtendsClass: 'BasicEObject',
    rootExtendsInterface: 'EObject',
    ...partial
  };
}

/**
 * Create default feature defaults
 */
export function createDefaultFeatureDefaults(mode: GenConfigMode, partial?: Partial<FeatureDefaults>): FeatureDefaults {
  return {
    notify: mode === 'emf',
    property: 'editable',
    ...partial
  };
}
