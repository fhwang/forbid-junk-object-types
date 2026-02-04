#!/usr/bin/env node
import * as path from 'path';
import { analyzeCodebase } from './analyzer.js';
import { loadSuppressions, saveSuppressions, isSuppressed, isInlineSuppressed, generateSuppressionsForAll, generateInlineSuppressions, mergeSuppressions } from './suppression.js';
import { reportViolations, reportSuccess, reportSummary, reportInlineViolations } from './reporter.js';
import { getChangedFiles, findRepoRoot } from './git.js';
import { SuppressionFile, FilteredViolationsResult, AnalysisResult } from './types.js';

interface ParsedArgs {
  targetDir: string;
  suppressAll: boolean;
  changedOnly: boolean;
  files: string[];
  help: boolean;
}

interface ResultContext {
  filtered: FilteredViolationsResult;
  targetDir: string;
  result: AnalysisResult;
}

function collectFiles(args: string[], startIndex: number): string[] {
  const files: string[] = [];
  let i = startIndex;
  while (i < args.length) {
    const file = args[i];
    if (!file || file.startsWith('--')) break;
    files.push(file);
    i++;
  }
  return files;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    targetDir: process.cwd(),
    suppressAll: false,
    changedOnly: false,
    files: [],
    help: false,
  };

  function handleArgument(arg: string, index: number): number {
    switch (arg) {
      case '--target-dir': {
        const targetDirArg = args[index + 1];
        if (targetDirArg) {
          result.targetDir = path.resolve(targetDirArg);
        }
        return index + 1;
      }
      case '--suppress-all':
        result.suppressAll = true;
        return index;
      case '--changed-only':
        result.changedOnly = true;
        return index;
      case '--files': {
        const files = collectFiles(args, index + 1);
        result.files.push(...files);
        return index + files.length;
      }
      case '--help':
      case '-h':
        result.help = true;
        return index;
      default:
        if (arg && !arg.startsWith('--')) {
          result.files.push(arg);
        }
        return index;
    }
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg !== undefined) {
      i = handleArgument(arg, i);
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Junk Object Type Linter

Usage:
  forbid-junk-object-types [options]

Options:
  --target-dir <path>    Directory to analyze (default: current directory)
  --suppress-all         Generate suppressions for all violations
  --changed-only         Only check files changed vs origin/main
  --files <file...>      Specific files to check
  --help, -h            Show this help message

Examples:
  forbid-junk-object-types --target-dir ./client
  forbid-junk-object-types --changed-only
  forbid-junk-object-types --suppress-all
  forbid-junk-object-types --files src/foo.ts src/bar.ts
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

function handleSuppressAll(
  context: ResultContext,
  suppressions: SuppressionFile,
  suppressionPath: string
): void {
  const { filtered, targetDir, result } = context;
  const newSuppressions = generateSuppressionsForAll(filtered.unsuppressedViolations, targetDir);
  const newInlineSuppressions = generateInlineSuppressions(filtered.unsuppressedInlineViolations, targetDir);
  let mergedSuppressions = mergeSuppressions(suppressions, newSuppressions);
  mergedSuppressions = mergeSuppressions(mergedSuppressions, newInlineSuppressions);
  saveSuppressions(mergedSuppressions, suppressionPath);
  const totalSuppressed = filtered.unsuppressedViolations.length + filtered.unsuppressedInlineViolations.length;
  console.log(`✓ Suppressed ${totalSuppressed} violation(s) in ${suppressionPath}`);
  reportSummary(result.totalTypesAnalyzed, result.filesAnalyzed);
  process.exit(0);
}

function handleViolationResults(context: ResultContext): void {
  const { filtered, targetDir, result } = context;
  const hasViolations = filtered.unsuppressedViolations.length > 0 || filtered.unsuppressedInlineViolations.length > 0;

  if (filtered.unsuppressedViolations.length > 0) {
    reportViolations(filtered.unsuppressedViolations, targetDir);
  }

  if (filtered.unsuppressedInlineViolations.length > 0) {
    reportInlineViolations(filtered.unsuppressedInlineViolations, targetDir);
  }

  if (!hasViolations) {
    reportSuccess();
  }

  reportSummary(result.totalTypesAnalyzed, result.filesAnalyzed);
  process.exit(hasViolations ? 1 : 0);
}

function filterSuppressedViolations(
  result: AnalysisResult,
  suppressions: SuppressionFile,
  targetDir: string
): FilteredViolationsResult {
  const unsuppressedViolations = result.violations.filter(v => !isSuppressed(v, suppressions, targetDir));
  const unsuppressedInlineViolations = result.inlineViolations.filter(v => !isInlineSuppressed(v, suppressions, targetDir));
  return { unsuppressedViolations, unsuppressedInlineViolations };
}

async function runAnalysis(args: ParsedArgs): Promise<void> {
  const targetDir = args.targetDir;
  const suppressionPath = path.join(targetDir, 'junk-object-types-suppressions.json');
  const suppressions = loadSuppressions(suppressionPath);
  const filesToCheck = determineFilesToCheck(args, targetDir);
  const result = await analyzeCodebase({ targetDir, specificFiles: filesToCheck });
  const filtered = filterSuppressedViolations(result, suppressions, targetDir);
  const context: ResultContext = { filtered, targetDir, result };

  if (args.suppressAll) {
    handleSuppressAll(context, suppressions, suppressionPath);
  }

  handleViolationResults(context);
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
