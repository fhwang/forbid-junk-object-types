import { execSync } from 'child_process';
import * as path from 'path';

export function getChangedFiles(repoRoot: string, targetDir: string): string[] {
  try {
    const output = execSync('git diff --name-only origin/main...HEAD', {
      encoding: 'utf-8',
      cwd: repoRoot,
    });

    const allChangedFiles = output
      .trim()
      .split('\n')
      .filter(Boolean);

    const targetDirRelative = path.relative(repoRoot, targetDir);

    const tsFiles = allChangedFiles
      .filter(file => file.startsWith(targetDirRelative))
      .filter(file => (file.endsWith('.ts') || file.endsWith('.tsx')))
      .filter(file => !file.includes('.test.') && !file.includes('.spec.') && !file.endsWith('.d.ts'))
      .map(file => path.join(repoRoot, file));

    return tsFiles;
  } catch (error) {
    console.warn('Warning: Could not determine changed files, checking all files');
    console.warn(`Error: ${(error as Error).message}`);
    return [];
  }
}

function isGitRepo(dir: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function findRepoRoot(startDir: string): string {
  let currentDir = startDir;
  const maxDepth = 10;

  for (let depth = 0; depth < maxDepth; depth++) {
    if (isGitRepo(currentDir)) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  throw new Error('Not in a git repository');
}
