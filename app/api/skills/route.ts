import { NextResponse } from 'next/server';
import { skillsManager } from '@/lib/services/skillsManager';

/**
 * GET /api/skills
 *
 * List all available SDK-native skills from .claude/skills/
 */
export async function GET() {
  try {
    const skills = await skillsManager.listAvailableSkills();

    return NextResponse.json({
      skills,
      count: skills.length,
      location: '.claude/skills/'
    });
  } catch (error) {
    console.error('Failed to list skills:', error);
    return NextResponse.json(
      { error: 'Failed to load skills' },
      { status: 500 }
    );
  }
}
