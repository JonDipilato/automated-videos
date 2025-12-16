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
import { SchedulerService } from '../services/scheduler.service';
import { CaptionsService, YOUTUBE_SHORTS_STYLE } from '../services/captions.service';

export class VideoGenerationWorkflow {
  private openai: OpenAIService;
  private grok: GrokService;
  private elevenlabs: ElevenLabsService;
  private ffmpeg: FFmpegService;
  private duplicateDetector: DuplicateDetector;
  private socialMedia: SocialMediaService;
  private scheduler: SchedulerService;
  private captions: CaptionsService;
  private workDir: string;
  private progressCallback?: (status: string, step: string, progress: number) => void;

  constructor(
    openai: OpenAIService,
    grok: GrokService,
    elevenlabs: ElevenLabsService,
    ffmpeg: FFmpegService,
    duplicateDetector: DuplicateDetector,
    socialMedia: SocialMediaService,
    scheduler: SchedulerService,
    captions: CaptionsService,
    workDir: string = './output'
  ) {
    this.openai = openai;
    this.grok = grok;
    this.elevenlabs = elevenlabs;
    this.ffmpeg = ffmpeg;
    this.duplicateDetector = duplicateDetector;
    this.socialMedia = socialMedia;
    this.scheduler = scheduler;
    this.captions = captions;
    this.workDir = workDir;
  }

  /**
   * MASTER WORKFLOW: Generates complete video from seed portrait
   * Implements AUDIO-FIRST APPROACH
   */
  async generateVideo(
    config: VideoGenerationConfig,
    progressCallback?: (status: string, step: string, progress: number) => void
  ): Promise<VideoGenerationResult> {
    const jobId = uuidv4();
    const state: WorkflowState = {
      jobId,
      status: 'initializing',
      progress: 0,
      currentStep: 'Initializing workflow',
      startTime: new Date(),
    };

    // Store callback for progress updates
    this.progressCallback = progressCallback;

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

      // Calculate actual content duration (excluding intro/outro)
      const introDuration = config.introDuration || 3;
      const outroDuration = config.outroDuration || 3;
      const contentDuration = Math.max(
        1,
        config.maxVideoLength - introDuration - outroDuration
      );

      console.log(`📊 Duration breakdown:`);
      console.log(`   Intro: ${introDuration}s`);
      console.log(`   Content: ${contentDuration}s`);
      console.log(`   Outro: ${outroDuration}s`);
      console.log(`   Total target: ${config.maxVideoLength}s`);
      console.log('');

      const scriptGeneration = await this.openai.generateScript(
        config.topic,
        contentDuration,              // Use content duration only
        config.videoSegmentDuration,  // Pass segment duration
        config.niche                  // Pass niche for specialized content
      );

      console.log(`✓ Script generated (${scriptGeneration.estimatedDuration}s estimated)`);
      console.log('');

      // ========================================
      // 🔍 PRE-TTS PREVIEW: Estimate duration BEFORE spending credits
      // ========================================
      const estimatedAudioDuration = this.openai.estimateAudioDuration(scriptGeneration.script);
      const estimatedSegments = Math.ceil(estimatedAudioDuration / config.videoSegmentDuration) + 1;
      const maxAllowedDuration = contentDuration + 5; // 5s tolerance

      console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`  📊 PRE-TTS PREVIEW (BEFORE spending credits):`);
      console.log(`     Estimated audio: ~${estimatedAudioDuration.toFixed(1)}s`);
      console.log(`     Target duration: ${contentDuration}s`);
      console.log(`     Max allowed: ${maxAllowedDuration}s (5s tolerance)`);
      console.log(`     Estimated segments: ${estimatedSegments}`);
      console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      if (estimatedAudioDuration > maxAllowedDuration) {
        console.error(`  ❌ ABORT: Estimated duration (${estimatedAudioDuration.toFixed(1)}s) exceeds limit (${maxAllowedDuration}s)`);
        console.error(`     Script needs to be shorter. This saves API credits!`);
        throw new Error(`Script too long: estimated ${estimatedAudioDuration.toFixed(1)}s, max ${maxAllowedDuration}s. Reduce topic scope or increase --max-length.`);
      }

      if (estimatedSegments > 10) {
        console.error(`  ❌ ABORT: Too many segments (${estimatedSegments}) - max 10 allowed`);
        throw new Error(`Too many segments estimated (${estimatedSegments}). Reduce topic scope or shorten duration.`);
      }

      console.log(`  ✅ Preview passed - proceeding with TTS generation`);
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

      // ⚠️ CRITICAL SAFEGUARD: Validate audio duration (5s tolerance - reduced from 10s)
      const audioDurationDiff = audioGeneration.duration - contentDuration;
      if (audioDurationDiff > 5) {
        console.error(`❌ CRITICAL ERROR: Audio duration mismatch!`);
        console.error(`   Target: ${contentDuration}s`);
        console.error(`   Actual: ${audioGeneration.duration.toFixed(2)}s`);
        console.error(`   Over by: ${audioDurationDiff.toFixed(2)}s (max 5s allowed)`);
        console.error(``);
        console.error(`This would generate ${audioGeneration.segmentCount} video segments,`);
        console.error(`which will exhaust your API credits!`);
        console.error(``);
        throw new Error(`Audio duration (${audioGeneration.duration.toFixed(2)}s) exceeds target (${contentDuration}s) by ${audioDurationDiff.toFixed(2)}s (max 5s). Generation aborted to protect credits.`);
      }

      // Track if we need extra segments (audio slightly over but within tolerance)
      let needsCatchUpSegments = false;
      let catchUpSegmentsNeeded = 0;
      if (audioDurationDiff > 0) {
        console.log(`  ⚠️ Audio is ${audioDurationDiff.toFixed(2)}s over target (within 5s tolerance)`);
        // Calculate if we need extra video segments to cover the audio
        const currentCoverage = audioGeneration.segmentCount * config.videoSegmentDuration;
        if (audioGeneration.duration > currentCoverage) {
          catchUpSegmentsNeeded = Math.ceil((audioGeneration.duration - currentCoverage) / config.videoSegmentDuration);
          needsCatchUpSegments = catchUpSegmentsNeeded > 0;
          if (needsCatchUpSegments) {
            console.log(`  📹 Will generate ${catchUpSegmentsNeeded} extra segment(s) to cover full audio`);
          }
        }
      }

      // ⚠️ CRITICAL SAFEGUARD: Hard limit on segment count
      if (audioGeneration.segmentCount > 10) {
        console.error(`❌ CRITICAL ERROR: Too many segments!`);
        console.error(`   Requested segments: ${audioGeneration.segmentCount}`);
        console.error(`   Maximum allowed: 10 segments`);
        console.error(``);
        console.error(`This would cost approximately:`);
        console.error(`   - ${audioGeneration.segmentCount} KIE.AI video generations`);
        console.error(`   - ${audioGeneration.segmentCount} DALL-E backgrounds`);
        console.error(`   - Total: Hundreds of dollars in API credits!`);
        console.error(``);
        throw new Error(`Segment count (${audioGeneration.segmentCount}) exceeds safety limit (10). Generation aborted to protect your credits.`);
      }

      // Warning for large videos
      if (audioGeneration.segmentCount > 5) {
        console.warn(`⚠️  WARNING: Generating ${audioGeneration.segmentCount} segments will use significant API credits!`);
        console.warn(`   Estimated cost: $${(audioGeneration.segmentCount * 0.50).toFixed(2)} (KIE) + $${(audioGeneration.segmentCount * 0.08).toFixed(2)} (DALL-E)`);
        console.warn('');
      }

      // Validate audio duration against target
      const totalTargetDuration = config.maxVideoLength;
      const audioWithMargins = audioGeneration.duration + introDuration + outroDuration;

      if (Math.abs(audioWithMargins - totalTargetDuration) > 5) {
        console.log('');
        console.log('⚠️  DURATION NOTICE:');
        console.log(`   Target total: ${totalTargetDuration}s`);
        console.log(`   Actual total: ${audioWithMargins.toFixed(2)}s`);
        console.log(`   Audio only: ${audioGeneration.duration.toFixed(2)}s`);
        console.log(`   Difference: ${(audioWithMargins - totalTargetDuration).toFixed(2)}s`);

        if (audioWithMargins > totalTargetDuration + 10) {
          console.log('   Consider increasing --max-length or using a more concise topic');
        }
        console.log('');
      }

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

      // Add +1 buffer segment PLUS any catch-up segments needed
      // This prevents audio cutoff - excess video will be trimmed during assembly
      const totalExtraSegments = 1 + catchUpSegmentsNeeded; // 1 buffer + any catch-up
      const segmentCountWithBuffer = audioGeneration.segmentCount + totalExtraSegments;
      console.log(`📹 Generating ${segmentCountWithBuffer} segments:`);
      console.log(`   Base: ${audioGeneration.segmentCount} (from audio duration)`);
      console.log(`   Buffer: 1 (for clean ending)`);
      if (catchUpSegmentsNeeded > 0) {
        console.log(`   Catch-up: ${catchUpSegmentsNeeded} (audio slightly over target)`);
      }

      const grokPrompts = await this.openai.generateGrokPrompts(
        scriptGeneration,
        segmentCountWithBuffer,       // Use buffered + catch-up segment count
        portraitDescription,
        config.videoSegmentDuration,  // Add segment duration
        config.niche                  // Pass niche for visual style
      );

      console.log(`✓ Generated ${grokPrompts.length} Grok prompts`);
      console.log('');

      // ========================================
      // STEP 5: Skip Background Images (Using Frame Chaining Instead)
      // ========================================
      // Background images are no longer needed since we're using frame chaining
      // Each segment's last frame becomes the next segment's seed image
      // This saves DALL-E credits and improves continuity
      console.log(`⚡ Skipping background generation (using frame chaining for perfect continuity)`);
      console.log(`   💰 Saved ${grokPrompts.length} DALL-E image generations (~$${(grokPrompts.length * 0.08).toFixed(2)})`);
      console.log('');

      // ========================================
      // STEP 6: Generate Video Segments with Frame Chaining
      // ========================================
      state.currentStep = 'Generating video segments with frame chaining';
      state.progress = 50;
      this.logProgress(state);

      console.log('🎥 Generating video segments with perfect continuity...');
      console.log('   Using frame chaining: Each segment\'s last frame becomes the next segment\'s seed');
      console.log('');

      // Use frame chaining for perfect continuity between segments
      // Composites original portrait/seed image over extracted backgrounds for character consistency
      const videoSegments = await this.grok.generateVideoSegmentsWithFrameChaining(
        grokPrompts,
        config.seedPortrait,
        videoDir,
        // Pass compositing method that overlays the user's selected seed image on background
        // IMPORTANT: Always use config.seedPortrait (user's selection), NOT env variable
        (videoPath: string, outputPath: string) =>
          this.ffmpeg.extractLastFrameAndComposite(videoPath, config.seedPortrait, outputPath)
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
      // STEP 7: Skip Intro/Outro (No backgrounds needed)
      // ========================================
      // Intro/outro generation removed - no longer using backgrounds
      console.log('⚡ Skipping intro/outro (videos start directly with content)');
      console.log('');

      // ========================================
      // STEP 8: Assemble Final Video
      // ========================================
      state.status = 'assembling_video';
      state.currentStep = 'Assembling final video with transitions';
      state.progress = 80;
      this.logProgress(state);

      // Prepare video segments in order (just content segments, no intro/outro)
      const allSegments: string[] = successfulSegments
        .sort((a, b) => a.prompt.segmentIndex - b.prompt.segmentIndex)
        .filter((seg) => fs.existsSync(seg.videoUrl))
        .map((seg) => seg.videoUrl);

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
      // STEP 8.5: Add Captions
      // ========================================
      state.currentStep = 'Adding word-level captions';
      state.progress = 85;
      this.logProgress(state);

      try {
        const videoWithCaptionsPath = path.join(finalDir, 'final_video_with_captions.mp4');
        await this.captions.addCaptionsWorkflow(
          assembledVideo.videoPath,
          audioPath,
          videoWithCaptionsPath,
          YOUTUBE_SHORTS_STYLE
        );

        // Update the assembled video path to the captioned version
        assembledVideo.videoPath = videoWithCaptionsPath;

        console.log('✓ Captions added successfully');
        console.log('');
      } catch (error) {
        console.warn(`⚠️  Caption generation failed, continuing without captions: ${error}`);
        console.log('');
      }

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
      // STEP 11: Generate Posting Schedule
      // ========================================
      state.currentStep = 'Generating optimal posting schedule';
      state.progress = 93;
      this.logProgress(state);

      const schedules = await this.scheduler.schedulePosts(
        config.targetPlatforms,
        {
          strategy: config.schedulingConfig.strategy,
          timezone: config.schedulingConfig.timezone,
          manualTime: config.schedulingConfig.scheduleTime,
          delayHours: config.schedulingConfig.delayHours,
          avoidWeekends: config.schedulingConfig.avoidWeekends,
          spreadPosts: config.schedulingConfig.spreadPosts,
          minGapMinutes: config.schedulingConfig.minGapMinutes,
        }
      );

      console.log(`✓ Generated schedule for ${schedules.length} platforms`);
      console.log('');
      console.log('📅 Posting Schedule:');
      schedules.forEach((schedule) => {
        console.log(`  ${this.scheduler.formatSchedule(schedule)}`);
      });
      console.log('');

      // Update metadata with scheduled times
      finalMetadata.forEach((meta, index) => {
        const schedule = schedules.find((s) => s.platform === meta.platform);
        if (schedule) {
          meta.scheduledTime = schedule.scheduledTime;
        }
      });

      // ========================================
      // STEP 12: Publish to Social Media
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
        schedules,
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
   * Logs workflow progress and calls database update callback
   */
  private logProgress(state: WorkflowState): void {
    const progressBar = this.createProgressBar(state.progress);
    console.log(`[${progressBar}] ${state.progress}% - ${state.currentStep}`);

    // Call progress callback to update database in real-time
    if (this.progressCallback) {
      this.progressCallback(state.status, state.currentStep, state.progress);
    }
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
