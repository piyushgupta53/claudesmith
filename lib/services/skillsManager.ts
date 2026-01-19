/**
 * Skills Manager Service
 *
 * Manages agent skills - SDK-native skill modules
 * Loads skills from .claude/skills/ directory (SDK-compliant location)
 *
 * SDK-native skills use YAML frontmatter with a 'description' field
 * that determines when Claude invokes the skill automatically.
 */

import fs from 'fs/promises';
import path from 'path';

export interface SkillInfo {
  name: string;
  description: string;
  category: string;
  path: string;
}

export interface SkillContent {
  name: string;
  markdown: string;
  purpose: string;
  metadata: {
    sections: string[];
    wordCount: number;
    hasExamples: boolean;
    frontmatter?: Record<string, string>;
  };
}

/**
 * Parse YAML frontmatter from SKILL.md content
 * SDK-native skills use YAML frontmatter with 'description' field
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlContent = match[1];
  const body = match[2];
  const frontmatter: Record<string, string> = {};

  // Simple YAML parsing for key: value pairs
  const lines = yamlContent.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

/**
 * Skills Manager singleton class
 *
 * Scans .claude/skills/ for SDK-native skill definitions
 */
class SkillsManager {
  private skillsDir: string;
  private skills: Map<string, SkillInfo> = new Map();
  private initialized: boolean = false;

  constructor() {
    // SDK-native skills are in .claude/skills directory
    this.skillsDir = path.join(process.cwd(), '.claude', 'skills');
  }

  /**
   * Initialize skills manager by scanning skills directory
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Read skills directory
      const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });

      // Find all skill directories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillName = entry.name;
          const skillPath = path.join(this.skillsDir, skillName);
          const skillFile = path.join(skillPath, 'SKILL.md');

          try {
            // Check if SKILL.md exists
            await fs.access(skillFile);

            // Read skill file content
            const content = await fs.readFile(skillFile, 'utf-8');

            // Parse YAML frontmatter for SDK-native skills
            const { frontmatter, body } = parseFrontmatter(content);

            // Get description from frontmatter (SDK-native) or fallback to Purpose section
            let description = frontmatter.description || '';

            if (!description) {
              // Fallback: Extract purpose from markdown body
              const lines = body.split('\n');
              for (let i = 0; i < Math.min(lines.length, 20); i++) {
                if (lines[i].startsWith('## Purpose')) {
                  description = lines[i + 1]?.trim() || '';
                  break;
                }
              }
            }

            // Categorize skill
            const category = this.categorizeSkill(skillName);

            // Store skill info
            this.skills.set(skillName, {
              name: skillName,
              description: description || `${skillName} skill`,
              category,
              path: skillPath
            });
          } catch (error) {
            // Skip if SKILL.md doesn't exist
            console.warn(`Skill ${skillName} missing SKILL.md`);
          }
        }
      }

      this.initialized = true;
    } catch (error: any) {
      console.error('Failed to initialize skills manager:', error.message);
      // Don't throw - gracefully handle missing skills directory
    }
  }

  /**
   * Categorize skill based on name
   */
  private categorizeSkill(name: string): string {
    const categories: Record<string, string> = {
      'data-analysis': 'analysis',
      'code-review': 'code',
      'research': 'research',
      'scripting': 'code',
      'debugging': 'code',
      'testing': 'code',
      'documentation': 'research',
      'deployment': 'operations'
    };

    return categories[name] || 'general';
  }

  /**
   * Get list of available skills
   */
  async listAvailableSkills(): Promise<SkillInfo[]> {
    await this.initialize();
    return Array.from(this.skills.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  /**
   * Load full skill content
   */
  async loadSkill(name: string): Promise<SkillContent> {
    await this.initialize();

    const skillInfo = this.skills.get(name);
    if (!skillInfo) {
      throw new Error(`Skill '${name}' not found`);
    }

    const skillFile = path.join(skillInfo.path, 'SKILL.md');

    try {
      const rawContent = await fs.readFile(skillFile, 'utf-8');

      // Parse YAML frontmatter for SDK-native skills
      const { frontmatter, body } = parseFrontmatter(rawContent);

      // Parse markdown body to extract metadata
      const lines = body.split('\n');
      const sections: string[] = [];
      let purpose = frontmatter.description || '';
      const wordCount = body.split(/\s+/).length;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Extract sections
        if (line.startsWith('## ')) {
          const section = line.substring(3).trim();
          sections.push(section);

          // Extract purpose from body if not in frontmatter
          if (!purpose && section === 'Purpose' && i + 1 < lines.length) {
            purpose = lines[i + 1].trim();
          }
        }
      }

      // Check if has examples
      const hasExamples = body.toLowerCase().includes('example');

      return {
        name,
        markdown: body, // Return body without frontmatter for content
        purpose: purpose || skillInfo.description,
        metadata: {
          sections,
          wordCount,
          hasExamples,
          frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : undefined
        }
      };
    } catch (error: any) {
      throw new Error(`Failed to load skill '${name}': ${error.message}`);
    }
  }

  /**
   * Get absolute path to skill directory
   */
  async getSkillPath(name: string): Promise<string> {
    await this.initialize();

    const skillInfo = this.skills.get(name);
    if (!skillInfo) {
      throw new Error(`Skill '${name}' not found`);
    }

    return skillInfo.path;
  }

  /**
   * Validate skill structure
   */
  async validateSkill(name: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const skillInfo = this.skills.get(name);
      if (!skillInfo) {
        errors.push(`Skill '${name}' not found`);
        return { valid: false, errors };
      }

      // Check SKILL.md exists
      const skillFile = path.join(skillInfo.path, 'SKILL.md');
      try {
        await fs.access(skillFile);
      } catch {
        errors.push(`Missing SKILL.md file`);
      }

      // Load and check content
      if (errors.length === 0) {
        const content = await this.loadSkill(name);

        // Check for required sections
        const requiredSections = ['Purpose', 'When to Use'];
        for (const section of requiredSections) {
          if (!content.metadata.sections.includes(section)) {
            errors.push(`Missing required section: ${section}`);
          }
        }

        // Check minimum content length
        if (content.metadata.wordCount < 100) {
          errors.push(`Skill content too short (${content.metadata.wordCount} words)`);
        }
      }
    } catch (error: any) {
      errors.push(`Validation error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get skills by category
   */
  async getSkillsByCategory(category: string): Promise<SkillInfo[]> {
    const allSkills = await this.listAvailableSkills();
    return allSkills.filter(skill => skill.category === category);
  }

  /**
   * Search skills by keyword
   */
  async searchSkills(keyword: string): Promise<SkillInfo[]> {
    const allSkills = await this.listAvailableSkills();
    const lowerKeyword = keyword.toLowerCase();

    return allSkills.filter(skill =>
      skill.name.toLowerCase().includes(lowerKeyword) ||
      skill.description.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Get skill count
   */
  async getSkillCount(): Promise<number> {
    await this.initialize();
    return this.skills.size;
  }
}

// Export singleton instance
export const skillsManager = new SkillsManager();
export default skillsManager;
