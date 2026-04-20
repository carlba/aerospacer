# aerospacer

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-0.0.1-blue)
![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey)

## Features

- Manage AeroSpace window layouts and workspace gaps via a CLI.
- Toggle concentrate mode and move the terminal between workspaces.
- Adjust `.aerospace.toml` values and reload AeroSpace automatically.

## Installation

```bash
npm install
npm run build
# For local testing
npm link
```

## Usage

- Run the CLI: `aerospacer <command>`
- Common commands:
	- `reload` — restart AeroSpace and adjust windows
	- `toggle-terminal` — move terminal to active workspace
	- `concentrate-mode` — toggle concentrate layout

See the CLI entry: [src/aerospacer.ts](src/aerospacer.ts)
See implementation: [src/lib](src/lib)

## Contributing

- Run tests: `npm test`
- Lint: `npm run lint`
- Open a pull request and describe your change.
- See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

License: See [LICENSE](LICENSE)
