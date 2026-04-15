import type { EOperation } from '@emfts/core';

/**
 * Generation configuration for an EOperation
 */
export interface GenOperation {
  /** Reference to the Ecore operation */
  ecoreOperation: EOperation;

  /** Generate method body (false = abstract/stub) */
  generateBody: boolean;

  /** Custom method body implementation */
  body?: string;

  /** Documentation override */
  documentation?: string;
}

/**
 * Create default GenOperation from EOperation
 */
export function createDefaultGenOperation(operation: EOperation): GenOperation {
  return {
    ecoreOperation: operation,
    generateBody: false
  };
}
