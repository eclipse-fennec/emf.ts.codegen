import type { EEnum } from 'emfts';

/**
 * Generation configuration for an EEnum
 */
export interface GenEnum {
  /** Reference to the Ecore enum */
  ecoreEnum: EEnum;

  /** Use string values instead of numeric */
  useStringValues: boolean;

  /** Generate as const object instead of enum */
  generateAsConst: boolean;

  /** Documentation override */
  documentation?: string;
}

/**
 * Generation configuration for an EEnumLiteral
 */
export interface GenEnumLiteral {
  /** Literal name */
  name: string;

  /** Custom value override */
  value?: string | number;

  /** Documentation override */
  documentation?: string;
}

/**
 * Create default GenEnum from EEnum
 */
export function createDefaultGenEnum(eEnum: EEnum): GenEnum {
  return {
    ecoreEnum: eEnum,
    useStringValues: true,
    generateAsConst: false
  };
}
