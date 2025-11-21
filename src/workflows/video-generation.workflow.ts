import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  VideoGenerationConfig,
  VideoGenerationResult,
  WorkflowState,
  TransitionConfig,
} from '../types';
import { OpenAIService } from '../services/openai.service';
import { GrokService } from '../services/grok.service';
import { ElevenLabsService } from '../services/elevenlabs.service';
import { FFmpegService } from '../services/ffmpeg.service';
import { DuplicateDetector } from '../services/duplicate-detector';
import { SocialMediaService } from '../services/social-media.service';

export class VideoGenerationWorkflow {
  private openai: OpenAIService;
  private grok: GrokService;
  private elevenlabs: ElevenLabsService;
  private ffmpeg: FFmpegService;
  private duplicateDetector: DuplicateDetector;
  private socialMedia: SocialMediaService;
  private workDir: string;

  constructor(
    openai: OpenAIService,
    grok: GrokService,
    elevenlabs: ElevenLabsService,
    ffmpeg: FFmpegService,
    duplicateDetector: DuplicateDetector,
    socialMedia: SocialMediaService,
    workDir: string = './output'
  ) {
    this.openai = openai;
    this.grok = grok;
    this.elevenlabs = elevenlabs;
    this.ffmpeg = ffmpeg;
    this.duplicateDetector = duplicateDetector;
    this.socialMedia = socialMedia;
    this.workDir = workDir;
  }

  /**
   * MASTER WORKFLOW: Generates complete video from seed portrait
   * Implements AUDIO-FIRST APPROACH
   */
  async generateVideo(
    config: VideoGenerationConfig
  ): Promise<VideoGenerationResult> {
    const jobId = uuidv4();
    const state: WorkflowState = {
      jobId,
      status: 'initializing',
      progress: 0,
      currentStep: 'Initializing workflow',
      startTime: new Date(),
    };

    try {
      console.log('🚀 Starting Automated Video Generation Workflow');
      console.log(`📋 Job ID: ${jobId}`);
      console.log(`🎯 Topic: ${config.topic}`);
      console.log(`🎨 Platforms: ${config.targetPlatforms.join(', ')}`);
      console.log('');

      // Create job-specific directories
      const jobDir = path.join(this.workDir, jobId);
      const audioDir = path.join(jobDir, 'audio');
      const videoDir = path.join(jobDir, 'videos');
      const imageDir = path.join(jobDir, 'images');
      const finalDir = path.join(jobDir, 'final');

      this.createDirectories([jobDir, audioDir, videoDir, imageDir, finalDir]);

      // ========================================
      // STEP 1: Generate Script with OpenAI
      // ========================================
      state.status = 'generating_script';
      state.currentStep = 'Generating script and story outline';
      state.progress = 10;
      this.logProgress(state);

      const scriptGeneration = await this.openai.generateScript(
        config.topic,
        config.maxVideoLength || 60
      );

      console.log(`✓ Script generated (${scriptGeneration.estimatedDuration}s estimated)`);
      console.log('');

      // ========================================
      // STEP 2: Generate Audio FIRST (Audio-First Approach)
      // ========================================
      state.status = 'generating_audio';
      state.currentStep = 'Generating audio narration (Audio-First)';
      state.progress = 20;
      this.logProgress(state);

      const audioPath = path.join(audioDir, 'narration.mp3');
      const audioGeneration = await this.elevenlabs.generateAudio(
        scriptGeneration.script,
        audioPath,
        config.videoSegmentDuration
      );

      console.log(`✓ Audio generated: ${audioGeneration.duration.toFixed(2)}s`);
      console.log(`✓ Video segments needed: ${audioGeneration.segmentCount}`);
      console.log('');

      // ========================================
      // STEP 3: Check for Duplicate Content
      // ========================================
      state.currentStep = 'Checking for duplicate content';
      state.progress = 25;
      this.logProgress(state);

      // Generate initial metadata for duplicate check
      const metadataList = await this.openai.generatePlatformMetadata(
        scriptGeneration,
        config.targetPlatforms
      );

      const duplicateCheck = await this.duplicateDetector.checkForDuplicates(
        metadataList[0]?.title || '',
        metadataList[0]?.description || '',
        scriptGeneration.script,
        scriptGeneration.storyOutline
      );

      if (duplicateCheck.isDuplicate) {
        throw new Error(
          `Duplicate content detected: ${duplicateCheck.reason}. Please try a different topic or angle.`
        );
      }

      console.log('✓ Content is unique - safe for monetization');
      console.log('');

      // ========================================
      // STEP 4: Generate Grok Prompts
      // ========================================
      state.currentStep = 'Generating Grok prompts for visuals';
      state.progress = 30;
      this.logProgress(state);

      const portraitDescription = `Portrait from ${config.seedPortrait}`;
      const grokPrompts = await this.openai.generateGrokPrompts(
        scriptGeneration,
        audioGeneration.segmentCount,
        portraitDescription
      );

      console.log(`✓ Generated ${grokPrompts.length} Grok prompts`);
      console.log('');

      // ========================================
      // STEP 5: Generate Background Images
      // ========================================
      state.status = 'generating_visuals';
      state.currentStep = 'Generating background images';
      state.progress = 40;
      this.logProgress(state);

      const backgrounds = await this.grok.generateBackgrounds(
        grokPrompts,
        imageDir
      );

      console.log(`✓ Generated ${backgrounds.size} background images`);
      console.log('');

      // ========================================
      // STEP 6: Generate Video Segments with Grok
      // ========================================
      state.currentStep = 'Generating video segments';
      state.progress = 50;
      this.logProgress(state);

      console.log('🎥 Generating video segments (this may take a while)...');
      const videoSegments = await this.grok.generateVideoSegments(
        grokPrompts,
        config.seedPortrait,
        videoDir,
        true // parallel generation
      );

      const successfulSegments = videoSegments.filter(
        (seg) => seg.status === 'completed'
      );

      if (successfulSegments.length === 0) {
        throw new Error('No video segments were successfully generated');
      }

      console.log(
        `✓ Generated ${successfulSegments.length}/${videoSegments.length} video segments`
      );
      console.log('');

      // ========================================
      // STEP 7: Create Intro/Outro with Background Replacement
      // ========================================
      state.currentStep = 'Creating intro and outro sequences';
      state.progress = 70;
      this.logProgress(state);

      const introPath = path.join(videoDir, 'intro.mp4');
      const outroPath = path.join(videoDir, 'outro.mp4');

      // Get first and last backgrounds for intro/outro
      const firstBg = backgrounds.get(0);
      const lastBg = backgrounds.get(grokPrompts.length - 1);

      if (firstBg) {
        await this.ffmpeg.createIntroWithBackground(
          config.seedPortrait,
          firstBg,
          3, // 3 second intro
          introPath
        );
      }

      if (lastBg) {
        await this.ffmpeg.createOutroWithBackground(
          config.seedPortrait,
          lastBg,
          3, // 3 second outro
          outroPath
        );
      }

      console.log('✓ Created intro and outro sequences');
      console.log('');

      // ========================================
      // STEP 8: Assemble Final Video
      // ========================================
      state.status = 'assembling_video';
      state.currentStep = 'Assembling final video with transitions';
      state.progress = 80;
      this.logProgress(state);

      // Prepare video segments in order (intro + segments + outro)
      const allSegments: string[] = [];
      if (fs.existsSync(introPath)) allSegments.push(introPath);

      successfulSegments
        .sort((a, b) => a.prompt.segmentIndex - b.prompt.segmentIndex)
        .forEach((seg) => {
          if (fs.existsSync(seg.videoUrl)) {
            allSegments.push(seg.videoUrl);
          }
        });

      if (fs.existsSync(outroPath)) allSegments.push(outroPath);

      // Create transitions
      const transitions: TransitionConfig[] = [];
      for (let i = 0; i < allSegments.length - 1; i++) {
        transitions.push({
          type: grokPrompts[i]?.transitionType || 'crossfade',
          duration: config.transitionDuration,
          easing: 'easeInOut',
        });
      }

      // Assemble video
      const finalVideoPath = path.join(finalDir, 'final_video.mp4');
      const assembledVideo = await this.ffmpeg.assembleVideo(
        allSegments,
        audioPath,
        finalVideoPath,
        transitions,
        config.ctaConfig
      );

      console.log('✓ Video assembled successfully');
      console.log(`  Path: ${assembledVideo.videoPath}`);
      console.log(`  Duration: ${assembledVideo.duration.toFixed(2)}s`);
      console.log(`  Size: ${(assembledVideo.fileSize / 1024 / 1024).toFixed(2)}MB`);
      console.log('');

      // ========================================
      // STEP 9: Generate Final Metadata
      // ========================================
      state.status = 'generating_metadata';
      state.currentStep = 'Generating platform-optimized metadata';
      state.progress = 90;
      this.logProgress(state);

      // Regenerate metadata if needed (ensures uniqueness)
      const finalMetadata = await this.openai.generatePlatformMetadata(
        scriptGeneration,
        config.targetPlatforms
      );

      console.log(`✓ Generated metadata for ${finalMetadata.length} platforms`);
      console.log('');

      // ========================================
      // STEP 10: Register Content (Prevent Future Duplicates)
      // ========================================
      state.currentStep = 'Registering content fingerprint';
      state.progress = 92;
      this.logProgress(state);

      const contentFingerprint = await this.duplicateDetector.registerContent(
        finalMetadata[0]?.title || '',
        finalMetadata[0]?.description || '',
        scriptGeneration.script,
        scriptGeneration.storyOutline,
        config.targetPlatforms
      );

      console.log('✓ Content registered in database');
      console.log('');

      // ========================================
      // STEP 11: Publish to Social Media
      // ========================================
      state.status = 'publishing';
      state.currentStep = 'Publishing to social media platforms';
      state.progress = 95;
      this.logProgress(state);

      let publishResults;
      if (config.schedulingConfig.autoPublish) {
        console.log('📤 Publishing to social media...');
        publishResults = await this.socialMedia.publishToMultiplePlatforms(
          assembledVideo.videoPath,
          finalMetadata,
          config.schedulingConfig
        );

        // Update published URLs in database
        for (const result of publishResults) {
          if (result.success && result.url) {
            await this.duplicateDetector.updatePublishedUrls(
              contentFingerprint.id,
              result.platform,
              result.url
            );
          }
        }

        console.log('✓ Publishing complete');
        console.log('');
      } else {
        console.log('📋 Auto-publish disabled - video ready for manual review');
        console.log('');
      }

      // ========================================
      // COMPLETED!
      // ========================================
      state.status = 'completed';
      state.currentStep = 'Workflow completed successfully';
      state.progress = 100;
      state.endTime = new Date();
      this.logProgress(state);

      const duration = (state.endTime.getTime() - state.startTime.getTime()) / 1000;
      console.log('');
      console.log('✅ VIDEO GENERATION COMPLETE!');
      console.log(`⏱️  Total time: ${duration.toFixed(2)}s`);
      console.log(`📁 Output: ${assembledVideo.videoPath}`);
      console.log(`🎬 Duration: ${assembledVideo.duration.toFixed(2)}s`);
      console.log(`💾 Size: ${(assembledVideo.fileSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`🎯 Segments: ${audioGeneration.segmentCount}`);
      console.log('');

      if (publishResults) {
        console.log('📤 Publish Results:');
        publishResults.forEach((result) => {
          const status = result.success ? '✓' : '✗';
          console.log(`  ${status} ${result.platform}: ${result.url || result.error}`);
        });
        console.log('');
      }

      console.log('🎉 Ready for manual review!');
      console.log('');

      return {
        success: true,
        videoPath: assembledVideo.videoPath,
        metadata: finalMetadata,
        publishResults,
        duration: assembledVideo.duration,
        segments: audioGeneration.segmentCount,
      };
    } catch (error) {
      state.status = 'failed';
      state.error = String(error);
      state.endTime = new Date();

      console.error('');
      console.error('❌ VIDEO GENERATION FAILED');
      console.error(`Error: ${error}`);
      console.error('');

      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Creates directory structure
   */
  private createDirectories(dirs: string[]): void {
    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Logs workflow progress
   */
  private logProgress(state: WorkflowState): void {
    const progressBar = this.createProgressBar(state.progress);
    console.log(`[${progressBar}] ${state.progress}% - ${state.currentStep}`);
  }

  /**
   * Creates ASCII progress bar
   */
  private createProgressBar(progress: number, width: number = 30): string {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Validates configuration
   */
  async validateConfig(config: VideoGenerationConfig): Promise<string[]> {
    const errors: string[] = [];

    // Check seed portrait exists
    if (!fs.existsSync(config.seedPortrait)) {
      errors.push(`Seed portrait not found: ${config.seedPortrait}`);
    }

    // Check voice clone ID
    const voiceValid = await this.elevenlabs.validateVoice();
    if (!voiceValid) {
      errors.push('ElevenLabs voice clone ID is invalid');
    }

    // Check platforms have credentials
    for (const platform of config.targetPlatforms) {
      const valid = await this.socialMedia.validateCredentials(platform);
      if (!valid && config.schedulingConfig.autoPublish) {
        errors.push(`${platform} credentials not configured (required for auto-publish)`);
      }
    }

    return errors;
  }
}
