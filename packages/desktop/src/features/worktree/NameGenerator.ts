import { ConfigManager } from './configManager';
import { randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const CITY_NAMES = [
  'tokyo', 'paris', 'london', 'berlin', 'madrid', 'rome', 'vienna', 'prague',
  'dublin', 'oslo', 'stockholm', 'helsinki', 'amsterdam', 'brussels', 'zurich',
  'lisbon', 'warsaw', 'budapest', 'athens', 'cairo', 'mumbai', 'delhi', 'bangkok',
  'singapore', 'seoul', 'sydney', 'melbourne', 'toronto', 'vancouver', 'montreal',
  'seattle', 'portland', 'denver', 'austin', 'chicago', 'boston', 'miami', 'atlanta',
  'phoenix', 'dallas', 'houston', 'detroit', 'minneapolis', 'nashville', 'orlando',
  'bucharest', 'sofia', 'belgrade', 'zagreb', 'sarajevo', 'tirana', 'skopje',
  'nairobi', 'lagos', 'accra', 'dakar', 'tunis', 'algiers', 'casablanca',
  'lima', 'bogota', 'quito', 'santiago', 'montevideo', 'havana', 'panama',
  'reykjavik', 'tallinn', 'riga', 'vilnius', 'minsk', 'kyiv', 'tbilisi', 'yerevan',
  'windhoek', 'kampala', 'harare', 'lusaka', 'maputo', 'gaborone', 'pretoria',
  'sparta', 'olympia', 'delphi', 'corinth', 'thebes', 'argos', 'rhodes', 'crete',
  'el-paso', 'santa-fe', 'tucson', 'reno', 'boise', 'helena', 'juneau', 'anchorage'
];

export class WorktreeNameGenerator {
  private configManager: ConfigManager;
  private static readonly SUFFIX_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'; // Crockford-ish base32 (lowercase), avoids i/l/o/u.

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  private toSlug(input: string): string {
    const base = String(input || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
    return base || 'workspace';
  }

  private randomSuffix(length = 7): string {
    const alphabet = WorktreeNameGenerator.SUFFIX_ALPHABET;
    const out: string[] = [];
    // `alphabet.length` is 32, so `byte & 31` is unbiased.
    const bytes = randomBytes(length);
    for (let i = 0; i < length; i++) {
      out.push(alphabet[bytes[i] & 31]);
    }
    return out.join('');
  }

  generateSessionName(): string {
    return this.generateRandomCityName();
  }

  private generateRandomCityName(): string {
    const randomIndex = Math.floor(Math.random() * CITY_NAMES.length);
    return CITY_NAMES[randomIndex];
  }

  generateWorktreeName(): string {
    return this.generateWorktreeNameFromSessionName(this.generateSessionName());
  }

  generateWorktreeNameFromSessionName(sessionName: string): string {
    const base = this.toSlug(sessionName);
    // Add a short random suffix to reduce collisions when creating many worktrees quickly.
    // Prefix with `w` to avoid looking like a commit hash.
    return `${base}-w${this.randomSuffix(7)}`;
  }

  async generateUniqueWorktreeName(): Promise<string> {
    const gitRepoPath = this.configManager.getGitRepoPath();
    const worktreesPath = path.join(gitRepoPath, 'worktrees');

    // Check if worktrees directory exists
    const worktreesDirExists = await fs.access(worktreesPath).then(() => true).catch(() => false);
    if (!worktreesDirExists) {
      return this.generateWorktreeName();
    }

    // Try generating unique names with random suffixes
    const maxAttempts = CITY_NAMES.length;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = this.generateWorktreeName();
      if (!(await this.worktreeExists(worktreesPath, candidate))) {
        return candidate;
      }
    }

    // Fallback: use timestamp to guarantee uniqueness
    return `${this.generateWorktreeName()}-${Date.now()}`;
  }

  private async worktreeExists(worktreesPath: string, name: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path.join(worktreesPath, name));
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}
