import type { EStructuralFeature } from 'emfts';
import { PropertyMode } from './GenerationMode.js';

/**
 * Generation configuration for an EStructuralFeature (EAttribute or EReference)
 */
export interface GenFeature {
  /** Reference to the Ecore feature */
  ecoreFeature: EStructuralFeature;

  /** Property access mode */
  property: PropertyMode;

  /** Generate notification on change (EMF mode) */
  notify: boolean;

  /** Include in children/contents (for references) */
  children: boolean;

  /** Create child instances automatically */
  createChild: boolean;

  /** Sort property choices in editor */
  propertySortChoices: boolean;

  /** Custom getter name override */
  getterName?: string;

  /** Custom setter name override */
  setterName?: string;

  /** Documentation override */
  documentation?: string;
}

/**
 * Create default GenFeature from EStructuralFeature
 */
export function createDefaultGenFeature(feature: EStructuralFeature): GenFeature {
  return {
    ecoreFeature: feature,
    property: PropertyMode.EDITABLE,
    notify: true,
    children: false,
    createChild: false,
    propertySortChoices: false
  };
}
