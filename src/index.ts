#!/usr/bin/env node
import * as path from 'path';
import { analyzeCodebase } from './analyzer.js';
import { loadSuppressions, saveSuppressions, isSuppressed, generateSuppressionsForAll, mergeSuppressions } from './suppression.js';
import { reportViolations, reportSuccess, reportSummary } from './reporter.js';
import { getChangedFiles, findRepoRoot } from './git.js';
import { AnalyzerOptions } from './types.js';

interface ParsedArgs {
  targetDir: string;
  suppressAll: boolean;
  changedOnly: boolean;
  files: string[];
  help: boolean;
}

function collectFiles(args: string[], startIndex: number): { files: string[]; nextIndex: number } {
  const files: string[] = [];
  let i = startIndex;
  while (i < args.length) {
    const file = args[i];
    if (!file || file.startsWith('--')) break;
    files.push(file);
    i++;
  }
  return { files, nextIndex: i - 1 };
}

function handleArgument(arg: string, context: {
  args: string[];
  index: number;
  result: ParsedArgs;
}): number {
  switch (arg) {
    case '--target-dir': {
      const targetDirArg = context.args[context.index + 1];
      if (targetDirArg) {
        context.result.targetDir = path.resolve(targetDirArg);
      }
      return context.index + 1;
    }
    case '--suppress-all':
      context.result.suppressAll = true;
      return context.index;
    case '--changed-only':
      context.result.changedOnly = true;
      return context.index;
    case '--files': {
      const collected = collectFiles(context.args, context.index + 1);
      context.result.files.push(...collected.files);
      return collected.nextIndex;
    }
    case '--help':
    case '-h':
      context.result.help = true;
      return context.index;
    default:
      if (arg && !arg.startsWith('--')) {
        context.result.files.push(arg);
      }
      return context.index;
  }
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    targetDir: process.cwd(),
    suppressAll: false,
    changedOnly: false,
    files: [],
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg !== undefined) {
      i = handleArgument(arg, { args, index: i, result });
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Single-use Type Linter

Usage:
  single-use-types [options]

Options:
  --target-dir <path>    Directory to analyze (default: current directory)
  --suppress-all         Generate suppressions for all violations
  --changed-only         Only check files changed vs origin/main
  --files <file...>      Specific files to check
  --help, -h            Show this help message

Examples:
  single-use-types --target-dir ./client
  single-use-types --changed-only
  single-use-types --suppress-all
  single-use-types --files src/foo.ts src/bar.ts
`);
}

function getChangedFilesForCheck(targetDir: string): string[] | undefined {
  try {
    const repoRoot = findRepoRoot(targetDir);
    const files = getChangedFiles(repoRoot, targetDir);
    if (files.length === 0) {
      console.log('No TypeScript files changed');
      process.exit(0);
    }
    return files;
  } catch (error) {
    console.warn(`Warning: ${(error as Error).message}`);
    console.warn('Falling back to checking all files');
    return undefined;
  }
}

function determineFilesToCheck(args: ParsedArgs, targetDir: string): string[] | undefined {
  if (args.files.length > 0) {
    return args.files;
  }
  if (args.changedOnly) {
    return getChangedFilesForCheck(targetDir);
  }
  return undefined;
}

function handleSuppressAll(context: {
  unsuppressedViolations: Awaited<ReturnType<typeof analyzeCodebase>>['violations'];
  suppressions: ReturnType<typeof loadSuppressions>;
  suppressionPath: string;
  targetDir: string;
  result: Awaited<ReturnType<typeof analyzeCodebase>>;
}): void {
  const newSuppressions = generateSuppressionsForAll(context.unsuppressedViolations, context.targetDir);
  const mergedSuppressions = mergeSuppressions(context.suppressions, newSuppressions);
  saveSuppressions(mergedSuppressions, context.suppressionPath);
  console.log(`✓ Suppressed ${context.unsuppressedViolations.length} violation(s) in ${context.suppressionPath}`);
  reportSummary(context.result.totalTypesAnalyzed, context.result.filesAnalyzed);
  process.exit(0);
}

function handleViolationResults(
  unsuppressedViolations: Awaited<ReturnType<typeof analyzeCodebase>>['violations'],
  targetDir: string,
  result: Awaited<ReturnType<typeof analyzeCodebase>>
): void {
  if (unsuppressedViolations.length > 0) {
    reportViolations(unsuppressedViolations, targetDir);
    reportSummary(result.totalTypesAnalyzed, result.filesAnalyzed);
    process.exit(1);
  } else {
    reportSuccess();
    reportSummary(result.totalTypesAnalyzed, result.filesAnalyzed);
    process.exit(0);
  }
}

async function runAnalysis(args: ParsedArgs): Promise<void> {
  const targetDir = args.targetDir;
  const suppressionPath = path.join(targetDir, 'single-use-types-suppressions.json');
  const suppressions = loadSuppressions(suppressionPath);
  const filesToCheck = determineFilesToCheck(args, targetDir);

  const options: AnalyzerOptions = { targetDir, specificFiles: filesToCheck };
  const result = await analyzeCodebase(options);

  const unsuppressedViolations = result.violations.filter(
    v => !isSuppressed(v, suppressions, targetDir)
  );

  if (args.suppressAll) {
    handleSuppressAll({ unsuppressedViolations, suppressions, suppressionPath, targetDir, result });
  }

  handleViolationResults(unsuppressedViolations, targetDir, result);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  await runAnalysis(args);
}

main().catch(error => {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});
