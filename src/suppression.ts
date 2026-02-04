import * as fs from 'fs';
import * as path from 'path';
import { SuppressionFile, Violation, InlineTypeViolation } from './types.js';

export function loadSuppressions(suppressionPath: string): SuppressionFile {
  try {
    if (!fs.existsSync(suppressionPath)) {
      return {};
    }
    const content = fs.readFileSync(suppressionPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw new Error(`Failed to load suppressions from ${suppressionPath}: ${(error as Error).message}`);
  }
}

export function saveSuppressions(suppressions: SuppressionFile, filePath: string): void {
  const content = JSON.stringify(suppressions, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function isSuppressed(
  violation: Violation,
  suppressions: SuppressionFile,
  targetDir: string
): boolean {
  const relativePath = path.relative(targetDir, violation.filePath);
  const fileSuppressions = suppressions[relativePath];

  if (!fileSuppressions) {
    return false;
  }

  return violation.typeName in fileSuppressions;
}

export function generateSuppressionsForAll(
  violations: Violation[],
  targetDir: string
): SuppressionFile {
  const suppressions: SuppressionFile = {};

  for (const violation of violations) {
    const relativePath = path.relative(targetDir, violation.filePath);

    if (!suppressions[relativePath]) {
      suppressions[relativePath] = {};
    }

    suppressions[relativePath][violation.typeName] = {
      reason: "Auto-suppressed - add explanation here",
    };
  }

  return suppressions;
}

export function mergeSuppressions(
  existing: SuppressionFile,
  newSuppressions: SuppressionFile
): SuppressionFile {
  const merged: SuppressionFile = { ...existing };

  for (const [filePath, typeSuppressions] of Object.entries(newSuppressions)) {
    if (!merged[filePath]) {
      merged[filePath] = {};
    }

    for (const [typeName, entry] of Object.entries(typeSuppressions)) {
      if (!merged[filePath][typeName]) {
        merged[filePath][typeName] = entry;
      }
    }
  }

  return merged;
}

export function isInlineSuppressed(
  violation: InlineTypeViolation,
  suppressions: SuppressionFile,
  targetDir: string
): boolean {
  const relativePath = path.relative(targetDir, violation.filePath);
  const key = `inline:${violation.line}:${violation.column}`;
  const fileSuppressions = suppressions[relativePath];
  return fileSuppressions !== undefined && key in fileSuppressions;
}

export function generateInlineSuppressions(
  violations: InlineTypeViolation[],
  targetDir: string
): SuppressionFile {
  const suppressions: SuppressionFile = {};

  for (const violation of violations) {
    const relativePath = path.relative(targetDir, violation.filePath);
    const key = `inline:${violation.line}:${violation.column}`;

    if (!suppressions[relativePath]) {
      suppressions[relativePath] = {};
    }
    suppressions[relativePath][key] = { reason: violation.context };
  }

  return suppressions;
}
