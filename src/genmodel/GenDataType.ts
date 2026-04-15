import type { EDataType } from '@emfts/core';

/**
 * Generation configuration for an EDataType
 */
export interface GenDataType {
  /** Reference to the Ecore data type */
  ecoreDataType: EDataType;

  /** TypeScript type to map to */
  tsType: string;

  /** Serialization function name */
  serializeFunction?: string;

  /** Deserialization function name */
  deserializeFunction?: string;
}

/**
 * Create default GenDataType from EDataType
 */
export function createDefaultGenDataType(dataType: EDataType): GenDataType {
  return {
    ecoreDataType: dataType,
    tsType: mapDefaultTsType(dataType.getName() ?? 'any')
  };
}

/**
 * Map Ecore type name to default TypeScript type
 */
function mapDefaultTsType(typeName: string): string {
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
