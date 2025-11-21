import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  ContentFingerprint,
  DuplicateCheckResult,
  Platform,
} from '../types';

// Simple in-memory implementation - in production, use SQLite or PostgreSQL
export class DuplicateDetector {
  private contentDatabase: Map<string, ContentFingerprint>;
  private databasePath: string;

  constructor(databasePath: string = './data/content.db.json') {
    this.databasePath = databasePath;
    this.contentDatabase = new Map();
    this.loadDatabase();
  }

  /**
   * Checks if content is duplicate before publishing
   * This is CRITICAL for monetization compliance
   */
  async checkForDuplicates(
    title: string,
    description: string,
    script: string,
    storyOutline: string
  ): Promise<DuplicateCheckResult> {
    console.log('🔍 Checking for duplicate content...');

    // Generate hashes for comparison
    const scriptHash = this.generateHash(script);
    const storyHash = this.generateHash(storyOutline);

    // Check exact hash matches first (fastest)
    for (const [id, content] of this.contentDatabase) {
      // Exact script match = duplicate
      if (content.scriptHash === scriptHash) {
        return {
          isDuplicate: true,
          similarityScore: 1.0,
          matchedContent: content,
          reason: 'Exact script match found',
        };
      }

      // Exact story outline match = duplicate
      if (content.storyOutlineHash === storyHash) {
        return {
          isDuplicate: true,
          similarityScore: 1.0,
          matchedContent: content,
          reason: 'Exact story outline match found',
        };
      }
    }

    // Check title similarity (semantic)
    for (const [id, content] of this.contentDatabase) {
      const titleSimilarity = this.calculateSimilarity(title, content.title);

      if (titleSimilarity > 0.85) {
        return {
          isDuplicate: true,
          similarityScore: titleSimilarity,
          matchedContent: content,
          reason: `Title too similar (${(titleSimilarity * 100).toFixed(1)}% match)`,
        };
      }
    }

    // Check description similarity
    for (const [id, content] of this.contentDatabase) {
      const descSimilarity = this.calculateSimilarity(
        description,
        content.description
      );

      if (descSimilarity > 0.80) {
        return {
          isDuplicate: true,
          similarityScore: descSimilarity,
          matchedContent: content,
          reason: `Description too similar (${(descSimilarity * 100).toFixed(1)}% match)`,
        };
      }
    }

    console.log('✓ Content is unique');

    return {
      isDuplicate: false,
      similarityScore: 0,
    };
  }

  /**
   * Registers new content in the database
   */
  async registerContent(
    title: string,
    description: string,
    script: string,
    storyOutline: string,
    platforms: Platform[]
  ): Promise<ContentFingerprint> {
    const id = crypto.randomUUID();
    const scriptHash = this.generateHash(script);
    const storyOutlineHash = this.generateHash(storyOutline);

    const fingerprint: ContentFingerprint = {
      id,
      title,
      description,
      scriptHash,
      storyOutlineHash,
      createdAt: new Date(),
      platforms,
      publishedUrls: new Map(),
    };

    this.contentDatabase.set(id, fingerprint);
    await this.saveDatabase();

    console.log(`✓ Content registered: ${id}`);

    return fingerprint;
  }

  /**
   * Updates published URLs for content
   */
  async updatePublishedUrls(
    contentId: string,
    platform: Platform,
    url: string
  ): Promise<void> {
    const content = this.contentDatabase.get(contentId);
    if (content) {
      content.publishedUrls.set(platform, url);
      await this.saveDatabase();
    }
  }

  /**
   * Generates SHA-256 hash of content
   */
  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Calculates similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Normalize strings
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    // Quick checks
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);

    // Convert distance to similarity score (0-1)
    return 1 - distance / maxLength;
  }

  /**
   * Calculates Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculates cosine similarity for more advanced semantic comparison
   */
  private calculateCosineSimilarity(str1: string, str2: string): number {
    // Simple word-based cosine similarity
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    // Create word frequency maps
    const freq1 = this.getWordFrequency(words1);
    const freq2 = this.getWordFrequency(words2);

    // Get all unique words
    const allWords = new Set([...words1, ...words2]);

    // Calculate dot product and magnitudes
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const word of allWords) {
      const f1 = freq1.get(word) || 0;
      const f2 = freq2.get(word) || 0;

      dotProduct += f1 * f2;
      magnitude1 += f1 * f1;
      magnitude2 += f2 * f2;
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Gets word frequency map
   */
  private getWordFrequency(words: string[]): Map<string, number> {
    const freq = new Map<string, number>();

    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }

    return freq;
  }

  /**
   * Loads database from file
   */
  private loadDatabase(): void {
    try {
      const dir = path.dirname(this.databasePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.databasePath)) {
        const data = fs.readFileSync(this.databasePath, 'utf8');
        const parsed = JSON.parse(data);

        // Convert array back to Map
        for (const item of parsed) {
          const fingerprint: ContentFingerprint = {
            ...item,
            createdAt: new Date(item.createdAt),
            publishedUrls: new Map(Object.entries(item.publishedUrls || {})),
          };
          this.contentDatabase.set(fingerprint.id, fingerprint);
        }

        console.log(`✓ Loaded ${this.contentDatabase.size} content fingerprints`);
      }
    } catch (error) {
      console.warn('Could not load database, starting fresh:', error);
    }
  }

  /**
   * Saves database to file
   */
  private async saveDatabase(): Promise<void> {
    try {
      const dir = path.dirname(this.databasePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Convert Map to array for JSON serialization
      const array = Array.from(this.contentDatabase.values()).map((item) => ({
        ...item,
        publishedUrls: Object.fromEntries(item.publishedUrls),
      }));

      fs.writeFileSync(this.databasePath, JSON.stringify(array, null, 2));
    } catch (error) {
      console.error('Failed to save database:', error);
    }
  }

  /**
   * Gets all registered content
   */
  getAllContent(): ContentFingerprint[] {
    return Array.from(this.contentDatabase.values());
  }

  /**
   * Gets content by ID
   */
  getContentById(id: string): ContentFingerprint | undefined {
    return this.contentDatabase.get(id);
  }

  /**
   * Deletes content from database
   */
  async deleteContent(id: string): Promise<boolean> {
    const deleted = this.contentDatabase.delete(id);
    if (deleted) {
      await this.saveDatabase();
    }
    return deleted;
  }

  /**
   * Clears all content (use with caution!)
   */
  async clearAll(): Promise<void> {
    this.contentDatabase.clear();
    await this.saveDatabase();
    console.log('⚠️  All content cleared from database');
  }

  /**
   * Gets statistics about content database
   */
  getStatistics(): {
    totalContent: number;
    platformCounts: Map<Platform, number>;
    oldestContent?: Date;
    newestContent?: Date;
  } {
    const platformCounts = new Map<Platform, number>();
    let oldestDate: Date | undefined;
    let newestDate: Date | undefined;

    for (const content of this.contentDatabase.values()) {
      // Count platforms
      for (const platform of content.platforms) {
        platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1);
      }

      // Track dates
      if (!oldestDate || content.createdAt < oldestDate) {
        oldestDate = content.createdAt;
      }
      if (!newestDate || content.createdAt > newestDate) {
        newestDate = content.createdAt;
      }
    }

    return {
      totalContent: this.contentDatabase.size,
      platformCounts,
      oldestContent: oldestDate,
      newestContent: newestDate,
    };
  }
}
