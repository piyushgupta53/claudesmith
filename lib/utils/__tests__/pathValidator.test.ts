/**
 * Unit tests for Path Validator
 */

import {
  validateReadPath,
  validateWritePath,
  normalizePath,
  isInDirectory,
  getDirectory,
  getFilename,
  joinPaths,
  isAbsolutePath,
  makeAbsolute,
  getReadAllowedDirectories,
  getWriteAllowedDirectories,
  validateAndNormalizePath,
} from '../pathValidator';

describe('pathValidator', () => {
  describe('normalizePath', () => {
    it('should remove . from path', () => {
      expect(normalizePath('/project/./file.txt')).toBe('/project/file.txt');
    });

    it('should resolve .. in path', () => {
      expect(normalizePath('/project/subdir/../file.txt')).toBe('/project/file.txt');
    });

    it('should handle trailing slashes', () => {
      // Note: path.posix.normalize preserves trailing slashes
      expect(normalizePath('/project/subdir/')).toBe('/project/subdir/');
    });

    it('should remove redundant slashes', () => {
      expect(normalizePath('/project//subdir///file.txt')).toBe('/project/subdir/file.txt');
    });

    it('should prepend / to relative paths', () => {
      expect(normalizePath('project/file.txt')).toBe('/project/file.txt');
    });

    it('should handle root path', () => {
      expect(normalizePath('/')).toBe('/');
    });

    it('should handle complex path traversal', () => {
      expect(normalizePath('/project/../project/./file.txt')).toBe('/project/file.txt');
    });
  });

  describe('isInDirectory', () => {
    it('should return true for exact directory match', () => {
      expect(isInDirectory('/project', '/project')).toBe(true);
    });

    it('should return true for file in directory', () => {
      expect(isInDirectory('/project/file.txt', '/project')).toBe(true);
    });

    it('should return true for nested subdirectories', () => {
      expect(isInDirectory('/project/subdir/file.txt', '/project')).toBe(true);
    });

    it('should return false for different directory', () => {
      expect(isInDirectory('/etc/hosts', '/project')).toBe(false);
    });

    it('should return false for similarly named directory', () => {
      expect(isInDirectory('/project2/file.txt', '/project')).toBe(false);
    });

    it('should handle path traversal attempts', () => {
      expect(isInDirectory('/project/../etc/hosts', '/project')).toBe(false);
    });
  });

  describe('validateReadPath', () => {
    // Valid read paths
    it('should allow reading from /project', () => {
      const result = validateReadPath('/project/README.md');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('/project/README.md');
    });

    it('should allow reading from /scratch', () => {
      const result = validateReadPath('/scratch/output.txt');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('/scratch/output.txt');
    });

    it('should allow reading from /skills', () => {
      const result = validateReadPath('/skills/data-analysis/SKILL.md');
      expect(result.valid).toBe(true);
    });

    it('should allow reading from subdirectories', () => {
      const result = validateReadPath('/project/src/components/Button.tsx');
      expect(result.valid).toBe(true);
    });

    // Path traversal attacks
    it('should block path traversal with ..', () => {
      const result = validateReadPath('/project/../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('system directory');
    });

    it('should block path traversal from allowed dir', () => {
      const result = validateReadPath('/scratch/../../etc/hosts');
      expect(result.valid).toBe(false);
    });

    it('should block complex path traversal', () => {
      const result = validateReadPath('/project/subdir/../../etc/passwd');
      expect(result.valid).toBe(false);
    });

    // Blocked directories
    it('should block reading from /etc', () => {
      const result = validateReadPath('/etc/hosts');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('system directory');
    });

    it('should block reading from /var', () => {
      const result = validateReadPath('/var/log/syslog');
      expect(result.valid).toBe(false);
    });

    it('should block reading from /root', () => {
      const result = validateReadPath('/root/.bashrc');
      expect(result.valid).toBe(false);
    });

    // Unauthorized directories
    it('should block reading from unauthorized directory', () => {
      const result = validateReadPath('/home/user/file.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not in allowed directories');
    });

    // Empty path
    it('should reject empty path', () => {
      const result = validateReadPath('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject whitespace-only path', () => {
      const result = validateReadPath('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('validateWritePath', () => {
    // Valid write paths
    it('should allow writing to /scratch', () => {
      const result = validateWritePath('/scratch/output.txt');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('/scratch/output.txt');
    });

    it('should allow writing to /scratch subdirectories', () => {
      const result = validateWritePath('/scratch/results/data.json');
      expect(result.valid).toBe(true);
    });

    // Blocked write operations
    it('should block writing to /project', () => {
      const result = validateWritePath('/project/file.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('only allowed in /scratch');
    });

    it('should block writing to /skills', () => {
      const result = validateWritePath('/skills/custom/skill.md');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('only allowed in /scratch');
    });

    it('should block writing to system directories', () => {
      const result = validateWritePath('/etc/config.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('system directory');
    });

    it('should block writing to /tmp', () => {
      const result = validateWritePath('/tmp/file.txt');
      expect(result.valid).toBe(false);
    });

    // Path traversal in write
    it('should block path traversal in write', () => {
      const result = validateWritePath('/scratch/../project/file.txt');
      expect(result.valid).toBe(false);
    });

    // Empty path
    it('should reject empty write path', () => {
      const result = validateWritePath('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('getDirectory', () => {
    it('should extract directory from file path', () => {
      expect(getDirectory('/project/src/file.txt')).toBe('/project/src');
    });

    it('should handle root directory', () => {
      expect(getDirectory('/file.txt')).toBe('/');
    });

    it('should normalize path before extracting', () => {
      expect(getDirectory('/project/subdir/../file.txt')).toBe('/project');
    });

    it('should handle directory path', () => {
      expect(getDirectory('/project/src')).toBe('/project');
    });
  });

  describe('getFilename', () => {
    it('should extract filename from path', () => {
      expect(getFilename('/project/src/file.txt')).toBe('file.txt');
    });

    it('should handle root file', () => {
      expect(getFilename('/file.txt')).toBe('file.txt');
    });

    it('should normalize path before extracting', () => {
      expect(getFilename('/project/./file.txt')).toBe('file.txt');
    });

    it('should handle directory name', () => {
      expect(getFilename('/project/src')).toBe('src');
    });
  });

  describe('joinPaths', () => {
    it('should join two path segments', () => {
      expect(joinPaths('/project', 'file.txt')).toBe('/project/file.txt');
    });

    it('should join multiple segments', () => {
      expect(joinPaths('/project', 'src', 'components', 'Button.tsx')).toBe(
        '/project/src/components/Button.tsx'
      );
    });

    it('should handle leading slashes in segments', () => {
      expect(joinPaths('/project', '/src/file.txt')).toBe('/project/src/file.txt');
    });

    it('should normalize result', () => {
      expect(joinPaths('/project', './src', 'file.txt')).toBe('/project/src/file.txt');
    });

    it('should handle empty segments', () => {
      expect(joinPaths('/project', '', 'file.txt')).toBe('/project/file.txt');
    });
  });

  describe('isAbsolutePath', () => {
    it('should return true for absolute path', () => {
      expect(isAbsolutePath('/project/file.txt')).toBe(true);
    });

    it('should return false for relative path', () => {
      expect(isAbsolutePath('project/file.txt')).toBe(false);
    });

    it('should return false for current directory', () => {
      expect(isAbsolutePath('./file.txt')).toBe(false);
    });

    it('should return false for parent directory', () => {
      expect(isAbsolutePath('../file.txt')).toBe(false);
    });
  });

  describe('makeAbsolute', () => {
    it('should leave absolute paths unchanged', () => {
      expect(makeAbsolute('/project/file.txt')).toBe('/project/file.txt');
    });

    it('should prepend default base to relative path', () => {
      expect(makeAbsolute('file.txt')).toBe('/scratch/file.txt');
    });

    it('should use custom base path', () => {
      expect(makeAbsolute('file.txt', '/project')).toBe('/project/file.txt');
    });

    it('should normalize result', () => {
      expect(makeAbsolute('./subdir/file.txt', '/scratch')).toBe('/scratch/subdir/file.txt');
    });

    it('should handle .. in relative path', () => {
      expect(makeAbsolute('../file.txt', '/scratch/subdir')).toBe('/scratch/file.txt');
    });
  });

  describe('getReadAllowedDirectories', () => {
    it('should return array of allowed read directories', () => {
      const dirs = getReadAllowedDirectories();
      expect(Array.isArray(dirs)).toBe(true);
      expect(dirs).toContain('/project');
      expect(dirs).toContain('/scratch');
      expect(dirs).toContain('/skills');
    });

    it('should return a copy (not reference)', () => {
      const dirs1 = getReadAllowedDirectories();
      const dirs2 = getReadAllowedDirectories();
      expect(dirs1).toEqual(dirs2);
      expect(dirs1).not.toBe(dirs2);
    });
  });

  describe('getWriteAllowedDirectories', () => {
    it('should return array with only /scratch', () => {
      const dirs = getWriteAllowedDirectories();
      expect(Array.isArray(dirs)).toBe(true);
      expect(dirs).toEqual(['/scratch']);
    });

    it('should return a copy (not reference)', () => {
      const dirs1 = getWriteAllowedDirectories();
      const dirs2 = getWriteAllowedDirectories();
      expect(dirs1).toEqual(dirs2);
      expect(dirs1).not.toBe(dirs2);
    });
  });

  describe('validateAndNormalizePath', () => {
    it('should validate read operation', () => {
      const result = validateAndNormalizePath('/project/file.txt', 'read');
      expect(result.valid).toBe(true);
    });

    it('should validate write operation', () => {
      const result = validateAndNormalizePath('/scratch/file.txt', 'write');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid read path', () => {
      const result = validateAndNormalizePath('/etc/hosts', 'read');
      expect(result.valid).toBe(false);
    });

    it('should reject invalid write path', () => {
      const result = validateAndNormalizePath('/project/file.txt', 'write');
      expect(result.valid).toBe(false);
    });
  });
});
