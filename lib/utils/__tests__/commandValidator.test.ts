/**
 * Unit tests for Command Validator
 */

import {
  validateBashCommand,
  containsBlockedCommand,
  sanitizeCommand,
  parseCommandTokens,
  getAllowedCommands,
  getBlockedCommands,
} from '../commandValidator';

describe('commandValidator', () => {
  describe('validateBashCommand', () => {
    // Test allowed commands
    it('should allow safe read-only commands', () => {
      const result = validateBashCommand('ls /project');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('ls /project');
    });

    it('should allow grep with patterns', () => {
      const result = validateBashCommand('grep "error" /project/logs.txt');
      expect(result.valid).toBe(true);
    });

    it('should allow find with predicates', () => {
      const result = validateBashCommand('find /project -name "*.ts" -type f');
      expect(result.valid).toBe(true);
    });

    it('should allow jq for JSON processing', () => {
      const result = validateBashCommand('cat /project/data.json | jq ".items[]"');
      expect(result.valid).toBe(true);
    });

    it('should allow pipes between allowed commands', () => {
      const result = validateBashCommand('cat /project/file.txt | grep pattern | wc -l');
      expect(result.valid).toBe(true);
    });

    it('should allow command chaining with &&', () => {
      const result = validateBashCommand('ls /project && cat README.md');
      expect(result.valid).toBe(true);
    });

    it('should allow command chaining with ||', () => {
      const result = validateBashCommand('test -f /project/file.txt || echo "not found"');
      expect(result.valid).toBe(true);
    });

    it('should allow redirect to /scratch', () => {
      const result = validateBashCommand('echo "test" > /scratch/output.txt');
      expect(result.valid).toBe(true);
    });

    it('should allow append to /scratch', () => {
      const result = validateBashCommand('echo "line" >> /scratch/log.txt');
      expect(result.valid).toBe(true);
    });

    // Test blocked commands
    it('should block rm command', () => {
      const result = validateBashCommand('rm -rf /project');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('rm');
    });

    it('should block mv command', () => {
      const result = validateBashCommand('mv file.txt backup.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mv');
    });

    it('should allow mkdir in scratch directory', () => {
      const result = validateBashCommand('mkdir /scratch/newdir');
      expect(result.valid).toBe(true);
    });

    it('should block mkdir outside scratch directory', () => {
      const result = validateBashCommand('mkdir /project/newdir');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('scratch');
    });

    it('should block sudo command', () => {
      const result = validateBashCommand('sudo apt-get install package');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('sudo');
    });

    it('should block ssh command', () => {
      const result = validateBashCommand('ssh user@host');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ssh');
    });

    it('should block npm command', () => {
      const result = validateBashCommand('npm install package');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('npm');
    });

    // Test dangerous patterns
    it('should block command substitution with $()', () => {
      const result = validateBashCommand('echo $(ls /project)');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Command substitution');
    });

    it('should block command substitution with backticks', () => {
      const result = validateBashCommand('echo `ls /project`');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('backticks');
    });

    it('should block redirect to non-scratch directory', () => {
      const result = validateBashCommand('echo "test" > /project/file.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('scratch');
    });

    it('should block append to non-scratch directory', () => {
      const result = validateBashCommand('echo "test" >> /etc/hosts');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('scratch');
    });

    // Test empty commands
    it('should reject empty command', () => {
      const result = validateBashCommand('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject whitespace-only command', () => {
      const result = validateBashCommand('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    // Test unknown commands
    it('should block unknown commands by default', () => {
      const result = validateBashCommand('unknowncommand');
      expect(result.valid).toBe(false);
    });

    // Test complex scenarios
    it('should handle complex piped command with multiple stages', () => {
      const result = validateBashCommand(
        'cat /project/data.txt | grep "error" | sort | uniq -c | head -10'
      );
      expect(result.valid).toBe(true);
    });

    it('should handle quoted arguments correctly', () => {
      const result = validateBashCommand('grep "search term with spaces" /project/file.txt');
      expect(result.valid).toBe(true);
    });

    it('should handle single-quoted arguments', () => {
      const result = validateBashCommand("grep 'pattern' /project/file.txt");
      expect(result.valid).toBe(true);
    });
  });

  describe('containsBlockedCommand', () => {
    it('should detect blocked command in simple string', () => {
      expect(containsBlockedCommand('rm file.txt')).toBe(true);
    });

    it('should detect blocked command in piped string', () => {
      expect(containsBlockedCommand('cat file.txt | rm -rf /')).toBe(true);
    });

    it('should detect blocked command with sudo', () => {
      expect(containsBlockedCommand('sudo ls')).toBe(true);
    });

    it('should not detect blocked command in allowed string', () => {
      expect(containsBlockedCommand('ls /project')).toBe(false);
    });

    it('should detect blocked command in complex chain', () => {
      expect(containsBlockedCommand('ls && rm file.txt')).toBe(true);
    });
  });

  describe('sanitizeCommand', () => {
    it('should trim whitespace', () => {
      expect(sanitizeCommand('  ls /project  ')).toBe('ls /project');
    });

    it('should remove null bytes', () => {
      expect(sanitizeCommand('ls\0/project')).toBe('ls/project');
    });

    it('should remove carriage returns but preserve newlines', () => {
      // Carriage returns removed, newlines preserved for heredoc support
      expect(sanitizeCommand('ls\r\n/project')).toBe('ls\n/project');
    });

    it('should normalize multiple spaces', () => {
      expect(sanitizeCommand('ls    /project')).toBe('ls /project');
    });

    it('should preserve single spaces', () => {
      expect(sanitizeCommand('ls /project')).toBe('ls /project');
    });

    it('should handle empty string', () => {
      expect(sanitizeCommand('')).toBe('');
    });
  });

  describe('heredoc commands', () => {
    it('should allow python with heredoc', () => {
      const command = `python3 << 'EOF'
import json
print(json.dumps({"test": "works"}))
EOF`;
      const result = validateBashCommand(command);
      expect(result.valid).toBe(true);
    });

    it('should allow bash with heredoc', () => {
      const command = `bash << 'SCRIPT'
echo "hello"
echo "world"
SCRIPT`;
      const result = validateBashCommand(command);
      expect(result.valid).toBe(true);
    });

    it('should allow python3 with heredoc using <<- operator', () => {
      const command = `python3 <<- 'PYEOF'
	import sys
	print("hello from python")
	PYEOF`;
      const result = validateBashCommand(command);
      expect(result.valid).toBe(true);
    });

    it('should allow cat with heredoc redirecting to scratch', () => {
      const command = `cat << 'EOF' > /scratch/output.txt
line 1
line 2
EOF`;
      const result = validateBashCommand(command);
      expect(result.valid).toBe(true);
    });

    it('should allow node with heredoc', () => {
      const command = `node << 'JS'
console.log(JSON.stringify({result: 42}));
JS`;
      const result = validateBashCommand(command);
      expect(result.valid).toBe(true);
    });

    it('should block heredoc with disallowed command', () => {
      const command = `npm << 'EOF'
install express
EOF`;
      const result = validateBashCommand(command);
      expect(result.valid).toBe(false);
    });

    it('should handle heredoc with double-quoted delimiter', () => {
      const command = `python3 << "EOF"
print("test")
EOF`;
      const result = validateBashCommand(command);
      expect(result.valid).toBe(true);
    });

    it('should handle heredoc with unquoted delimiter', () => {
      const command = `python3 << EOF
print("test")
EOF`;
      const result = validateBashCommand(command);
      expect(result.valid).toBe(true);
    });

    it('should preserve newlines in sanitized heredoc command', () => {
      const command = `python3 << 'EOF'
import json
print("hello")
EOF`;
      const sanitized = sanitizeCommand(command);
      expect(sanitized).toContain('\n');
      expect(sanitized.split('\n').length).toBe(4);
    });
  });

  describe('parseCommandTokens', () => {
    it('should parse simple command', () => {
      const tokens = parseCommandTokens('ls /project');
      expect(tokens).toEqual(['ls', '/project']);
    });

    it('should parse command with flags', () => {
      const tokens = parseCommandTokens('ls -la /project');
      expect(tokens).toEqual(['ls', '-la', '/project']);
    });

    it('should preserve quoted strings', () => {
      const tokens = parseCommandTokens('grep "search term" file.txt');
      expect(tokens).toEqual(['grep', '"search term"', 'file.txt']);
    });

    it('should preserve single-quoted strings', () => {
      const tokens = parseCommandTokens("grep 'pattern' file.txt");
      expect(tokens).toEqual(['grep', "'pattern'", 'file.txt']);
    });

    it('should handle escaped characters', () => {
      const tokens = parseCommandTokens('echo hello\\ world');
      expect(tokens).toEqual(['echo', 'hello world']);
    });

    it('should parse piped commands', () => {
      const tokens = parseCommandTokens('cat file.txt | grep pattern');
      expect(tokens).toEqual(['cat', 'file.txt', '|', 'grep', 'pattern']);
    });

    it('should handle empty string', () => {
      const tokens = parseCommandTokens('');
      expect(tokens).toEqual([]);
    });

    it('should handle multiple spaces', () => {
      const tokens = parseCommandTokens('ls    /project');
      expect(tokens).toEqual(['ls', '/project']);
    });
  });

  describe('getAllowedCommands', () => {
    it('should return array of allowed commands', () => {
      const commands = getAllowedCommands();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
    });

    it('should include common commands', () => {
      const commands = getAllowedCommands();
      expect(commands).toContain('ls');
      expect(commands).toContain('cat');
      expect(commands).toContain('grep');
      expect(commands).toContain('find');
    });

    it('should be sorted alphabetically', () => {
      const commands = getAllowedCommands();
      const sorted = [...commands].sort();
      expect(commands).toEqual(sorted);
    });
  });

  describe('getBlockedCommands', () => {
    it('should return array of blocked commands', () => {
      const commands = getBlockedCommands();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
    });

    it('should include dangerous commands', () => {
      const commands = getBlockedCommands();
      expect(commands).toContain('rm');
      expect(commands).toContain('sudo');
      expect(commands).toContain('ssh');
    });

    it('should be sorted alphabetically', () => {
      const commands = getBlockedCommands();
      const sorted = [...commands].sort();
      expect(commands).toEqual(sorted);
    });
  });
});
