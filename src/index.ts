import ts, {
  ImportDeclaration,
  type NamedImports,
  type NamespaceImport,
  type Node as TsNode,
} from "typescript";
import { promisify } from "util";
import yargs, { type Options as YArgsOptions } from "yargs";
import { glob } from "glob";
import pLimit from "p-limit";
import { readFile, readFileSync } from "fs";
import { Presets, SingleBar } from "cli-progress";

const {
  ScriptTarget,
  createSourceFile,
  isImportDeclaration,
  isNamedImports,
  isNamespaceImport,
  isStringLiteral,
} = ts;

const readFileAsync = promisify(readFile);

interface PackageJson {
  dependencies?: Record<string, string>;
}

const argsSetup = {
  packageJsonPath: {
    describe: "Path to the package.json file",
    type: "string",
    default: "./package.json",
  },
  filesToCheck: {
    describe: "Glob pattern for files to check",
    type: "string",
    default: "src/**/*.ts",
  },
  maxParallelFiles: {
    describe: "Maximum number of files to process in parallel",
    type: "number",
    default: 100,
  },
  debug: {
    describe: "Enable debug mode",
    type: "boolean",
    default: false,
  },
} as const satisfies Record<string, YArgsOptions>;

type DependencyName = string;

function getLibraryName(
  namedImport: NamedImports | NamespaceImport
): string | null {
  const { moduleSpecifier } = namedImport.parent.parent;
  return isStringLiteral(moduleSpecifier) ? moduleSpecifier.text : null;
}

async function findDependencies(
  fileContent: string
): Promise<Set<DependencyName>> {
  const dependencies = new Set<DependencyName>();
  const sourceFile = createSourceFile(
    "temp.ts",
    fileContent,
    ScriptTarget.ESNext,
    true
  );

  function processImportDeclaration(tsNode: ImportDeclaration): void {
    // TODO: It's better to remove the library name from the package.json dependencies set.
    // This way we can stop looking for unused dependencies as soon as the set of dependencies is empty.

    if (isStringLiteral(tsNode.moduleSpecifier)) {
      // Process default import
      const libraryName = tsNode.moduleSpecifier.text;
      dependencies.add(libraryName);
      return;
    }

    const { namedBindings } = tsNode.importClause ?? {};

    if (
      !namedBindings ||
      !isNamedImports(namedBindings) ||
      !isNamespaceImport(namedBindings)
    ) {
      return;
    }
    // Process named and namespace imports
    const libraryName = getLibraryName(namedBindings);
    if (libraryName !== null) {
      dependencies.add(libraryName);
    }
  }

  async function visitNode(tsNode: TsNode): Promise<void> {
    if (isImportDeclaration(tsNode)) {
      processImportDeclaration(tsNode);
    }

    await Promise.allSettled(tsNode.getChildren().map(visitNode));
  }

  await visitNode(sourceFile);
  return dependencies;
}

interface CollectDependenciesArgs {
  filesToCheck: string;
  maxParallelFiles: number;
  debug: boolean;
}

async function collectDependencies({
  filesToCheck,
  maxParallelFiles,
  debug,
}: CollectDependenciesArgs): Promise<Set<DependencyName>> {
  console.log("Reading files...");
  const progressBar = new SingleBar({}, Presets.shades_classic);
  const allUsedDependencies = new Set<DependencyName>();

  const limit = pLimit(maxParallelFiles);
  const files = await glob(filesToCheck);
  if (debug) {
    console.log("Found files:", { files });
  }
  progressBar.start(files.length, 0);
  const limits = files.map(function limitFileProcessing(file): Promise<void> {
    return limit(async function processFile(): Promise<void> {
      const fileContent = await readFileAsync(file, "utf8");
      const usedDependencies = await findDependencies(fileContent);
      if (debug) {
        console.log("Found dependencies:", { file, usedDependencies });
      }
      usedDependencies.forEach((dependency) =>
        allUsedDependencies.add(dependency)
      );
      progressBar.increment();
    });
  });

  await Promise.allSettled(limits);
  progressBar.stop();

  return allUsedDependencies;
}

interface FindUnusedDependenciesArgs {
  usedDependencies: Set<DependencyName>;
  packageJson: PackageJson;
}

function findUnusedDependencies({
  usedDependencies,
  packageJson,
}: FindUnusedDependenciesArgs): Set<DependencyName> {
  console.log("Finding unused dependencies...");
  const allDependencies = new Set(Object.keys(packageJson.dependencies || {}));
  return new Set(
    [...allDependencies].filter((dep): boolean => !usedDependencies.has(dep))
  );
}

async function getPackageJson(packageJsonPath: string): Promise<PackageJson> {
  try {
    const packageJsonFile = readFileSync(packageJsonPath, "utf8");
    return JSON.parse(packageJsonFile);
  } catch (error) {
    console.error("Error reading package.json", { error, packageJsonPath });
    process.exit(1);
  }
}

async function runScript(): Promise<void> {
  const args = await yargs(process.argv.slice(2))
    .options(argsSetup)
    .help()
    .parse();
  const { packageJsonPath, filesToCheck, maxParallelFiles, debug } = args;
  const packageJson = await getPackageJson(packageJsonPath);
  const usedDependencies = await collectDependencies({
    filesToCheck,
    maxParallelFiles,
    debug,
  });
  const unusedDependencies = findUnusedDependencies({
    usedDependencies,
    packageJson,
  });
  console.log("Unused Dependencies:", [...unusedDependencies]);
}

runScript();
