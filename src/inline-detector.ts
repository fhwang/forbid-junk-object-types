import * as ts from 'typescript';
import { InlineObjectViolation } from './types.js';
import { getLineAndColumn, getFunctionName } from './parser.js';

interface NodeContext {
  description: string;
  functionName?: string;
}

interface NodeWithParent extends ts.Node {
  parent?: ts.Node;
}

function isEmptyObjectType(node: ts.TypeLiteralNode): boolean {
  return node.members.length === 0;
}

function getParameterContext(parent: ts.Node): NodeContext | null {
  if (!ts.isParameter(parent)) return null;
  const func = parent.parent;
  const funcName = func && ts.isFunctionLike(func) ? getFunctionName(func) : undefined;
  return { description: 'function parameter', functionName: funcName };
}

function getFunctionReturnContext(parent: ts.Node): NodeContext | null {
  if (!ts.isFunctionLike(parent)) return null;
  return { description: 'function return type', functionName: getFunctionName(parent) };
}

function getDeclarationContext(parent: ts.Node): NodeContext | null {
  if (ts.isVariableDeclaration(parent)) {
    return { description: 'variable declaration' };
  }
  if (ts.isPropertyDeclaration(parent)) {
    return { description: 'property declaration' };
  }
  if (ts.isTypeAliasDeclaration(parent) || ts.isInterfaceDeclaration(parent)) {
    return { description: 'nested in type definition' };
  }
  if (ts.isAsExpression(parent) || ts.isTypeAssertionExpression(parent)) {
    return { description: 'type assertion' };
  }
  return null;
}

function getContextFromParentNode(parent: ts.Node | undefined): NodeContext {
  if (!parent) {
    return { description: 'unknown context' };
  }

  const paramContext = getParameterContext(parent);
  if (paramContext) return paramContext;

  const returnContext = getFunctionReturnContext(parent);
  if (returnContext) return returnContext;

  const declContext = getDeclarationContext(parent);
  if (declContext) return declContext;

  return getContextFromParentNode(parent.parent);
}

export function collectInlineObjectViolations(
  sourceFile: ts.SourceFile
): InlineObjectViolation[] {
  const violations: InlineObjectViolation[] = [];

  function visitNode(node: ts.Node, parent?: ts.Node): void {
    const nodeWithParent = node as NodeWithParent;
    nodeWithParent.parent = parent;

    if (ts.isTypeLiteralNode(node)) {
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

    ts.forEachChild(node, (child) => visitNode(child, node));
  }

  visitNode(sourceFile);
  return violations;
}
