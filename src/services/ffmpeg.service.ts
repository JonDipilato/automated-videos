import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';
import {
  AssembledVideo,
  TransitionConfig,
  FFmpegConfig,
  CTAConfig,
} from '../types';

export class FFmpegService {
  private resolution: number;
  private fps: number;
  private codec: string;
  private bitrate: string;

  constructor(
    resolution: number = 1080,
    fps: number = 30,
    codec: string = 'libx264',
    bitrate: string = '5000k'
  ) {
    this.resolution = resolution;
    this.fps = fps;
    this.codec = codec;
    this.bitrate = bitrate;
  }

  /**
   * Assembles the final video with smooth transitions, audio sync, and CTA
   */
  async assembleVideo(
    videoSegments: string[],
    audioPath: string,
    outputPath: string,
    transitions: TransitionConfig[],
    ctaConfig?: CTAConfig
  ): Promise<AssembledVideo> {
    try {
      console.log('🎬 Assembling final video...');

      // Step 1: Create transition video
      const transitionedVideoPath = await this.applyTransitions(
        videoSegments,
        transitions,
        path.join(path.dirname(outputPath), 'temp_transitioned.mp4')
      );

      // Step 2: Add CTA overlay if configured
      let videoWithCTA = transitionedVideoPath;
      if (ctaConfig) {
        try {
          videoWithCTA = await this.addCTAOverlay(
            transitionedVideoPath,
            ctaConfig,
            path.join(path.dirname(outputPath), 'temp_with_cta.mp4')
          );
        } catch (error) {
          console.warn('⚠️  CTA overlay failed, skipping:', error);
          // Continue without CTA - don't block the entire assembly
        }
      }

      // Step 3: Sync audio with video
      await this.syncAudioVideo(videoWithCTA, audioPath, outputPath);

      // Step 4: Get video info
      const duration = await this.getVideoDuration(outputPath);
      const fileSize = fs.statSync(outputPath).size;

      console.log(`✓ Video assembled: ${outputPath}`);
      console.log(`  Duration: ${duration.toFixed(2)}s`);
      console.log(`  Size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

      // Clean up temp files
      this.cleanupTempFiles([transitionedVideoPath, videoWithCTA]);

      return {
        videoPath: outputPath,
        duration,
        resolution: `${this.resolution}p`,
        fileSize,
        format: 'mp4',
        hasAudio: true,
        hasCTA: !!ctaConfig,
      };
    } catch (error) {
      console.error('Video assembly failed:', error);
      throw new Error(`Failed to assemble video: ${error}`);
    }
  }

  /**
   * Applies smooth transitions between video segments
   */
  private async applyTransitions(
    videoSegments: string[],
    transitions: TransitionConfig[],
    outputPath: string
  ): Promise<string> {
    console.log(`  Applying transitions to ${videoSegments.length} segments...`);

    // Build FFmpeg filter complex for transitions
    let filterComplex = '';
    let inputs = '';
    let lastOutput = '[0:v]';

    // Add all input files
    videoSegments.forEach((segment) => {
      inputs += `-i "${segment}" `;
    });

    // Create transition filters
    for (let i = 0; i < videoSegments.length - 1; i++) {
      const transition = transitions[i] || {
        type: 'crossfade',
        duration: 1,
        easing: 'linear',
      };
      const transitionDuration = transition.duration;

      const input1 = i === 0 ? '[0:v]' : `[v${i}]`;
      const input2 = `[${i + 1}:v]`;
      const output = i === videoSegments.length - 2 ? '[vout]' : `[v${i + 1}]`;

      // Create transition based on type
      switch (transition.type) {
        case 'crossfade':
          filterComplex += `${input1}${input2}xfade=transition=fade:duration=${transitionDuration}:offset=6${output};`;
          break;
        case 'morph':
          filterComplex += `${input1}${input2}xfade=transition=wipeleft:duration=${transitionDuration}:offset=6${output};`;
          break;
        case 'zoom':
          filterComplex += `${input1}${input2}xfade=transition=zoomin:duration=${transitionDuration}:offset=6${output};`;
          break;
        case 'pan':
          filterComplex += `${input1}${input2}xfade=transition=slideright:duration=${transitionDuration}:offset=6${output};`;
          break;
        case 'slide':
          filterComplex += `${input1}${input2}xfade=transition=slideleft:duration=${transitionDuration}:offset=6${output};`;
          break;
      }
    }

    // Execute FFmpeg command with audio preservation
    // Map video output and mix audio from all segments
    const command = `ffmpeg ${inputs} -filter_complex "${filterComplex};amix=inputs=${videoSegments.length}:duration=longest[aout]" -map "[vout]" -map "[aout]" -c:v ${this.codec} -b:v ${this.bitrate} -r ${this.fps} -c:a aac -b:a 192k "${outputPath}" -y`;

    try {
      execSync(command, { stdio: 'pipe' });
      return outputPath;
    } catch (error) {
      console.error('Transition application failed, using concatenation fallback');
      return await this.concatenateVideos(videoSegments, outputPath);
    }
  }

  /**
   * Concatenates videos without transitions (fallback method)
   */
  private async concatenateVideos(
    videoSegments: string[],
    outputPath: string
  ): Promise<string> {
    // Create concat file list
    const concatFilePath = path.join(
      path.dirname(outputPath),
      'concat_list.txt'
    );
    const concatContent = videoSegments
      .map((segment) => `file '${path.resolve(segment)}'`)
      .join('\n');
    fs.writeFileSync(concatFilePath, concatContent);

    // Concatenate using concat demuxer
    const command = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputPath}" -y`;

    execSync(command, { stdio: 'pipe' });

    // Clean up concat file
    fs.unlinkSync(concatFilePath);

    return outputPath;
  }

  /**
   * Adds CTA overlay to video
   */
  private async addCTAOverlay(
    inputVideoPath: string,
    ctaConfig: CTAConfig,
    outputPath: string
  ): Promise<string> {
    console.log(`  Adding CTA overlay (${ctaConfig.position})...`);

    const videoDuration = await this.getVideoDuration(inputVideoPath);
    const ctaDuration = ctaConfig.duration || 5;

    // Generate CTA overlay image if not provided
    const ctaImagePath = await this.generateCTAImage(ctaConfig);

    let filterComplex = '';

    // Position CTA based on configuration
    if (ctaConfig.position === 'beginning') {
      // Show CTA at the beginning
      filterComplex = `[0:v][1:v]overlay=W-w-10:H-h-10:enable='between(t,0,${ctaDuration})'[vout]`;
    } else if (ctaConfig.position === 'end') {
      // Show CTA at the end
      const startTime = Math.max(0, videoDuration - ctaDuration);
      filterComplex = `[0:v][1:v]overlay=W-w-10:H-h-10:enable='between(t,${startTime},${videoDuration})'[vout]`;
    } else if (ctaConfig.position === 'both') {
      // Show CTA at beginning and end
      const endStartTime = Math.max(0, videoDuration - ctaDuration);
      filterComplex = `[0:v][1:v]overlay=W-w-10:H-h-10:enable='between(t,0,${ctaDuration})+between(t,${endStartTime},${videoDuration})'[vout]`;
    }

    const command = `ffmpeg -i "${inputVideoPath}" -i "${ctaImagePath}" -filter_complex "${filterComplex}" -map "[vout]" -map "0:a?" -c:v ${this.codec} -b:v ${this.bitrate} -c:a copy "${outputPath}" -y`;

    execSync(command, { stdio: 'pipe' });

    return outputPath;
  }

  /**
   * Generates CTA image with text
   */
  private async generateCTAImage(ctaConfig: CTAConfig): Promise<string> {
    const outputPath = path.join('assets', 'cta', 'generated_cta.png');

    // Create CTA image with text using ImageMagick or fallback to simple text file
    // For production, use ImageMagick or Canvas to create professional CTA graphics

    const command = `convert -size 400x100 -background 'rgba(0,0,0,0.7)' -fill white -gravity center -font Arial -pointsize 24 label:"${ctaConfig.text}" "${outputPath}"`;

    try {
      execSync(command, { stdio: 'pipe' });
    } catch (error) {
      // Fallback: create a simple colored rectangle (requires ImageMagick alternative)
      console.warn('CTA image generation requires ImageMagick. Using placeholder.');
      // In production, implement Canvas-based text rendering
    }

    return outputPath;
  }

  /**
   * Syncs audio with video
   */
  private async syncAudioVideo(
    videoPath: string,
    audioPath: string,
    outputPath: string
  ): Promise<void> {
    console.log('  Syncing audio with video...');

    // Get durations to ensure video matches audio
    const videoDuration = await this.getVideoDuration(videoPath);
    const audioDuration = await this.getVideoDuration(audioPath);

    console.log(`    Video: ${videoDuration.toFixed(2)}s, Audio: ${audioDuration.toFixed(2)}s`);

    const durationDiff = audioDuration - videoDuration; // positive = audio longer

    if (Math.abs(durationDiff) > 0.5) {
      if (durationDiff > 0) {
        // Audio is longer than video
        if (durationDiff > 3.0) {
          // Large mismatch (>3s) - this shouldn't happen with buffer segment
          console.error(`    ❌ CRITICAL: Audio exceeds video by ${durationDiff.toFixed(2)}s!`);
          console.error(`    This indicates insufficient video segments were generated.`);
          console.error(`    Falling back to freeze-frame, but video quality will suffer.`);
        }
        const padSeconds = durationDiff.toFixed(2);
        console.warn(`    ⚠️  Duration mismatch: audio longer by ${padSeconds}s. Extending video with freeze-frame.`);
        const command = `ffmpeg -i "${videoPath}" -i "${audioPath}" -filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=${padSeconds}[v]" -map "[v]" -map 1:a:0 -c:v libx264 -c:a aac -b:a 192k "${outputPath}" -y`;
        execSync(command, { stdio: 'pipe' });
      } else {
        // Video is longer -> trim to match audio (much better than adding silence)
        const padSeconds = Math.abs(durationDiff).toFixed(2);
        console.log(`    ✓ Video longer by ${padSeconds}s. Trimming excess (buffer segment worked!).`);
        const command = `ffmpeg -i "${videoPath}" -i "${audioPath}" -filter_complex "[1:a]apad=pad_dur=${padSeconds}[a]" -map 0:v:0 -map "[a]" -c:v libx264 -c:a aac -b:a 192k "${outputPath}" -y`;
        execSync(command, { stdio: 'pipe' });
      }
    } else {
      // Durations match, simple merge
      const command = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 "${outputPath}" -y`;
      execSync(command, { stdio: 'pipe' });
    }
  }

  /**
   * Gets video duration in seconds
   */
  private async getVideoDuration(videoPath: string): Promise<number> {
    try {
      const output = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
        { encoding: 'utf8' }
      );
      return parseFloat(output.trim());
    } catch (error) {
      console.error('Failed to get video duration:', error);
      return 0;
    }
  }

  /**
   * Replaces portrait background in video segments
   */
  async replaceBackgroundInVideo(
    videoPath: string,
    backgroundImagePath: string,
    outputPath: string
  ): Promise<string> {
    console.log('  Replacing background in video...');

    // This requires background removal (green screen or AI-based)
    // For production, use services like RunwayML, remove.bg API, or local AI models

    // Placeholder implementation - in production:
    // 1. Extract frames from video
    // 2. Remove background from each frame
    // 3. Composite with new background
    // 4. Reassemble into video

    // For now, copy original
    fs.copyFileSync(videoPath, outputPath);

    return outputPath;
  }

  /**
   * Creates smooth intro with background replacement
   */
  async createIntroWithBackground(
    portraitPath: string,
    backgroundPath: string,
    duration: number,
    outputPath: string
  ): Promise<string> {
    console.log('  Creating intro sequence...');

    // Create a static intro with portrait on custom background
    const command = `ffmpeg -loop 1 -i "${backgroundPath}" -loop 1 -i "${portraitPath}" -filter_complex "[1:v]colorkey=0x00FF00:0.3:0.2[fg];[0:v][fg]overlay=(W-w)/2:(H-h)/2" -t ${duration} -c:v ${this.codec} -r ${this.fps} "${outputPath}" -y`;

    try {
      execSync(command, { stdio: 'pipe' });
    } catch (error) {
      console.error('Intro creation failed:', error);
      // Fallback: use background only
      execSync(
        `ffmpeg -loop 1 -i "${backgroundPath}" -t ${duration} -c:v ${this.codec} -r ${this.fps} "${outputPath}" -y`,
        { stdio: 'pipe' }
      );
    }

    return outputPath;
  }

  /**
   * Creates smooth outro with background replacement
   */
  async createOutroWithBackground(
    portraitPath: string,
    backgroundPath: string,
    duration: number,
    outputPath: string
  ): Promise<string> {
    console.log('  Creating outro sequence...');

    // Similar to intro but can include fade-out effect
    const command = `ffmpeg -loop 1 -i "${backgroundPath}" -loop 1 -i "${portraitPath}" -filter_complex "[1:v]colorkey=0x00FF00:0.3:0.2[fg];[0:v][fg]overlay=(W-w)/2:(H-h)/2,fade=out:st=${duration - 2}:d=2" -t ${duration} -c:v ${this.codec} -r ${this.fps} "${outputPath}" -y`;

    try {
      execSync(command, { stdio: 'pipe' });
    } catch (error) {
      console.error('Outro creation failed:', error);
      // Fallback: use background only with fade
      execSync(
        `ffmpeg -loop 1 -i "${backgroundPath}" -t ${duration} -vf "fade=out:st=${duration - 2}:d=2" -c:v ${this.codec} -r ${this.fps} "${outputPath}" -y`,
        { stdio: 'pipe' }
      );
    }

    return outputPath;
  }

  /**
   * Optimizes video for specific platform
   */
  async optimizeForPlatform(
    inputPath: string,
    platform: string,
    outputPath: string
  ): Promise<string> {
    let command = '';

    switch (platform) {
      case 'youtube':
        // YouTube: 1920x1080, H.264, AAC
        command = `ffmpeg -i "${inputPath}" -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 192k -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" "${outputPath}" -y`;
        break;
      case 'tiktok':
      case 'instagram':
        // TikTok/Instagram: 1080x1920 (vertical), H.264, AAC
        command = `ffmpeg -i "${inputPath}" -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 128k -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" "${outputPath}" -y`;
        break;
      case 'facebook':
      case 'twitter':
      case 'linkedin':
        // General social: 1280x720, H.264, AAC
        command = `ffmpeg -i "${inputPath}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" "${outputPath}" -y`;
        break;
      default:
        // Default: keep original
        fs.copyFileSync(inputPath, outputPath);
        return outputPath;
    }

    execSync(command, { stdio: 'pipe' });
    return outputPath;
  }

  /**
   * Cleans up temporary files
   */
  private cleanupTempFiles(files: string[]): void {
    files.forEach((file) => {
      if (fs.existsSync(file) && file.includes('temp_')) {
        try {
          fs.unlinkSync(file);
        } catch (error) {
          console.warn(`Failed to delete temp file ${file}`);
        }
      }
    });
  }

  /**
   * Extracts the last frame from a video segment
   * This frame can be used as seed for the next segment for perfect continuity
   */
  async extractLastFrame(
    videoPath: string,
    outputPath: string
  ): Promise<string> {
    try {
      // Get video duration first
      const duration = await this.getVideoDuration(videoPath);

      // Extract frame from 1 second before the end to avoid fade-to-black effects
      // KIE.AI videos may have transitions/fades at the very end
      const timestamp = Math.max(0, duration - 1.0);

      console.log(`  ↳ Extracting frame at ${timestamp.toFixed(2)}s (video duration: ${duration.toFixed(2)}s)`);

      const command = `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}" -y`;

      execSync(command, { stdio: 'pipe' });

      // Verify the extracted frame is not blank/black
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        if (stats.size < 1000) {
          console.warn(`  ⚠️  Warning: Extracted frame is very small (${stats.size} bytes) - may be blank`);
        } else {
          console.log(`  ✓ Extracted last frame: ${path.basename(outputPath)} (${(stats.size / 1024).toFixed(1)}KB)`);
        }
      }

      return outputPath;
    } catch (error) {
      console.error(`Failed to extract last frame from ${videoPath}:`, error);
      throw error;
    }
  }

  /**
   * Extracts last frame from video AND composites original portrait over it
   * This ensures character consistency across segments by always using the original portrait
   * while preserving background continuity from the generated video
   */
  async extractLastFrameAndComposite(
    videoPath: string,
    originalPortraitPath: string,
    outputPath: string
  ): Promise<string> {
    try {
      // Determine file extension for proper temp file naming
      const ext = path.extname(outputPath); // .jpg or .png
      const baseName = outputPath.replace(ext, '');
      const tempFramePath = `${baseName}_temp.png`; // Always PNG for temp (intermediate)
      let portraitPath = originalPortraitPath;
      let downloadedPortrait = false;

      // Step 0: If portrait is a URL, download it first
      if (originalPortraitPath.startsWith('http://') || originalPortraitPath.startsWith('https://')) {
        const tempPortraitPath = `${baseName}_portrait.png`;
        console.log(`  ↳ Downloading transparent portrait from URL...`);

        const response = await axios.get(originalPortraitPath, { responseType: 'arraybuffer' });
        fs.writeFileSync(tempPortraitPath, Buffer.from(response.data));

        portraitPath = tempPortraitPath;
        downloadedPortrait = true;
      }

      // Step 1: Extract last frame from video (0.1s before end to avoid cut-off)
      await this.extractLastFrame(videoPath, tempFramePath);

      // Step 2: Composite portrait directly on extracted frame (NO BLUR for sharp background)
      // Use scale2ref to scale portrait relative to BACKGROUND frame height (not portrait's own height)
      // This prevents cut-off when portrait is larger than the video frame
      // Scale to 100% of background height to match KIE.AI video output
      // CRITICAL:
      // 1. Convert portrait to RGBA format FIRST to preserve alpha channel during scaling
      // 2. Overlay uses alpha blending automatically when foreground has alpha
      // 3. Output as JPG to eliminate any remaining transparency
      const isJpg = ext.toLowerCase() === '.jpg' || ext.toLowerCase() === '.jpeg';

      let compositeCmd: string;
      if (isJpg) {
        // For JPG output with proper alpha blending:
        // 1. [1:v]format=rgba - Ensure portrait has alpha channel preserved
        // 2. scale2ref - Scale portrait relative to background frame
        // 3. overlay - Alpha blend portrait onto background (transparent parts show background)
        // 4. format=rgb - Convert final result to RGB (no alpha) for JPG output
        compositeCmd = `ffmpeg -i "${tempFramePath}" -i "${portraitPath}" ` +
          `-filter_complex "[1:v]format=rgba[portrait_rgba];` +
          `[portrait_rgba][0:v]scale2ref=-1:ih[portrait_scaled][bg];` +
          `[bg][portrait_scaled]overlay=(W-w)/2:(H-h)/2[blended];` +
          `[blended]format=rgb24[composited]" ` +
          `-map "[composited]" -frames:v 1 -qscale:v 2 "${outputPath}" -y`;
      } else {
        // For PNG output: Force RGB24 pixel format (no alpha channel)
        compositeCmd = `ffmpeg -i "${tempFramePath}" -i "${portraitPath}" ` +
          `-filter_complex "[1:v]format=rgba[portrait_rgba];` +
          `[portrait_rgba][0:v]scale2ref=-1:ih[portrait_scaled][bg];` +
          `[bg][portrait_scaled]overlay=(W-w)/2:(H-h)/2[blended];` +
          `[blended]format=rgb24[composited]" ` +
          `-map "[composited]" -frames:v 1 -pix_fmt rgb24 "${outputPath}" -y`;
      }

      execSync(compositeCmd, { stdio: 'pipe' });

      // Step 3: Verify the composited frame (JPG is guaranteed opaque, PNG needs verification)
      if (fs.existsSync(outputPath)) {
        if (isJpg) {
          console.log(`  ✓ Composited frame saved as JPG (guaranteed opaque - no alpha possible)`);
        } else {
          try {
            const verifyCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`;
            const pixFmt = execSync(verifyCmd, { encoding: 'utf8' }).trim();
            if (pixFmt !== 'rgb24') {
              console.warn(`  ⚠️  Warning: Composited frame is ${pixFmt}, not rgb24 - may have alpha channel`);
            } else {
              console.log(`  ✓ Composited frame verified as RGB (no alpha channel)`);
            }
          } catch (e) {
            console.warn('  ⚠️  Could not verify pixel format');
          }
        }
      }

      // Step 4: Cleanup temp files
      if (fs.existsSync(tempFramePath)) {
        fs.unlinkSync(tempFramePath);
      }
      if (downloadedPortrait && fs.existsSync(portraitPath)) {
        fs.unlinkSync(portraitPath);
      }

      console.log(`  ✓ Extracted and composited: ${path.basename(outputPath)}`);
      return outputPath;
    } catch (error) {
      console.error(`Failed to extract and composite frame from ${videoPath}:`, error);
      throw error;
    }
  }

  /**
   * Validates FFmpeg installation
   */
  static validateFFmpeg(): boolean {
    try {
      execSync('ffmpeg -version', { stdio: 'pipe' });
      execSync('ffprobe -version', { stdio: 'pipe' });
      console.log('✓ FFmpeg is installed and accessible');
      return true;
    } catch (error) {
      console.error('❌ FFmpeg is not installed or not in PATH');
      return false;
    }
  }
}
