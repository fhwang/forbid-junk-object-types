import * as ts from 'typescript';

export interface TypeDefinition {
  name: string;
  kind: 'interface' | 'type';
  filePath: string;
  line: number;
  column: number;
  isObjectType: boolean;
  node: ts.Node;
  isExported: boolean;
}

export interface TypeUsage {
  typeName: string;
  usageContext: 'function-param' | 'function-return' | 'variable' | 'property' | 'generic-arg';
  functionName?: string;
  filePath: string;
  line: number;
}

export type Violation =
  | {
      kind: 'single-use-named';
      typeName: string;
      usedByFunction: string;
      filePath: string;
      line: number;
      column: number;
    }
  | {
      kind: 'inline-object';
      context: string;
      filePath: string;
      line: number;
      column: number;
    };

export interface SuppressionEntry {
  reason?: string;
}

export type SuppressionFile = Record<string, Record<string, SuppressionEntry>>;

export interface AnalyzerOptions {
  targetDir: string;
  changedFilesOnly?: boolean;
  specificFiles?: string[];
  suppressionFile?: string;
}

export interface AnalysisResult {
  violations: Violation[];
  totalTypesAnalyzed: number;
  filesAnalyzed: number;
}
