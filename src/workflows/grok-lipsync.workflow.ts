import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  VideoGenerationResult,
  WorkflowState,
  Platform,
} from '../types';
import { KieLipSyncService, LipSyncVideoResponse, BackgroundMood } from '../services/kie-lipsync.service';
import { FFmpegService } from '../services/ffmpeg.service';
import { ElevenLabsService } from '../services/elevenlabs.service';
import { GCSStorageService } from '../services/gcs-storage.service';
import { CaptionsService, YOUTUBE_SHORTS_STYLE } from '../services/captions.service';

/**
 * Scene definition for lip-sync video generation
 */
export interface LipSyncScene {
  id: string;
  dialogue: string;     // What the character says (Line: "...")
  visual: string;       // Background description
  title?: string;       // Optional scene title
  timestamp?: string;   // Optional timestamp reference
}

/**
 * Options for lip-sync workflow
 */
export interface LipSyncWorkflowOptions {
  replaceVoice: boolean;       // Extract Grok audio and replace with ElevenLabs
  voiceId?: string;            // ElevenLabs voice ID if replacing
  backgroundMood: BackgroundMood;  // Mood for background enhancement
  addCaptions?: boolean;       // Add captions to final video
}

/**
 * Grok Lip Sync Workflow
 *
 * Generates videos using Grok Imagine's native lip sync capabilities.
 * Uses the confirmed working prompt format:
 *
 * Line: "dialogue"
 * Keep the original video motion, lip movement, expressions...
 * Background: [enhanced spectacular description]
 *
 * IMPORTANT: This workflow REUSES existing infrastructure:
 * - KIE.AI API via KieLipSyncService (wraps existing kie.service.ts pattern)
 * - GCS Storage for frame uploads (existing gcs-storage.service.ts)
 * - Frame chaining logic (copied from grok.service.ts:144-267)
 * - FFmpeg for concatenation and audio operations
 *
 * Does NOT modify or replace existing workflows!
 */
export class GrokLipSyncWorkflow {
  private kieLipSync: KieLipSyncService;
  private ffmpeg: FFmpegService;
  private elevenlabs: ElevenLabsService;
  private gcsStorage: GCSStorageService;
  private captions: CaptionsService;
  private workDir: string;
  private progressCallback?: (status: string, step: string, progress: number) => void;

  constructor(
    kieLipSync: KieLipSyncService,
    ffmpeg: FFmpegService,
    elevenlabs: ElevenLabsService,
    captions: CaptionsService,
    workDir: string = './output'
  ) {
    this.kieLipSync = kieLipSync;
    this.ffmpeg = ffmpeg;
    this.elevenlabs = elevenlabs;
    this.gcsStorage = new GCSStorageService();
    this.captions = captions;
    this.workDir = workDir;
  }

  /**
   * Main generation method
   * Generates lip-synced video from scenes with Grok's native audio
   */
  async generate(
    title: string,
    scenes: LipSyncScene[],
    portraitPath: string,
    platforms: Platform[],
    options: LipSyncWorkflowOptions,
    progressCallback?: (status: string, step: string, progress: number) => void
  ): Promise<VideoGenerationResult> {
    const jobId = uuidv4();
    const state: WorkflowState = {
      jobId,
      status: 'initializing',
      progress: 0,
      currentStep: 'Initializing Grok Lip Sync workflow',
      startTime: new Date(),
    };

    this.progressCallback = progressCallback;

    try {
      console.log('');
      console.log('🎬 GROK LIP SYNC VIDEO GENERATION');
      console.log('='.repeat(60));
      console.log(`📋 Job ID: ${jobId}`);
      console.log(`🎯 Title: ${title}`);
      console.log(`📹 Scenes: ${scenes.length}`);
      console.log(`🖼️  Portrait: ${portraitPath}`);
      console.log(`🎨 Background Mood: ${options.backgroundMood}`);
      console.log(`🎤 Voice Replacement: ${options.replaceVoice ? `Yes (${options.voiceId || 'default'})` : 'No (Grok native)'}`);
      console.log(`🎨 Platforms: ${platforms.join(', ')}`);
      console.log('');

      // Create job directories
      const jobDir = path.join(this.workDir, jobId);
      const videoDir = path.join(jobDir, 'videos');
      const audioDir = path.join(jobDir, 'audio');
      const imageDir = path.join(jobDir, 'images');
      const finalDir = path.join(jobDir, 'final');

      this.createDirectories([jobDir, videoDir, audioDir, imageDir, finalDir]);

      // ========================================
      // STEP 1: Validate scenes
      // ========================================
      state.status = 'validating';
      state.currentStep = 'Validating scenes';
      state.progress = 5;
      this.logProgress(state);

      this.validateScenes(scenes);
      console.log(`✓ ${scenes.length} scenes validated`);
      console.log('');

      // ========================================
      // STEP 2: Generate lip-sync video segments with frame chaining
      // ========================================
      state.status = 'generating_video';
      state.currentStep = 'Generating lip-sync video segments';
      state.progress = 10;
      this.logProgress(state);

      const videoSegments = await this.generateWithFrameChaining(
        scenes,
        portraitPath,
        videoDir,
        imageDir,
        options.backgroundMood
      );

      const successfulSegments = videoSegments.filter(seg => seg.status === 'completed');

      if (successfulSegments.length === 0) {
        throw new Error('No video segments were successfully generated');
      }

      console.log('');
      console.log(`✓ Generated ${successfulSegments.length}/${scenes.length} segments with lip-sync`);
      console.log('');

      // ========================================
      // STEP 3: Concatenate segments (with embedded audio)
      // ========================================
      state.status = 'assembling';
      state.currentStep = 'Assembling video segments';
      state.progress = 60;
      this.logProgress(state);

      const segmentPaths = successfulSegments
        .sort((a, b) => a.segmentIndex - b.segmentIndex)
        .map(seg => seg.videoUrl);

      const assembledVideoPath = path.join(finalDir, 'assembled_with_audio.mp4');
      const assembledVideo = await this.ffmpeg.concatenateWithAudio(
        segmentPaths,
        assembledVideoPath,
        true // Apply smooth transitions
      );

      console.log(`✓ Video assembled: ${assembledVideo.duration.toFixed(2)}s`);
      console.log('');

      // ========================================
      // STEP 4: Optional voice replacement (Per-Segment Time-Matched)
      // ========================================
      let finalVideoPath = assembledVideoPath;

      if (options.replaceVoice && options.voiceId) {
        state.status = 'replacing_voice';
        state.currentStep = 'Replacing voice with ElevenLabs (time-matched)';
        state.progress = 70;
        this.logProgress(state);

        // Pass individual segment paths for per-segment time-matched voice replacement
        // This ensures each segment's ElevenLabs audio is stretched to match its lip movements
        finalVideoPath = await this.replaceVoiceWithElevenLabs(
          assembledVideoPath,
          scenes,
          audioDir,
          finalDir,
          options.voiceId,
          segmentPaths // Pass the original segment paths for per-segment processing
        );
      }

      // ========================================
      // STEP 5: Add captions (optional)
      // ========================================
      if (options.addCaptions !== false) {
        state.status = 'adding_captions';
        state.currentStep = 'Adding captions';
        state.progress = 85;
        this.logProgress(state);

        try {
          // For lip-sync videos, we need to extract audio first for transcription
          const audioForCaptions = path.join(audioDir, 'for_captions.mp3');
          await this.ffmpeg.extractAudio(finalVideoPath, audioForCaptions);

          const captionedVideoPath = path.join(finalDir, 'final_with_captions.mp4');
          await this.captions.addCaptionsWorkflow(
            finalVideoPath,
            audioForCaptions,
            captionedVideoPath,
            YOUTUBE_SHORTS_STYLE
          );

          finalVideoPath = captionedVideoPath;
          console.log('✓ Captions added');
          console.log('');
        } catch (error) {
          console.warn(`⚠️  Caption generation failed, continuing without: ${error}`);
        }
      }

      // ========================================
      // COMPLETED!
      // ========================================
      state.status = 'completed';
      state.currentStep = 'Generation complete';
      state.progress = 100;
      state.endTime = new Date();
      this.logProgress(state);

      const finalDuration = await this.ffmpeg.getDuration(finalVideoPath);
      const duration = (state.endTime.getTime() - state.startTime.getTime()) / 1000;

      console.log('');
      console.log('='.repeat(60));
      console.log('✅ GROK LIP SYNC GENERATION COMPLETE!');
      console.log('='.repeat(60));
      console.log(`⏱️  Total time: ${duration.toFixed(2)}s`);
      console.log(`📁 Output: ${finalVideoPath}`);
      console.log(`🎬 Duration: ${finalDuration.toFixed(2)}s`);
      console.log(`🎯 Scenes: ${scenes.length}`);
      console.log(`🔊 Audio: ${options.replaceVoice ? 'ElevenLabs' : 'Grok Native'}`);
      console.log('');

      return {
        success: true,
        videoPath: finalVideoPath,
        duration: finalDuration,
        segments: successfulSegments.length,
      };
    } catch (error) {
      state.status = 'failed';
      state.error = String(error);
      state.endTime = new Date();

      console.error('');
      console.error('❌ GROK LIP SYNC GENERATION FAILED');
      console.error(`Error: ${error}`);
      console.error('');

      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Generate lip-sync segments with frame chaining
   * COPIED from grok.service.ts generateVideoSegmentsWithFrameChaining() logic
   *
   * Frame chaining ensures visual continuity:
   * 1. Generate segment video with lip-sync
   * 2. Extract last frame
   * 3. Composite original portrait OVER extracted frame
   * 4. Upload composited frame to GCS
   * 5. Use composited frame as seed for next segment
   */
  private async generateWithFrameChaining(
    scenes: LipSyncScene[],
    initialPortraitPath: string,
    videoDir: string,
    imageDir: string,
    mood: BackgroundMood
  ): Promise<LipSyncVideoResponse[]> {
    const results: LipSyncVideoResponse[] = [];
    let currentSeedPath = initialPortraitPath;

    console.log('');
    console.log('🔗 FRAME CHAINING ENABLED');
    console.log("   Each segment's last frame becomes the next segment's seed");
    console.log(`   Initial seed: ${initialPortraitPath}`);
    console.log('');

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const isFirstSegment = i === 0;
      const isLastSegment = i === scenes.length - 1;

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎤 SEGMENT ${i + 1}/${scenes.length}: ${scene.title || `Scene ${i + 1}`}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`   Dialogue: "${scene.dialogue.substring(0, 50)}${scene.dialogue.length > 50 ? '...' : ''}"`);
      console.log(`   Visual: ${scene.visual.substring(0, 50)}${scene.visual.length > 50 ? '...' : ''}`);
      console.log(`   Seed: ${currentSeedPath.substring(0, 60)}${currentSeedPath.length > 60 ? '...' : ''}`);

      // Generate lip-sync video segment
      const result = await this.kieLipSync.generateWithLipSync(
        currentSeedPath,
        scene.dialogue,
        scene.visual,
        videoDir,
        i,
        mood,
        !isFirstSegment // forceUpload for segments after first
      );

      results.push(result);

      if (result.status !== 'completed') {
        console.error(`   ❌ Segment ${i + 1} failed to generate`);
        continue;
      }

      console.log(`   ✓ Segment ${i + 1} generated with lip-sync audio`);

      // Frame chaining: prepare seed for next segment
      if (!isLastSegment) {
        console.log('');
        console.log(`   🔄 FRAME CHAINING: Preparing seed for segment ${i + 2}...`);

        try {
          const compositedFramePath = path.join(imageDir, `transition_composite_${i}.jpg`);

          // Step 1: Extract last frame AND composite portrait over it
          console.log(`   Step 1: Extracting last frame and compositing portrait...`);
          await this.ffmpeg.extractLastFrameAndComposite(
            result.videoUrl,
            initialPortraitPath, // Always use original portrait for consistency
            compositedFramePath
          );

          // Verify frame was created
          if (!fs.existsSync(compositedFramePath)) {
            throw new Error(`Composited frame not created at ${compositedFramePath}`);
          }

          const stats = fs.statSync(compositedFramePath);
          if (stats.size < 1000) {
            throw new Error(`Composited frame too small (${stats.size} bytes)`);
          }

          console.log(`   Step 2: Composited frame created (${(stats.size / 1024).toFixed(1)}KB)`);

          // Step 3: Upload to GCS
          console.log(`   Step 3: Uploading composited frame to GCS...`);
          const timestamp = Date.now();
          const remoteFileName = `lipsync_composite_${timestamp}_segment_${i}.jpg`;
          const gcsUrl = await this.gcsStorage.uploadImage(compositedFramePath, remoteFileName);

          // Step 4: Wait for GCS propagation (same as existing workflow)
          console.log(`   Step 4: Waiting 4s for GCS propagation...`);
          await new Promise(resolve => setTimeout(resolve, 4000));

          // Update seed for next segment
          currentSeedPath = gcsUrl;

          console.log(`   ✅ FRAME CHAIN COMPLETE`);
          console.log(`      Segment ${i + 2} will use composited frame as seed`);

        } catch (error: any) {
          console.error(`   ❌ FRAME CHAINING FAILED: ${error.message}`);
          console.warn(`   ⚠️  Segment ${i + 2} will use original portrait (no continuity)`);
          // Reset to initial portrait if compositing fails
          currentSeedPath = initialPortraitPath;
        }
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✓ Frame-chained lip-sync generation complete!');
    console.log(`   Total segments: ${results.length}`);
    console.log(`   Successful: ${results.filter(r => r.status === 'completed').length}`);
    console.log('='.repeat(60));

    return results;
  }

  /**
   * Replace Grok's native voice with ElevenLabs (Speech-to-Speech)
   *
   * This uses Speech-to-Speech API for accurate timing:
   * 1. Extract audio from each video segment (Grok's voice)
   * 2. Convert to target voice using Speech-to-Speech (preserves timing!)
   * 3. Replace audio in each segment (no stretching needed)
   * 4. Concatenate all voice-replaced segments
   *
   * Speech-to-Speech is better than TTS + time-stretch because:
   * - Preserves natural speech pacing from Grok
   * - No artificial speed-up/slow-down artifacts
   * - Better lip-sync accuracy
   */
  private async replaceVoiceWithElevenLabs(
    videoPath: string,
    scenes: LipSyncScene[],
    audioDir: string,
    finalDir: string,
    voiceId: string,
    videoSegmentPaths?: string[]
  ): Promise<string> {
    console.log('');
    console.log('🎤 VOICE REPLACEMENT (Speech-to-Speech)');
    console.log('   Converting Grok voice to ElevenLabs using Speech-to-Speech...');
    console.log('   (Speech-to-Speech preserves original timing - no stretching!)');

    // If we don't have individual segments, fall back to simple replacement
    if (!videoSegmentPaths || videoSegmentPaths.length === 0) {
      console.log('   ⚠️  No individual segments available, using simple replacement');
      return this.simpleVoiceReplacement(videoPath, scenes, audioDir, finalDir);
    }

    console.log(`   Processing ${videoSegmentPaths.length} segments...`);
    console.log('');

    const voiceReplacedSegments: string[] = [];

    for (let i = 0; i < videoSegmentPaths.length; i++) {
      const segmentPath = videoSegmentPaths[i];
      const scene = scenes[i];

      console.log(`   📹 Segment ${i + 1}/${videoSegmentPaths.length}${scene ? `: "${scene.dialogue.substring(0, 40)}..."` : ''}`);

      try {
        // Step 1: Get original video duration for comparison
        const videoDuration = await this.ffmpeg.getDuration(segmentPath);
        console.log(`      Original duration: ${videoDuration.toFixed(2)}s`);

        // Step 2: Use Speech-to-Speech to convert Grok's voice to target voice
        const { audioPath: convertedAudioPath, duration: convertedDuration } =
          await this.elevenlabs.convertVideoAudioToVoice(
            segmentPath,
            audioDir,
            i
          );

        console.log(`      Converted duration: ${convertedDuration.toFixed(2)}s (should match original)`);

        // Step 3: Replace audio in video (no stretching needed - timing is preserved!)
        const voiceReplacedPath = path.join(audioDir, `segment_${i}_voice_replaced.mp4`);
        await this.ffmpeg.replaceAudioTrack(
          segmentPath,
          convertedAudioPath,
          voiceReplacedPath
        );

        voiceReplacedSegments.push(voiceReplacedPath);
        console.log(`      ✓ Segment ${i + 1} voice converted via Speech-to-Speech`);
        console.log('');

        // Cleanup converted audio file
        if (fs.existsSync(convertedAudioPath)) {
          fs.unlinkSync(convertedAudioPath);
        }

      } catch (error) {
        console.error(`      ❌ Failed to convert voice in segment ${i + 1}: ${error}`);
        // Fall back to original segment if voice replacement fails
        voiceReplacedSegments.push(segmentPath);
      }
    }

    // Step 4: Concatenate all voice-replaced segments
    console.log('   🔗 Concatenating voice-replaced segments...');
    const finalVoiceReplacedPath = path.join(finalDir, 'with_elevenlabs_voice.mp4');

    const assembled = await this.ffmpeg.concatenateWithAudio(
      voiceReplacedSegments,
      finalVoiceReplacedPath,
      true // Apply smooth transitions
    );

    console.log('');
    console.log('   ✓ Voice replacement complete (Speech-to-Speech)');
    console.log(`   Final duration: ${assembled.duration.toFixed(2)}s`);

    return finalVoiceReplacedPath;
  }

  /**
   * Simple voice replacement (fallback when individual segments aren't available)
   * This method doesn't do per-segment time matching
   */
  private async simpleVoiceReplacement(
    videoPath: string,
    scenes: LipSyncScene[],
    audioDir: string,
    finalDir: string
  ): Promise<string> {
    // Combine all dialogues into full script
    const fullScript = scenes.map(s => s.dialogue).join(' ');
    console.log(`   Script length: ${fullScript.split(/\s+/).length} words`);

    // Get video duration for reference
    const videoDuration = await this.ffmpeg.getDuration(videoPath);

    // Generate ElevenLabs audio
    const elevenLabsAudioPath = path.join(audioDir, 'elevenlabs_voice.mp3');
    console.log(`   Generating ElevenLabs audio...`);
    await this.elevenlabs.generateAudio(
      fullScript,
      elevenLabsAudioPath,
      videoDuration
    );

    // Time-stretch the entire audio to match video duration
    const audioDuration = await this.ffmpeg.getDuration(elevenLabsAudioPath);
    let audioToUse = elevenLabsAudioPath;

    if (Math.abs(videoDuration - audioDuration) > 0.5) {
      console.log(`   Time-stretching audio to match video...`);
      const stretchedAudioPath = path.join(audioDir, 'elevenlabs_voice_stretched.mp3');
      audioToUse = await this.ffmpeg.timeStretchAudio(
        elevenLabsAudioPath,
        stretchedAudioPath,
        videoDuration
      );
    }

    // Replace audio in video
    const voiceReplacedPath = path.join(finalDir, 'with_elevenlabs_voice.mp4');
    await this.ffmpeg.replaceAudioTrack(videoPath, audioToUse, voiceReplacedPath);

    console.log('   ✓ Voice replaced with ElevenLabs (simple mode with time-stretch)');

    return voiceReplacedPath;
  }

  /**
   * Validate scenes have required fields
   */
  private validateScenes(scenes: LipSyncScene[]): void {
    if (!scenes || scenes.length === 0) {
      throw new Error('No scenes provided');
    }

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (!scene.dialogue || scene.dialogue.trim().length === 0) {
        throw new Error(`Scene ${i + 1} is missing dialogue`);
      }
      if (!scene.visual || scene.visual.trim().length === 0) {
        throw new Error(`Scene ${i + 1} is missing visual description`);
      }
    }
  }

  /**
   * Create directories
   */
  private createDirectories(dirs: string[]): void {
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Log progress
   */
  private logProgress(state: WorkflowState): void {
    const progressBar = this.createProgressBar(state.progress);
    console.log(`[${progressBar}] ${state.progress}% - ${state.currentStep}`);

    if (this.progressCallback) {
      this.progressCallback(state.status, state.currentStep, state.progress);
    }
  }

  /**
   * Create ASCII progress bar
   */
  private createProgressBar(progress: number, width: number = 30): string {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}
