import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  VideoGenerationResult,
  WorkflowState,
  TransitionConfig,
  Platform,
  GrokPrompt,
} from '../types';
import { OpenAIService } from '../services/openai.service';
import { GrokService } from '../services/grok.service';
import { ElevenLabsService } from '../services/elevenlabs.service';
import { FFmpegService } from '../services/ffmpeg.service';
import { DuplicateDetector } from '../services/duplicate-detector';
import { SocialMediaService } from '../services/social-media.service';
import { SchedulerService } from '../services/scheduler.service';
import { CaptionsService, YOUTUBE_SHORTS_STYLE } from '../services/captions.service';

// Scene type from frontend
interface CustomScene {
  id: string;
  timestamp: string;
  title: string;
  visual: string;
  voiceover: string;
}

// Default segment duration for Grok videos (5 seconds each)
const SEGMENT_DURATION = 5;

// Maximum video duration we can generate (10 segments * 5s = 50s, with buffer = ~45s content)
const MAX_VIDEO_DURATION = 45;

export class CustomScriptWorkflow {
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
   * Generates video from user-provided custom script scenes
   * Bypasses AI script generation and uses user's exact text
   */
  async generateFromCustomScript(
    title: string,
    scenes: CustomScene[],
    portraitPath: string,
    platforms: Platform[],
    progressCallback?: (status: string, step: string, progress: number) => void
  ): Promise<VideoGenerationResult> {
    const jobId = uuidv4();
    const state: WorkflowState = {
      jobId,
      status: 'initializing',
      progress: 0,
      currentStep: 'Initializing custom script workflow',
      startTime: new Date(),
    };

    this.progressCallback = progressCallback;

    try {
      console.log('🚀 Starting Custom Script Video Generation');
      console.log(`📋 Job ID: ${jobId}`);
      console.log(`🎯 Title: ${title}`);
      console.log(`📹 Scenes: ${scenes.length}`);
      console.log(`🖼️  Portrait: ${portraitPath}`);
      console.log(`🎨 Platforms: ${platforms.join(', ')}`);
      console.log('');

      // Create job-specific directories
      const jobDir = path.join(this.workDir, jobId);
      const audioDir = path.join(jobDir, 'audio');
      const videoDir = path.join(jobDir, 'videos');
      const imageDir = path.join(jobDir, 'images');
      const finalDir = path.join(jobDir, 'final');

      this.createDirectories([jobDir, audioDir, videoDir, imageDir, finalDir]);

      // ========================================
      // STEP 1: Validate and process script
      // ========================================
      state.status = 'processing_script';
      state.currentStep = 'Processing and validating custom script';
      state.progress = 5;
      this.logProgress(state);

      // Combine all voiceovers into a single script
      let fullScript = scenes.map(s => s.voiceover.trim()).join(' ');
      console.log(`📝 Original script: ${fullScript.length} characters, ${fullScript.split(/\s+/).length} words`);

      // ========================================
      // PRE-TTS VALIDATION: Check script length BEFORE spending credits
      // ========================================
      let estimatedDuration = this.openai.estimateAudioDuration(fullScript);
      console.log(`⏱️  Estimated audio duration: ${estimatedDuration.toFixed(1)}s`);
      console.log(`⏱️  Maximum allowed: ${MAX_VIDEO_DURATION}s`);

      if (estimatedDuration > MAX_VIDEO_DURATION) {
        console.warn(`⚠️  Script too long! Estimated ${estimatedDuration.toFixed(1)}s exceeds max ${MAX_VIDEO_DURATION}s`);
        console.log(`🔧 Auto-shortening script to fit...`);

        // Truncate script to fit within max duration
        fullScript = this.openai.truncateToFitDuration(fullScript, MAX_VIDEO_DURATION, 0);
        estimatedDuration = this.openai.estimateAudioDuration(fullScript);

        console.log(`✓ Shortened to: ${fullScript.split(/\s+/).length} words (~${estimatedDuration.toFixed(1)}s)`);
      }

      // Calculate segments needed
      const estimatedSegments = Math.ceil(estimatedDuration / SEGMENT_DURATION) + 1; // +1 buffer
      console.log(`📹 Estimated segments needed: ${estimatedSegments}`);

      if (estimatedSegments > 10) {
        throw new Error(`Script requires ${estimatedSegments} segments but max is 10. Please shorten your script.`);
      }

      console.log(`✅ Script validation passed - proceeding with generation`);
      console.log('');

      // ========================================
      // STEP 2: Generate Audio
      // ========================================
      state.status = 'generating_audio';
      state.currentStep = 'Generating audio narration';
      state.progress = 15;
      this.logProgress(state);

      const audioPath = path.join(audioDir, 'narration.mp3');
      const audioGeneration = await this.elevenlabs.generateAudio(
        fullScript,
        audioPath,
        SEGMENT_DURATION
      );

      console.log(`✓ Audio generated: ${audioGeneration.duration.toFixed(2)}s`);
      console.log(`✓ Segments calculated: ${audioGeneration.segmentCount}`);
      console.log('');

      // Double-check audio duration doesn't exceed our capacity
      const maxVideoCapacity = 10 * SEGMENT_DURATION; // 10 segments max
      if (audioGeneration.duration > maxVideoCapacity) {
        throw new Error(
          `Audio duration (${audioGeneration.duration.toFixed(1)}s) exceeds max video capacity (${maxVideoCapacity}s). ` +
          `Please shorten your script.`
        );
      }

      // ========================================
      // STEP 3: Generate Grok Prompts with LIP SYNC format
      // ========================================
      state.status = 'generating_prompts';
      state.currentStep = 'Creating video prompts for lip sync';
      state.progress = 25;
      this.logProgress(state);

      // Calculate how many segments we actually need based on audio duration
      const segmentsNeeded = audioGeneration.segmentCount + 1; // +1 buffer for clean ending
      console.log(`📹 Generating ${segmentsNeeded} segments (${audioGeneration.segmentCount} for audio + 1 buffer)`);

      // Build prompts - distribute scenes across segments
      const grokPrompts: GrokPrompt[] = [];
      for (let i = 0; i < segmentsNeeded; i++) {
        // Map segment to scene (cycle through scenes if more segments than scenes)
        const sceneIndex = Math.min(i, scenes.length - 1);
        const scene = scenes[sceneIndex];

        grokPrompts.push({
          segmentIndex: i,
          videoPrompt: this.buildLipSyncPrompt(scene),
          backgroundPrompt: scene.visual,
          transitionType: i === 0 ? 'fade' : 'crossfade',
          duration: SEGMENT_DURATION,
          continuityNote: scene.title || `Scene ${sceneIndex + 1}`,
        });
      }

      console.log(`✓ Generated ${grokPrompts.length} video prompts with lip sync format`);
      console.log('');

      // ========================================
      // STEP 4: Generate Video Segments with Frame Chaining
      // ========================================
      state.status = 'generating_video';
      state.currentStep = 'Generating video segments with lip sync';
      state.progress = 35;
      this.logProgress(state);

      console.log('🎥 Generating video segments with frame chaining...');
      console.log(`🖼️  Using portrait: ${portraitPath}`);
      console.log('');

      // Use frame chaining with the provided portrait
      const videoSegments = await this.grok.generateVideoSegmentsWithFrameChaining(
        grokPrompts,
        portraitPath,  // This should be the GCS URL or local path
        videoDir,
        (videoPath: string, outputPath: string) =>
          this.ffmpeg.extractLastFrameAndComposite(videoPath, portraitPath, outputPath)
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

      // Verify we have enough video to cover audio
      const totalVideoDuration = successfulSegments.length * SEGMENT_DURATION;
      if (totalVideoDuration < audioGeneration.duration - 2) {
        console.warn(`⚠️  Video duration (${totalVideoDuration}s) may be short for audio (${audioGeneration.duration.toFixed(1)}s)`);
      }

      // ========================================
      // STEP 5: Assemble Final Video
      // ========================================
      state.status = 'assembling_video';
      state.currentStep = 'Assembling final video';
      state.progress = 75;
      this.logProgress(state);

      const allSegments: string[] = successfulSegments
        .sort((a, b) => a.prompt.segmentIndex - b.prompt.segmentIndex)
        .filter((seg) => fs.existsSync(seg.videoUrl))
        .map((seg) => seg.videoUrl);

      // Create transitions
      const transitions: TransitionConfig[] = [];
      for (let i = 0; i < allSegments.length - 1; i++) {
        transitions.push({
          type: grokPrompts[i]?.transitionType || 'crossfade',
          duration: 1,
          easing: 'easeInOut',
        });
      }

      const finalVideoPath = path.join(finalDir, 'final_video.mp4');
      const assembledVideo = await this.ffmpeg.assembleVideo(
        allSegments,
        audioPath,
        finalVideoPath,
        transitions
      );

      console.log('✓ Video assembled successfully');
      console.log(`  Path: ${assembledVideo.videoPath}`);
      console.log(`  Duration: ${assembledVideo.duration.toFixed(2)}s`);
      console.log('');

      // ========================================
      // STEP 6: Add Captions
      // ========================================
      state.currentStep = 'Adding captions';
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

        assembledVideo.videoPath = videoWithCaptionsPath;
        console.log('✓ Captions added successfully');
        console.log('');
      } catch (error) {
        console.warn(`⚠️  Caption generation failed, continuing without captions: ${error}`);
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
      console.log('✅ CUSTOM SCRIPT VIDEO GENERATION COMPLETE!');
      console.log(`⏱️  Total time: ${duration.toFixed(2)}s`);
      console.log(`📁 Output: ${assembledVideo.videoPath}`);
      console.log(`🎬 Duration: ${assembledVideo.duration.toFixed(2)}s`);
      console.log(`🎯 Scenes: ${scenes.length}`);
      console.log('');

      return {
        success: true,
        videoPath: assembledVideo.videoPath,
        duration: assembledVideo.duration,
        segments: successfulSegments.length,
      };
    } catch (error) {
      state.status = 'failed';
      state.error = String(error);
      state.endTime = new Date();

      console.error('');
      console.error('❌ CUSTOM SCRIPT VIDEO GENERATION FAILED');
      console.error(`Error: ${error}`);
      console.error('');

      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Builds a lip-sync optimized video prompt from a custom scene
   * Uses the format that worked well: "Keep original motion and lip movement..."
   */
  private buildLipSyncPrompt(scene: CustomScene): string {
    const background = scene.visual || 'professional office setting with soft natural lighting';

    // Use the lip-sync friendly format that worked well
    return `Keep original motion and lip movement. Leave speaker unchanged. Modify background only.

Background: ${background}, cinematic 4K quality.`;
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
}
