import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

export interface CaptionStyle {
  position: 'top' | 'center' | 'bottom';
  yPosition?: number; // Custom Y position (percentage from top, 0-100)
  fontSize: number; // Font size in pixels
  fontName: string; // Font family
  primaryColor: string; // Main text color (hex)
  outlineColor: string; // Outline/shadow color (hex)
  outlineWidth: number; // Outline thickness
  backgroundColor?: string; // Optional box background (hex with alpha)
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  maxWordsPerLine: number; // Words per caption line
}

export const YOUTUBE_SHORTS_STYLE: CaptionStyle = {
  position: 'center',
  yPosition: 70, // 70% from top = 30% from bottom (safe zone above bottom UI)
  fontSize: 16, // Optimized for 560x560 video
  fontName: 'Arial-Bold',
  primaryColor: '#FFFFFF',
  outlineColor: '#000000',
  outlineWidth: 1.5,
  backgroundColor: 'rgba(0,0,0,0.5)', // More transparent background
  bold: true,
  italic: false,
  uppercase: true,
  maxWordsPerLine: 2, // Fewer words per line for smaller screen
};

export const TIKTOK_STYLE: CaptionStyle = {
  position: 'center',
  yPosition: 60,
  fontSize: 80,
  fontName: 'Arial-Bold',
  primaryColor: '#FFFF00', // Yellow for high visibility
  outlineColor: '#000000',
  outlineWidth: 4,
  bold: true,
  italic: false,
  uppercase: true,
  maxWordsPerLine: 2,
};

/**
 * Captions service for generating word-level subtitles optimized for short-form video
 */
export class CaptionsService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate word-level timestamps using Whisper AI
   */
  async generateWordTimestamps(audioPath: string): Promise<CaptionWord[]> {
    console.log('🎯 Generating word-level timestamps with Whisper...');

    try {
      // Use Whisper API to get word-level timestamps
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
      });

      if (!transcription.words || transcription.words.length === 0) {
        throw new Error('No word-level timestamps returned from Whisper');
      }

      const words: CaptionWord[] = transcription.words.map((w: any) => ({
        word: w.word.trim(),
        start: w.start,
        end: w.end,
      }));

      console.log(`✓ Generated ${words.length} word timestamps`);
      return words;
    } catch (error) {
      console.error('Whisper transcription failed:', error);
      throw new Error(`Failed to generate word timestamps: ${error}`);
    }
  }

  /**
   * Generate SRT subtitle file with word-level timing
   */
  generateSRT(
    words: CaptionWord[],
    style: CaptionStyle,
    outputPath: string
  ): void {
    console.log('📝 Generating SRT file...');

    let srtContent = '';
    let index = 1;

    // Group words into chunks based on maxWordsPerLine
    for (let i = 0; i < words.length; i += style.maxWordsPerLine) {
      const chunk = words.slice(i, i + style.maxWordsPerLine);
      const text = chunk.map((w) => w.word).join(' ');
      const start = chunk[0].start;
      const end = chunk[chunk.length - 1].end;

      // Convert seconds to SRT timestamp format (HH:MM:SS,mmm)
      const formatTime = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
      };

      srtContent += `${index}\n`;
      srtContent += `${formatTime(start)} --> ${formatTime(end)}\n`;
      srtContent += `${style.uppercase ? text.toUpperCase() : text}\n`;
      srtContent += '\n';

      index++;
    }

    fs.writeFileSync(outputPath, srtContent, 'utf-8');
    console.log(`✓ SRT file created: ${outputPath}`);
  }

  /**
   * Burn captions into video with YouTube Shorts optimized styling
   */
  async addCaptionsToVideo(
    inputVideoPath: string,
    srtPath: string,
    outputVideoPath: string,
    style: CaptionStyle = YOUTUBE_SHORTS_STYLE
  ): Promise<void> {
    console.log('🔥 Burning captions into video...');

    // Calculate Y position based on percentage
    const yPos = style.yPosition || (style.position === 'top' ? 10 : style.position === 'bottom' ? 90 : 50);

    // Escape path for Windows - replace backslashes with forward slashes and escape colons
    const escapedSrtPath = srtPath
      .replace(/\\/g, '/')
      .replace(/:/g, '\\\\:');

    // Build FFmpeg subtitle filter with advanced styling
    const subtitlesFilter = `subtitles=${escapedSrtPath}:force_style='Fontname=${style.fontName},FontSize=${style.fontSize},PrimaryColour=&H${this.hexToAss(style.primaryColor)},OutlineColour=&H${this.hexToAss(style.outlineColor)},OutLine=${style.outlineWidth},Bold=${style.bold ? -1 : 0},Italic=${style.italic ? -1 : 0},Alignment=2,MarginV=${100 - yPos}${style.backgroundColor ? `,BackColour=&H${this.hexToAssWithAlpha(style.backgroundColor)}` : ''}'`;

    const command = `ffmpeg -i "${inputVideoPath}" -vf "${subtitlesFilter}" -c:a copy "${outputVideoPath}" -y`;

    try {
      execSync(command, { stdio: 'pipe' });
      console.log(`✓ Captions burned into video: ${outputVideoPath}`);
    } catch (error) {
      console.error('Failed to burn captions:', error);
      throw new Error(`Caption burning failed: ${error}`);
    }
  }

  /**
   * Convert hex color to ASS subtitle format (BGR with alpha)
   */
  private hexToAss(hex: string): string {
    // Remove # if present
    hex = hex.replace('#', '');

    // Convert RGB to BGR for ASS format
    const r = hex.substring(0, 2);
    const g = hex.substring(2, 4);
    const b = hex.substring(4, 6);

    return `00${b}${g}${r}`.toUpperCase();
  }

  /**
   * Convert hex color with alpha to ASS format
   */
  private hexToAssWithAlpha(rgba: string): string {
    // Parse rgba(r,g,b,a) format
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return '00000000';

    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    const a = match[4] ? Math.floor((1 - parseFloat(match[4])) * 255).toString(16).padStart(2, '0') : '00';

    return `${a}${b}${g}${r}`.toUpperCase();
  }

  /**
   * Complete workflow: Generate timestamps, create SRT, and burn captions
   */
  async addCaptionsWorkflow(
    videoPath: string,
    audioPath: string,
    outputVideoPath: string,
    style: CaptionStyle = YOUTUBE_SHORTS_STYLE
  ): Promise<void> {
    try {
      // Generate word-level timestamps
      const words = await this.generateWordTimestamps(audioPath);

      // Create SRT file
      const srtPath = path.join(
        path.dirname(videoPath),
        `${path.basename(videoPath, path.extname(videoPath))}.srt`
      );
      this.generateSRT(words, style, srtPath);

      // Burn captions into video
      await this.addCaptionsToVideo(videoPath, srtPath, outputVideoPath, style);

      console.log('✅ Captions workflow completed successfully!');
    } catch (error) {
      console.error('❌ Captions workflow failed:', error);
      throw error;
    }
  }
}
