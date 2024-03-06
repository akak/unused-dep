# unused-dep

Detect and clean up unused dependencies in your TypeScript project effortlessly.

This command-line tool analyzes your TypeScript source files, identifies dependencies that are not explicitly imported, and provides a list of unused dependencies. Streamline your project's dependencies for a cleaner, more efficient codebase.

## Usage

Navigate to your TypeScript project directory and run the tool using `npx`:

```bash
npx unused-dep
```

or using yarn:

```bash
yarn dlx unused-dep
```

### Options

- **--packageJson**: Path to the package.json file (default: `./package.json`).
- **--filesToCheck**: Glob pattern for files to check (default: `src/**/*.ts`).
- **--maxParallelFiles**: Maximum number of files to process in parallel (default: `100`).

Example:

```bash
npx unused-dep --packageJson=./path/to/your/package.json --filesToCheck=./path/to/your/files/**/*.ts --maxParallelFiles=50
```

or using yarn:

```bash
yarn dlx unused-dep --packageJson=./path/to/your/package.json --filesToCheck=./path/to/your/files/**/*.ts --maxParallelFiles=50
```

## Features

- Efficiently identifies unused dependencies in TypeScript files.
- Simple command-line interface for quick execution.
- Supports parallel processing for improved performance.
- Utilizes a progress bar to track the analysis of multiple files.
- Compatible with TypeScript projects using npm or yarn.

## Contributing

If you find any issues or have suggestions for improvements, feel free to open an issue or create a pull request.

## License

This project is licensed under the GPL-3 License - see the [LICENSE](LICENSE) file for details.
