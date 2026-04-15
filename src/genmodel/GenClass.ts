import type { EClass } from 'emfts';
import type { GenFeature } from './GenFeature.js';
import type { GenOperation } from './GenOperation.js';

/**
 * Generation configuration for an EClass
 */
export interface GenClass {
  /** Reference to the Ecore class */
  ecoreClass: EClass;

  /** Generate interface file */
  generateInterface: boolean;

  /** Generate implementation class file */
  generateImpl: boolean;

  /** Use DynamicEObject instead of generated class (EMF mode) */
  dynamic: boolean;

  /** Custom implementation class name */
  implClassName?: string;

  /** Custom interface name */
  interfaceName?: string;

  /** Feature used for label in editors */
  labelFeature?: GenFeature;

  /** Base class override (for custom inheritance) */
  baseClass?: string;

  /** Features to generate */
  genFeatures: GenFeature[];

  /** Operations to generate */
  genOperations: GenOperation[];

  /** Documentation override */
  documentation?: string;

  /** Image path for editors */
  image?: string;
}

/**
 * Create default GenClass from EClass
 */
export function createDefaultGenClass(eClass: EClass): GenClass {
  return {
    ecoreClass: eClass,
    generateInterface: true,
    generateImpl: true,
    dynamic: false,
    genFeatures: [],
    genOperations: []
  };
}
