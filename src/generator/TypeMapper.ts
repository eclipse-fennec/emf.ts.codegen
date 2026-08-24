import type { EClassifier, EDataType, EClass, EEnum, EStructuralFeature, EAttribute, EReference, EGenericType } from '@emfts/core';
import * as EObjectHelper from '../util/EObjectHelper.js';

/**
 * Maps Ecore types to TypeScript types
 */
export class TypeMapper {
  private customMappings: Map<string, string> = new Map();
  /** When true, many-valued features use EList<T> instead of T[]. */
  useEList: boolean = false;

  constructor() {
    this.initDefaultMappings();
  }

  private initDefaultMappings(): void {
    // Ecore primitive types
    this.customMappings.set('EString', 'string');
    this.customMappings.set('EChar', 'string');
    this.customMappings.set('ECharacterObject', 'string');
    this.customMappings.set('EBoolean', 'boolean');
    this.customMappings.set('EBooleanObject', 'boolean');
    this.customMappings.set('EInt', 'number');
    this.customMappings.set('EIntegerObject', 'number');
    this.customMappings.set('EByte', 'number');
    this.customMappings.set('EByteObject', 'number');
    this.customMappings.set('EShort', 'number');
    this.customMappings.set('EShortObject', 'number');
    this.customMappings.set('ELong', 'number');
    this.customMappings.set('ELongObject', 'number');
    this.customMappings.set('EFloat', 'number');
    this.customMappings.set('EFloatObject', 'number');
    this.customMappings.set('EDouble', 'number');
    this.customMappings.set('EDoubleObject', 'number');
    this.customMappings.set('EBigInteger', 'bigint');
    this.customMappings.set('EBigDecimal', 'number');
    this.customMappings.set('EDate', 'Date');
    this.customMappings.set('EJavaObject', 'unknown');
    this.customMappings.set('EJavaClass', 'unknown');
    this.customMappings.set('EByteArray', 'Uint8Array');
    this.customMappings.set('EFeatureMapEntry', 'unknown');
    this.customMappings.set('EEnumerator', 'unknown');
    this.customMappings.set('EDiagnosticChain', 'unknown');
    this.customMappings.set('EMap', 'Map<unknown, unknown>');
    this.customMappings.set('EEList', 'Array<unknown>');
    this.customMappings.set('ETreeIterator', 'IterableIterator<unknown>');
    this.customMappings.set('EInvocationTargetException', 'Error');
    this.customMappings.set('EResource', 'Resource');
    this.customMappings.set('EResourceSet', 'ResourceSet');
  }

  /**
   * Add a custom type mapping
   */
  addMapping(ecoreName: string, tsType: string): void {
    this.customMappings.set(ecoreName, tsType);
  }

  /**
   * Map an EClassifier to TypeScript type
   */
  mapClassifier(classifier: EClassifier | null): string {
    if (!classifier) {
      return 'unknown';
    }

    let name = EObjectHelper.getName(classifier);

    // Fallback: extract name from proxy URI if getName returns null
    if (!name && typeof (classifier as any).eIsProxy === 'function' && (classifier as any).eIsProxy()) {
      const proxyURI = (classifier as any).eProxyURI?.()?.toString?.();
      if (proxyURI) {
        const hashIdx = proxyURI.indexOf('#//');
        if (hashIdx >= 0) {
          name = proxyURI.substring(hashIdx + 3).split('/').pop() ?? null;
        }
      }
    }

    if (!name) {
      return 'unknown';
    }

    // Check custom mappings first
    if (this.customMappings.has(name)) {
      return this.customMappings.get(name)!;
    }

    // For EClass and EEnum, use the name directly
    return name;
  }

  /**
   * Map an EStructuralFeature to TypeScript type string
   */
  mapFeature(feature: EStructuralFeature): string {
    const baseType = this.mapFeatureBaseType(feature);
    const many = EObjectHelper.isMany(feature);

    if (many) {
      return this.useEList ? `EList<${baseType}>` : `${baseType}[]`;
    }
    return baseType;
  }

  /**
   * Map the base type of a feature (without array wrapper)
   */
  mapFeatureBaseType(feature: EStructuralFeature): string {
    // A generic type with type arguments carries more information than the
    // plain eType (e.g. VariableWrapper<string> instead of VariableWrapper)
    const genericType = (feature as any).getEGenericType?.();
    if (genericType) {
      const typeArguments = EObjectHelper.getFeatureValue(genericType, 'eTypeArguments') || [];
      if (typeArguments.length > 0) {
        return this.mapGenericType(genericType);
      }
    }

    // Use eType directly
    const eType = EObjectHelper.getEType(feature);
    return this.mapClassifier(eType);
  }

  /**
   * Map an EGenericType to TypeScript type string
   */
  mapGenericType(genericType: EGenericType): string {
    const classifier = EObjectHelper.getFeatureValue(genericType, 'eClassifier');

    if (!classifier) {
      // Type parameter reference
      const typeParameter = EObjectHelper.getFeatureValue(genericType, 'eTypeParameter');
      if (typeParameter) {
        return EObjectHelper.getName(typeParameter) ?? 'T';
      }
      return 'unknown';
    }

    const baseName = this.mapClassifier(classifier);
    const typeArguments = EObjectHelper.getFeatureValue(genericType, 'eTypeArguments') || [];

    if (typeArguments && typeArguments.length > 0) {
      const args = typeArguments.map((arg: EGenericType) => this.mapGenericType(arg)).join(', ');
      return `${baseName}<${args}>`;
    }

    return baseName;
  }

  /**
   * Get the default value for a type
   */
  getDefaultValue(feature: EStructuralFeature): string | null {
    const defaultLiteral = EObjectHelper.getDefaultValueLiteral(feature);
    if (defaultLiteral !== null && defaultLiteral !== undefined) {
      return this.convertDefaultValue(feature, defaultLiteral);
    }

    if (EObjectHelper.isMany(feature)) {
      return this.useEList ? null : '[]';
    }

    // EMF semantics: an EEnum attribute without explicit default defaults
    // to the first enum literal
    const eType = EObjectHelper.getEType(feature);
    if (eType && this.isEEnum(eType)) {
      const literals = EObjectHelper.getELiterals(eType);
      const first = literals?.[0];
      const firstName = first ? EObjectHelper.getName(first) : null;
      if (firstName) {
        return `${EObjectHelper.getName(eType)}.${firstName}`;
      }
    }

    // Check if required
    const lowerBound = EObjectHelper.getLowerBound(feature);
    if (lowerBound === 0) {
      return null; // Optional, no default
    }

    // Get default for type
    const typeName = this.mapFeatureBaseType(feature);
    return this.getTypeDefault(typeName);
  }

  /**
   * Convert a default value literal to TypeScript
   */
  private convertDefaultValue(feature: EStructuralFeature, literal: string): string {
    const typeName = this.mapFeatureBaseType(feature);

    switch (typeName) {
      case 'string':
        // Already a string, add quotes if not present
        if (!literal.startsWith('"') && !literal.startsWith("'")) {
          return `"${literal}"`;
        }
        return literal;

      case 'boolean':
        return literal.toLowerCase() === 'true' ? 'true' : 'false';

      case 'number':
      case 'bigint':
        return literal;

      case 'Date':
        return `new Date("${literal}")`;

      default:
        // Enum or custom type - check if it's an enum
        const eType = EObjectHelper.getEType(feature);
        if (eType && this.isEEnum(eType)) {
          const enumName = EObjectHelper.getName(eType) ?? typeName;
          // The defaultValueLiteral holds the EEnumLiteral literal (or name);
          // the generated member is always named after the literal's name
          const literals = EObjectHelper.getELiterals(eType) ?? [];
          const match = literals.find((l: any) =>
            EObjectHelper.getLiteral(l) === literal || EObjectHelper.getName(l) === literal
          );
          const memberName = match ? EObjectHelper.getName(match) : literal;
          return `${enumName}.${memberName}`;
        }
        // A reference default needs an instance - emitting the raw literal
        // would assign e.g. a number to a class-typed feature (#29)
        if (this.isReference(feature)) {
          return `new ${typeName}()`;
        }
        return literal;
    }
  }

  /**
   * Get default value for a TypeScript type
   */
  private getTypeDefault(typeName: string): string | null {
    switch (typeName) {
      case 'string':
        return '""';
      case 'boolean':
        return 'false';
      case 'number':
        return '0';
      case 'bigint':
        return '0n';
      default:
        return null;
    }
  }

  /**
   * Check if a classifier is an EEnum
   */
  isEEnum(classifier: EClassifier): boolean {
    // Check for static interface
    if ('getELiterals' in classifier) return true;

    // Check for dynamic object - look at eClass name
    const eClass = (classifier as any).eClass?.();
    const eClassName = eClass?.getName?.();
    return eClassName === 'EEnum';
  }

  /**
   * Check if a classifier is an EClass
   */
  isEClass(classifier: EClassifier): boolean {
    // Check for static interface
    if ('getEStructuralFeatures' in classifier) return true;

    // Check for dynamic object - look at eClass name
    const eClass = (classifier as any).eClass?.();
    const eClassName = eClass?.getName?.();
    return eClassName === 'EClass';
  }

  /**
   * Check if a classifier is an EDataType
   */
  isEDataType(classifier: EClassifier): boolean {
    // Check for static interface
    if ('isSerializable' in classifier && !this.isEEnum(classifier)) return true;

    // Check for dynamic object - look at eClass name
    const eClass = (classifier as any).eClass?.();
    const eClassName = eClass?.getName?.();
    return eClassName === 'EDataType' && !this.isEEnum(classifier);
  }

  /**
   * Check if a feature is an attribute
   */
  isAttribute(feature: EStructuralFeature): feature is EAttribute {
    return !('isContainment' in feature);
  }

  /**
   * Check if a feature is a reference
   */
  isReference(feature: EStructuralFeature): feature is EReference {
    return 'isContainment' in feature;
  }
}
