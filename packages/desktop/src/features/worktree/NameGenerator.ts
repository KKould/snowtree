import { ConfigManager } from './configManager';
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

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  generateSessionName(): string {
    return this.generateRandomCityName();
  }

  private generateRandomCityName(): string {
    const randomIndex = Math.floor(Math.random() * CITY_NAMES.length);
    return CITY_NAMES[randomIndex];
  }

  generateWorktreeName(): string {
    return this.generateSessionName().toLowerCase();
  }

  async generateUniqueWorktreeName(): Promise<string> {
    const gitRepoPath = this.configManager.getGitRepoPath();
    const worktreesPath = path.join(gitRepoPath, 'worktrees');

    let baseName = this.generateWorktreeName();
    let uniqueName = baseName;
    let counter = 1;
    let attempts = 0;
    const maxAttempts = CITY_NAMES.length;

    try {
      await fs.access(worktreesPath);

      while (await this.worktreeExists(worktreesPath, uniqueName)) {
        if (counter > 1) {
          baseName = this.generateWorktreeName();
          uniqueName = baseName;
          counter = 1;
          attempts++;
          if (attempts >= maxAttempts) {
            uniqueName = `${baseName}-${Date.now()}`;
            break;
          }
        } else {
          uniqueName = `${baseName}-${counter}`;
          counter++;
        }
      }
    } catch {
      // worktrees directory doesn't exist yet
    }

    return uniqueName;
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
