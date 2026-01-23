/* eslint-disable max-lines */
import * as ts from 'typescript';
import { TypeDefinition, TypeUsage, InlineObjectViolation, SourceLocation } from './types.js';

export function getLineAndColumn(node: ts.Node, sourceFile: ts.SourceFile): SourceLocation {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: line + 1, column: character + 1 };
}

function getTypeReferenceName(typeName: ts.EntityName): string | null {
  if (ts.isIdentifier(typeName)) {
    return typeName.text;
  }
  if (ts.isQualifiedName(typeName)) {
    return typeName.right.text;
  }
  return null;
}

export function isObjectLikeType(typeNode: ts.TypeNode): boolean {
  if (ts.isTypeLiteralNode(typeNode)) {
    return true;
  }

  if (ts.isTypeReferenceNode(typeNode) && typeNode.typeName) {
    const typeName = getTypeReferenceName(typeNode.typeName);
    if (typeName && ['Pick', 'Omit', 'Record', 'Partial', 'Required'].includes(typeName)) {
      return true;
    }
  }

  return false;
}

export function isExportedNode(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (modifiers) {
    return modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
  }
  return false;
}

export function extendsOtherType(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): boolean {
  if (ts.isInterfaceDeclaration(node) && node.heritageClauses) {
    return node.heritageClauses.length > 0;
  }
  return false;
}

function addInterfaceDefinition(
  node: ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile,
  definitions: Map<string, TypeDefinition>
): void {
  const name = node.name.text;
  const { line, column } = getLineAndColumn(node, sourceFile);
  definitions.set(`${sourceFile.fileName}:${name}`, {
    name,
    kind: 'interface',
    filePath: sourceFile.fileName,
    line,
    column,
    isObjectType: true,
    node,
    isExported: isExportedNode(node),
  });
}

function addTypeAliasDefinition(
  node: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  definitions: Map<string, TypeDefinition>
): void {
  const name = node.name.text;
  const isObjectType = isObjectLikeType(node.type);
  if (isObjectType) {
    const { line, column } = getLineAndColumn(node, sourceFile);
    definitions.set(`${sourceFile.fileName}:${name}`, {
      name,
      kind: 'type',
      filePath: sourceFile.fileName,
      line,
      column,
      isObjectType: true,
      node,
      isExported: isExportedNode(node),
    });
  }
}

export function collectTypeDefinitions(
  sourceFile: ts.SourceFile,
  definitions: Map<string, TypeDefinition>
): void {
  function visit(node: ts.Node): void {
    if (ts.isInterfaceDeclaration(node)) {
      addInterfaceDefinition(node, sourceFile, definitions);
    }
    if (ts.isTypeAliasDeclaration(node)) {
      addTypeAliasDefinition(node, sourceFile, definitions);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function getArrowFunctionName(node: ts.Node): string | undefined {
  const parent = node.parent;
  if (!parent) {
    return undefined;
  }

  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  return undefined;
}

export function getFunctionName(node: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return node.name.text;
  }

  if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
    return node.name.text;
  }

  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return getArrowFunctionName(node);
  }

  return undefined;
}

function extractTypeNameFromReference(typeNode: ts.TypeReferenceNode): string | null {
  const typeName = typeNode.typeName;
  if (ts.isIdentifier(typeName)) {
    return typeName.text;
  }
  if (ts.isQualifiedName(typeName)) {
    return typeName.right.text;
  }
  return null;
}

interface UsageContext {
  sourceFile: ts.SourceFile;
  addUsage: (typeName: string, usage: TypeUsage) => void;
  functionName?: string;
}

function processFunctionParameters(node: ts.FunctionLikeDeclaration, context: UsageContext): void {
  for (const param of node.parameters) {
    if (param.type && ts.isTypeReferenceNode(param.type)) {
      const typeName = extractTypeNameFromReference(param.type);
      if (typeName) {
        const { line } = getLineAndColumn(param, context.sourceFile);
        context.addUsage(typeName, {
          typeName,
          usageContext: 'function-param',
          functionName: context.functionName,
          filePath: context.sourceFile.fileName,
          line,
        });
      }
    }
  }
}

function processFunctionReturnType(node: ts.FunctionLikeDeclaration, context: UsageContext): void {
  if (node.type && ts.isTypeReferenceNode(node.type)) {
    const typeName = extractTypeNameFromReference(node.type);
    if (typeName) {
      const { line } = getLineAndColumn(node.type, context.sourceFile);
      context.addUsage(typeName, {
        typeName,
        usageContext: 'function-return',
        functionName: context.functionName,
        filePath: context.sourceFile.fileName,
        line,
      });
    }
  }
}

function processVariableType(node: ts.VariableDeclaration, context: UsageContext): void {
  if (node.type && ts.isTypeReferenceNode(node.type)) {
    const typeName = extractTypeNameFromReference(node.type);
    if (typeName) {
      const { line } = getLineAndColumn(node, context.sourceFile);
      context.addUsage(typeName, {
        typeName,
        usageContext: 'variable',
        filePath: context.sourceFile.fileName,
        line,
      });
    }
  }
}

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) ||
         ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

function processFunctionNode(
  node: ts.FunctionLikeDeclaration,
  currentFunctionName: string | undefined,
  context: Omit<UsageContext, 'functionName'>
): void {
  const functionName = getFunctionName(node) || currentFunctionName;
  const fullContext: UsageContext = { ...context, functionName };
  processFunctionParameters(node, fullContext);
  processFunctionReturnType(node, fullContext);
}

export function collectTypeUsages(
  sourceFile: ts.SourceFile,
  usages: Map<string, TypeUsage[]>
): void {
  function addUsage(typeName: string, usage: TypeUsage): void {
    if (!usages.has(typeName)) {
      usages.set(typeName, []);
    }
    usages.get(typeName)!.push(usage);
  }

  let currentFunctionName: string | undefined;
  const baseContext = { sourceFile, addUsage };

  function processNode(node: ts.Node): void {
    if (isFunctionLike(node)) {
      processFunctionNode(node, currentFunctionName, baseContext);
    }
    if (ts.isVariableDeclaration(node)) {
      processVariableType(node, baseContext);
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const savedFunctionName = currentFunctionName;
      currentFunctionName = node.name.text;
      ts.forEachChild(node, visit);
      currentFunctionName = savedFunctionName;
      return;
    }

    processNode(node);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function isEmptyObjectType(node: ts.TypeLiteralNode): boolean {
  return node.members.length === 0;
}

// eslint-disable-next-line max-statements, max-lines-per-function
function getContextFromParentNode(parent: ts.Node | undefined): {
  description: string;
  functionName?: string;
} {
  if (!parent) {
    return { description: 'unknown context' };
  }

  if (ts.isParameter(parent)) {
    const func = parent.parent;
    const funcName = func && ts.isFunctionLike(func) ? getFunctionName(func) : undefined;
    return {
      description: 'function parameter',
      functionName: funcName,
    };
  }

  if (ts.isFunctionLike(parent)) {
    const funcName = getFunctionName(parent);
    return {
      description: 'function return type',
      functionName: funcName,
    };
  }

  if (ts.isVariableDeclaration(parent)) {
    return {
      description: 'variable declaration',
    };
  }

  if (ts.isPropertyDeclaration(parent)) {
    return {
      description: 'property declaration',
    };
  }

  if (ts.isTypeAliasDeclaration(parent) || ts.isInterfaceDeclaration(parent)) {
    return {
      description: 'nested in type definition',
    };
  }

  if (ts.isAsExpression(parent) || ts.isTypeAssertionExpression(parent)) {
    return {
      description: 'type assertion',
    };
  }

  // Recursively check parent's parent
  return getContextFromParentNode(parent.parent);
}

export function collectInlineObjectViolations(
  sourceFile: ts.SourceFile
): InlineObjectViolation[] {
  const violations: InlineObjectViolation[] = [];

  function visitNode(node: ts.Node, parent?: ts.Node): void {
    // Manually set up parent pointer for this traversal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node as any).parent = parent;

    if (ts.isTypeLiteralNode(node)) {
      // Skip empty object types {}
      if (!isEmptyObjectType(node)) {
        const { line, column } = getLineAndColumn(node, sourceFile);
        const context = getContextFromParentNode(parent);

        violations.push({
          kind: 'inline-object',
          context: context.description,
          filePath: sourceFile.fileName,
          line,
          column,
        });
      }
    }

    // Recursively visit child nodes, passing current node as parent
    ts.forEachChild(node, (child) => visitNode(child, node));
  }

  visitNode(sourceFile);
  return violations;
}
