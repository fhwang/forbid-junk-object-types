import * as ts from 'typescript';
import { LineAndColumn } from './types.js';

export function getLineAndColumn(node: ts.Node, sourceFile: ts.SourceFile): LineAndColumn {
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
