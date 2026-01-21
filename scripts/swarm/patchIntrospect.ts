/**
 * patchIntrospect.ts - Parse unified diff patches to extract metadata
 * 
 * Used for Context Escalation: when a patch fails to apply due to dependency
 * context issues, we need to know which files are touched and what imports
 * are referenced in new files.
 */

export interface PatchMetadata {
  touchedFiles: string[];      // All files mentioned in diff --git a/... b/...
  newFiles: string[];           // Files with "new file mode" 
  modifiedFiles: string[];      // Touched files minus new files
  deletedFiles: string[];       // Files with "deleted file mode"
  newFileContents: Record<string, string>; // Content of new files (for import parsing)
}

/**
 * Parse a unified diff patch and extract metadata
 */
export function introspectPatch(patchContent: string): PatchMetadata {
  const lines = patchContent.split('\n');
  
  const touchedFiles: string[] = [];
  const newFiles: string[] = [];
  const deletedFiles: string[] = [];
  const newFileContents: Record<string, string> = {};
  
  let currentFile: string | null = null;
  let isNewFile = false;
  let isDeletedFile = false;
  let collectingContent = false;
  let contentLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // diff --git a/path/to/file.ts b/path/to/file.ts
    if (line.startsWith('diff --git ')) {
      // Save previous file content if we were collecting
      if (currentFile && collectingContent && contentLines.length > 0) {
        newFileContents[currentFile] = contentLines.join('\n');
      }
      
      // Extract file path from "b/..." (the "after" version)
      const match = line.match(/b\/(.+)$/);
      if (match) {
        currentFile = match[1];
        touchedFiles.push(currentFile);
        isNewFile = false;
        isDeletedFile = false;
        collectingContent = false;
        contentLines = [];
      }
    }
    
    // new file mode 100644
    else if (line.startsWith('new file mode') && currentFile) {
      isNewFile = true;
      newFiles.push(currentFile);
      collectingContent = true;
    }
    
    // deleted file mode 100644
    else if (line.startsWith('deleted file mode') && currentFile) {
      isDeletedFile = true;
      deletedFiles.push(currentFile);
    }
    
    // Collect content lines for new files (lines starting with +)
    else if (collectingContent && line.startsWith('+') && !line.startsWith('+++')) {
      // Remove the leading '+' to get actual content
      contentLines.push(line.substring(1));
    }
  }
  
  // Save last file content if we were collecting
  if (currentFile && collectingContent && contentLines.length > 0) {
    newFileContents[currentFile] = contentLines.join('\n');
  }
  
  // Modified files = touched - new - deleted
  const modifiedFiles = touchedFiles.filter(
    f => !newFiles.includes(f) && !deletedFiles.includes(f)
  );
  
  return {
    touchedFiles,
    newFiles,
    modifiedFiles,
    deletedFiles,
    newFileContents,
  };
}

/**
 * Parse import statements from TypeScript/JavaScript content
 * Returns array of import paths (e.g., ["./utils", "../config", "zod"])
 */
export function parseImports(content: string): string[] {
  const imports: string[] = [];
  
  // Match: import ... from "path" or import ... from 'path'
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  // Match: require("path") or require('path')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

/**
 * Resolve a relative import path to an absolute repo path
 * @param fromFile - The file doing the importing (e.g., "server/utils/validateEmail.ts")
 * @param importPath - The import path (e.g., "./config", "../types")
 * @returns Resolved path (e.g., "server/utils/config.ts")
 */
export function resolveImportPath(fromFile: string, importPath: string): string | null {
  // Skip non-relative imports (npm packages)
  if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
    return null;
  }
  
  // Get directory of the importing file
  const parts = fromFile.split('/');
  parts.pop(); // Remove filename
  const dir = parts.join('/');
  
  // Resolve relative path
  const resolved = resolveRelativePath(dir, importPath);
  
  // Try common extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    // We'll validate existence later when reading snapshots
    return candidate;
  }
  
  return resolved;
}

/**
 * Helper: resolve relative path segments
 */
function resolveRelativePath(base: string, relative: string): string {
  const baseParts = base.split('/').filter(p => p);
  const relativeParts = relative.split('/').filter(p => p);
  
  for (const part of relativeParts) {
    if (part === '..') {
      baseParts.pop();
    } else if (part !== '.') {
      baseParts.push(part);
    }
  }
  
  return baseParts.join('/');
}
