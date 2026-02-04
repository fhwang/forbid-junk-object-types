import * as ts from 'typescript';
import { InlineTypeViolation } from './types.js';
import { getLineAndColumn } from './parser-utils.js';

function isGenericConstraint(node: ts.TypeLiteralNode): boolean {
  let current: ts.Node = node;
  while (current.parent) {
    const parent = current.parent;
    if (ts.isTypeParameterDeclaration(parent) && parent.constraint === current) {
      return true;
    }
    current = parent;
  }
  return false;
}

function getParameterContext(parent: ts.ParameterDeclaration): string {
  if (ts.isObjectBindingPattern(parent.name)) {
    return 'destructured parameter';
  }
  const paramName = ts.isIdentifier(parent.name) ? parent.name.text : 'unknown';
  return `parameter '${paramName}'`;
}

function getPropertyContext(parent: ts.PropertySignature | ts.PropertyDeclaration): string | null {
  return ts.isIdentifier(parent.name) ? `property '${parent.name.text}'` : null;
}

function getInlineTypeContext(node: ts.TypeLiteralNode): string | null {
  const parent = node.parent;
  if (!parent) return null;

  if (ts.isParameter(parent)) return getParameterContext(parent);
  if (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent) ||
      ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) return 'return type';
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return `variable '${parent.name.text}'`;
  if (ts.isAsExpression(parent)) return 'type assertion';
  if (ts.isTypeReferenceNode(parent) && parent.typeArguments?.includes(node)) return 'generic argument';
  if (ts.isPropertySignature(parent)) return getPropertyContext(parent);
  if (ts.isPropertyDeclaration(parent)) return getPropertyContext(parent);

  return null;
}

export function collectInlineObjectTypes(sourceFile: ts.SourceFile): InlineTypeViolation[] {
  const violations: InlineTypeViolation[] = [];

  function visit(node: ts.Node): void {
    if (ts.isTypeLiteralNode(node)) {
      if (isGenericConstraint(node)) {
        ts.forEachChild(node, visit);
        return;
      }

      const context = getInlineTypeContext(node);
      if (context) {
        const { line, column } = getLineAndColumn(node, sourceFile);
        violations.push({
          filePath: sourceFile.fileName,
          line,
          column,
          context,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}
