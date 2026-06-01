# emf.ts.codegen

TypeScript code generator for [Ecore](https://eclipse.dev/modeling/emf/) models using [emf.ts](https://github.com/eclipse-fennec/emf.ts).

Ecore aligns with the OMG [MOF/EMOF](https://www.omg.org/spec/MOF/) specification; `.genconfig.xmi` configuration files use OMG [XMI](https://www.omg.org/spec/XMI/).

## Features

- Generate TypeScript interfaces and classes from `.ecore` models
- Support for multiple generation modes (plain, decorator-based, EMF-style)
- REST client generation from Ecore models
- CLI tool for easy integration into build pipelines
- Configurable via `.genconfig.xmi` files

## Installation

```bash
npm install @emfts/codegen
```

This installs the `emfts-codegen` CLI binary.

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
import { CodeGenerator } from '@emfts/codegen';
```

## Deployment & Artifacts

| | |
|---|---|
| Registry | [npmjs.com](https://www.npmjs.com/package/@emfts/codegen) |
| Package | [`@emfts/codegen`](https://www.npmjs.com/package/@emfts/codegen) (public) |
| CLI binary | `emfts-codegen` |
| Build output | `dist/` (ESM, `tsc`) — only `dist` is published (see `files` in `package.json`) |
| Source | <https://github.com/eclipse-fennec/emf.ts.codegen> (default branch `main`) |
| Project | [Eclipse Fennec](https://projects.eclipse.org/projects/modeling.fennec) |

Releases are published to the npm registry under the `@emfts` scope.

## License

[EPL-2.0](https://www.eclipse.org/legal/epl-2.0/) — see [`LICENSE`](./LICENSE).