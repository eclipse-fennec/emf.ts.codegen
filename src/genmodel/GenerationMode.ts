/**
 * Generation mode for code output
 */
export enum GenerationMode {
  /** Pure TypeScript POJOs without dependencies */
  PLAIN = 'plain',

  /** Classes with @Attribute, @Reference decorators and reflect-metadata */
  DECORATOR = 'decorator',

  /** EMF-conformant classes extending BasicEObject with eLiterals */
  EMF = 'emf'
}

/**
 * Property access mode for generated features
 */
export enum PropertyMode {
  /** No property generated */
  NONE = 'none',

  /** Read-only property (getter only) */
  READONLY = 'readonly',

  /** Full read/write property */
  EDITABLE = 'editable'
}
