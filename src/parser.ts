import * as ts from 'typescript';
import { TypeUsage } from './types.js';
import { getLineAndColumn, getFunctionName } from './parser-utils.js';

// Re-export from other modules for backwards compatibility
export { getLineAndColumn, isObjectLikeType, isExportedNode, extendsOtherType, getFunctionName } from './parser-utils.js';
export { collectTypeDefinitions } from './type-definitions.js';
export { collectInlineObjectTypes } from './inline-types.js';

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

function extractFromTypeReference(typeNode: ts.TypeReferenceNode): string[] {
  const typeNames: string[] = [];
  const name = extractTypeNameFromReference(typeNode);
  if (name) typeNames.push(name);
  if (typeNode.typeArguments) {
    for (const arg of typeNode.typeArguments) {
      typeNames.push(...extractAllTypeNames(arg));
    }
  }
  return typeNames;
}

function extractAllTypeNames(typeNode: ts.TypeNode | undefined): string[] {
  if (!typeNode) return [];

  if (ts.isTypeReferenceNode(typeNode)) {
    return extractFromTypeReference(typeNode);
  }
  if (ts.isArrayTypeNode(typeNode)) {
    return extractAllTypeNames(typeNode.elementType);
  }
  if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
    return typeNode.types.flatMap(extractAllTypeNames);
  }
  return [];
}

interface UsageContext {
  sourceFile: ts.SourceFile;
  addUsage: (typeName: string, usage: TypeUsage) => void;
  functionName?: string;
}

function processFunctionParameters(node: ts.FunctionLikeDeclaration, context: UsageContext): void {
  for (const param of node.parameters) {
    const typeNames = extractAllTypeNames(param.type);
    for (const typeName of typeNames) {
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

function processFunctionReturnType(node: ts.FunctionLikeDeclaration, context: UsageContext): void {
  const typeNames = extractAllTypeNames(node.type);
  for (const typeName of typeNames) {
    const { line } = getLineAndColumn(node.type!, context.sourceFile);
    context.addUsage(typeName, {
      typeName,
      usageContext: 'function-return',
      functionName: context.functionName,
      filePath: context.sourceFile.fileName,
      line,
    });
  }
}

function processVariableType(node: ts.VariableDeclaration, context: UsageContext): void {
  const typeNames = extractAllTypeNames(node.type);
  for (const typeName of typeNames) {
    const { line } = getLineAndColumn(node, context.sourceFile);
    context.addUsage(typeName, {
      typeName,
      usageContext: 'variable',
      filePath: context.sourceFile.fileName,
      line,
    });
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

function extractHeritageTypeName(expr: ts.ExpressionWithTypeArguments): string | null {
  if (ts.isIdentifier(expr.expression)) {
    return expr.expression.text;
  }
  return null;
}

function processInterfaceHeritage(node: ts.InterfaceDeclaration, context: UsageContext): void {
  const interfaceName = node.name.text;
  if (!node.heritageClauses) return;

  for (const clause of node.heritageClauses) {
    for (const type of clause.types) {
      const typeName = extractHeritageTypeName(type);
      if (typeName) {
        const { line } = getLineAndColumn(type, context.sourceFile);
        context.addUsage(typeName, {
          typeName,
          usageContext: 'property',
          functionName: interfaceName,
          filePath: context.sourceFile.fileName,
          line,
        });
      }
    }
  }
}

function processInterfaceProperties(node: ts.InterfaceDeclaration, context: UsageContext): void {
  const interfaceName = node.name.text;
  for (const member of node.members) {
    if (ts.isPropertySignature(member) && member.type) {
      const typeNames = extractAllTypeNames(member.type);
      for (const typeName of typeNames) {
        const { line } = getLineAndColumn(member, context.sourceFile);
        context.addUsage(typeName, {
          typeName,
          usageContext: 'property',
          functionName: interfaceName,
          filePath: context.sourceFile.fileName,
          line,
        });
      }
    }
  }
}

function processInterface(node: ts.InterfaceDeclaration, context: UsageContext): void {
  processInterfaceHeritage(node, context);
  processInterfaceProperties(node, context);
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
  const baseContext: UsageContext = { sourceFile, addUsage };

  function processNode(node: ts.Node): void {
    if (isFunctionLike(node)) {
      processFunctionNode(node, currentFunctionName, baseContext);
    }
    if (ts.isVariableDeclaration(node)) {
      processVariableType(node, baseContext);
    }
    if (ts.isInterfaceDeclaration(node)) {
      processInterface(node, baseContext);
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
