import * as ts from 'typescript';
import { TypeDefinition } from './types.js';
import { getLineAndColumn, isObjectLikeType, isExportedNode } from './parser-utils.js';

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
