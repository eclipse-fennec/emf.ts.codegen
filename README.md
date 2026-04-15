# emf.ts.codegen

TypeScript code generator for [Ecore](https://eclipse.dev/modeling/emf/) models using [emf.ts](https://github.com/eclipse-fennec/emf.ts).

## Features

- Generate TypeScript interfaces and classes from `.ecore` models
- Support for multiple generation modes (plain, decorator-based, EMF-style)
- REST client generation from Ecore models
- CLI tool for easy integration into build pipelines
- Configurable via `.genconfig.xmi` files

## Installation

```bash
npm install emfts-codegen
```

## Usage

### CLI

```bash
# Generate TypeScript code from an Ecore model
emfts-codegen generate -m model/my-model.ecore -c model/my-model.genconfig.xmi -o src/generated

# Initialize a new genconfig
emfts-codegen init
```

### Programmatic

```typescript
import { CodeGenerator } from 'emfts-codegen';
```

## License

[EPL-2.0](https://www.eclipse.org/legal/epl-2.0/)