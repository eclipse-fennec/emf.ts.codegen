import type { EPackage } from '@emfts/core';
import type { GenClass } from './GenClass.js';
import type { GenEnum } from './GenEnum.js';
import type { GenDataType } from './GenDataType.js';
import { getName } from '../util/EObjectHelper.js';

/**
 * Generation configuration for an EPackage
 */
export interface GenPackage {
  /** Reference to the Ecore package */
  ecorePackage: EPackage;

  /** Prefix for generated class names (e.g., "Person" -> "PersonImpl") */
  prefix: string;

  /** Base package path for imports (e.g., "com.example.model") */
  basePackage: string;

  /** Suffix for interface package */
  interfacePackageSuffix: string;

  /** Suffix for implementation package */
  classPackageSuffix: string;

  /** Generate adapter factory */
  adapterFactory: boolean;

  /** Generate resource factory */
  generateResourceFactory: boolean;

  /** File extension for resources */
  fileExtension: string;

  /** Content type identifier */
  contentTypeIdentifier?: string;

  /** Classes to generate */
  genClasses: GenClass[];

  /** Enums to generate */
  genEnums: GenEnum[];

  /** Data types to generate */
  genDataTypes: GenDataType[];

  /** Nested packages */
  nestedGenPackages: GenPackage[];

  /** Documentation override */
  documentation?: string;
}

/**
 * Create default GenPackage from EPackage
 */
export function createDefaultGenPackage(ePackage: EPackage): GenPackage {
  const name = getName(ePackage) ?? 'model';
  return {
    ecorePackage: ePackage,
    prefix: capitalize(name),
    basePackage: '',
    interfacePackageSuffix: '',
    classPackageSuffix: 'impl',
    adapterFactory: false,
    generateResourceFactory: false,
    fileExtension: name.toLowerCase(),
    genClasses: [],
    genEnums: [],
    genDataTypes: [],
    nestedGenPackages: []
  };
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
