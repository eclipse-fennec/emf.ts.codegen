import type { GenPackage } from './GenPackage.js';
import { GenerationMode } from './GenerationMode.js';

/**
 * Root generation model configuration
 */
export interface GenModel {
  /** Output directory for generated model code */
  modelDirectory: string;

  /** Output directory for edit code (optional) */
  editDirectory?: string;

  /** Output directory for editor code (optional) */
  editorDirectory?: string;

  /** Plugin ID for generated code */
  modelPluginID?: string;

  /** Generation mode (PLAIN, DECORATOR, or EMF) */
  generationMode: GenerationMode;

  /** Generate interface files */
  generateInterfaces: boolean;

  /** Generate implementation classes */
  generateClasses: boolean;

  /** Generate factory classes */
  generateFactory: boolean;

  /** Generate package classes (EMF mode) */
  generatePackage: boolean;

  /** Generate resource implementation */
  generateResource: boolean;

  /** Use bounded wildcards in generic types */
  boundedGenericTypeNames: boolean;

  /** File header comment */
  copyrightText?: string;

  /** Packages to generate */
  genPackages: GenPackage[];

  /** Referenced packages (for cross-references) */
  usedGenPackages: GenPackage[];

  /** Custom import manager class */
  importManager?: string;

  /** Feature delegation mode */
  featureDelegation: 'None' | 'Virtual' | 'Reflective';

  /** Root extends class (EMF mode) */
  rootExtendsClass: string;

  /** Root extends interface (EMF mode) */
  rootExtendsInterface: string;

  /** Root implements interface */
  rootImplementsInterface?: string;

  /** Suppress EMF types in generated code */
  suppressEMFTypes: boolean;

  /** Suppress generation of genmodel file */
  suppressGenModelAnnotations: boolean;
}

/**
 * Create default GenModel
 */
export function createDefaultGenModel(): GenModel {
  return {
    modelDirectory: './generated',
    generationMode: GenerationMode.DECORATOR,
    generateInterfaces: true,
    generateClasses: true,
    generateFactory: true,
    generatePackage: true,
    generateResource: false,
    boundedGenericTypeNames: false,
    genPackages: [],
    usedGenPackages: [],
    featureDelegation: 'None',
    rootExtendsClass: 'BasicEObject',
    rootExtendsInterface: 'EObject',
    suppressEMFTypes: false,
    suppressGenModelAnnotations: false
  };
}
