import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { videoQueries, jobQueries, portraitQueries } from '@/lib/db';
import path from 'path';

// Import services from CLI
import { ConfigLoader } from '../../../../src/utils/config';
import { ElevenLabsService } from '../../../../src/services/elevenlabs.service';
import { FFmpegService } from '../../../../src/services/ffmpeg.service';
import { CaptionsService } from '../../../../src/services/captions.service';
import { KieLipSyncService } from '../../../../src/services/kie-lipsync.service';
import { GrokLipSyncWorkflow, LipSyncScene } from '../../../../src/workflows/grok-lipsync.workflow';
import { Platform, BackgroundMood } from '../../../../src/types';

// Request body type
interface LipSyncRequest {
  title: string;
  portraitPath: string | null;
  platforms: Platform[];
  backgroundMood: BackgroundMood;
  replaceVoice: boolean;
  voiceId: string | null;
  scenes: LipSyncScene[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LipSyncRequest;
    const { title, portraitPath, platforms, backgroundMood, replaceVoice, voiceId, scenes } = body;

    // Validate environment variables EARLY before doing anything else
    const kieApiKey = process.env.KIE_API_KEY;
    if (!kieApiKey) {
      console.error('KIE_API_KEY environment variable is missing');
      return NextResponse.json({
        error: 'Server configuration error: KIE_API_KEY is not configured'
      }, { status: 500 });
    }

    // Load and validate service config early
    const config = ConfigLoader.loadServiceConfig();
    if (!config.openai.apiKey) {
      console.error('OPENAI_API_KEY environment variable is missing');
      return NextResponse.json({
        error: 'Server configuration error: OPENAI_API_KEY is not configured'
      }, { status: 500 });
    }

    // Validate ElevenLabs config if voice replacement is requested
    if (replaceVoice && !config.elevenlabs.apiKey) {
      console.error('ELEVENLABS_API_KEY required for voice replacement');
      return NextResponse.json({
        error: 'Server configuration error: ELEVENLABS_API_KEY is required for voice replacement'
      }, { status: 500 });
    }

    // Validate database queries are available
    if (!videoQueries?.create || !jobQueries?.create) {
      console.error('Database not properly initialized');
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Validate input
    if (!title || !scenes || scenes.length === 0) {
      return NextResponse.json({ error: 'Missing required fields (title or scenes)' }, { status: 400 });
    }

    // Validate each scene has dialogue and visual
    const invalidScenes = scenes.filter((s) => !s.dialogue || s.dialogue.trim() === '');
    if (invalidScenes.length > 0) {
      return NextResponse.json({
        error: `Scene(s) missing dialogue: ${invalidScenes.map((s) => s.title || 'Untitled').join(', ')}`
      }, { status: 400 });
    }

    // Generate IDs
    const videoId = uuidv4();
    const jobId = uuidv4();

    // Create video record (use 'lipsync' as niche)
    videoQueries.create.run(
      videoId,
      jobId,
      'lipsync',
      title,
      portraitPath || null,
      JSON.stringify(platforms || ['youtube', 'tiktok']),
      'pending'
    );

    // Create job record
    jobQueries.create.run(jobId, videoId, 'pending');

    // Use provided portrait URL or get default from database
    let finalPortraitPath: string = portraitPath || '';
    if (!finalPortraitPath) {
      const defaultPortrait = portraitQueries.getDefault.get() as any;
      if (defaultPortrait) {
        finalPortraitPath = defaultPortrait.filepath;
      } else {
        finalPortraitPath = process.env.DEFAULT_PORTRAIT_URL || '';
        if (!finalPortraitPath) {
          throw new Error('No portrait provided and no default portrait available. Please upload a portrait first.');
        }
      }
    }

    // Start generation in background (non-blocking)
    // Pass the already-validated config to avoid re-loading
    startLipSyncGeneration(jobId, videoId, {
      title,
      portraitPath: finalPortraitPath,
      platforms: platforms || ['youtube', 'tiktok'],
      backgroundMood: backgroundMood || 'dramatic',
      replaceVoice: replaceVoice || false,
      voiceId: voiceId || null,
      scenes
    }, config, kieApiKey).catch((error) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Background lip-sync generation error:', errorMsg);
      jobQueries.fail.run(errorMsg, jobId);
      videoQueries.updateStatus.run('failed', videoId);
    });

    return NextResponse.json({ jobId, videoId, status: 'started' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Generate Lip Sync API error:', errorMessage);
    return NextResponse.json({
      error: 'Generation failed',
      details: errorMessage
    }, { status: 500 });
  }
}

async function startLipSyncGeneration(
  jobId: string,
  videoId: string,
  params: {
    title: string;
    portraitPath: string;
    platforms: Platform[];
    backgroundMood: BackgroundMood;
    replaceVoice: boolean;
    voiceId: string | null;
    scenes: LipSyncScene[];
  },
  config: ReturnType<typeof ConfigLoader.loadServiceConfig>,
  kieApiKey: string
) {
  try {
    // Update job status
    jobQueries.updateProgress.run('generating', 'Initializing Grok Lip Sync services...', 0, jobId);

    // Initialize services with pre-validated config
    const kieLipSync = new KieLipSyncService(kieApiKey);
    const ffmpeg = new FFmpegService(1080, 30, 'libx264', '5000k');
    const captions = new CaptionsService(config.openai.apiKey);

    // Initialize ElevenLabs only if voice replacement is needed
    let elevenlabs: ElevenLabsService | null = null;
    if (params.replaceVoice) {
      const selectedVoiceId = params.voiceId || config.elevenlabs.voiceId;
      console.log(`🎤 Voice replacement enabled. Using: ${selectedVoiceId}`);
      elevenlabs = new ElevenLabsService(
        config.elevenlabs.apiKey,
        selectedVoiceId,
        config.elevenlabs.voiceSettings
      );
    }

    // Create workflow with correct output directory
    const workDir = path.resolve(process.cwd(), '..', 'output');
    const workflow = new GrokLipSyncWorkflow(
      kieLipSync,
      ffmpeg,
      elevenlabs as ElevenLabsService, // Type assertion - will be checked in workflow
      captions,
      workDir
    );

    // Update progress
    jobQueries.updateProgress.run('generating', 'Starting Grok lip-sync generation...', 5, jobId);
    videoQueries.updateStatus.run('generating', videoId);

    console.log('');
    console.log('🎬 STARTING GROK LIP SYNC WORKFLOW');
    console.log('='.repeat(60));
    console.log(`📋 Job ID: ${jobId}`);
    console.log(`🎯 Title: ${params.title}`);
    console.log(`📹 Scenes: ${params.scenes.length}`);
    console.log(`🎨 Background Mood: ${params.backgroundMood}`);
    console.log(`🎤 Voice: ${params.replaceVoice ? 'ElevenLabs (replacement)' : 'Grok Native'}`);
    console.log('');

    // Run generation with progress updates
    const result = await workflow.generate(
      params.title,
      params.scenes,
      params.portraitPath,
      params.platforms,
      {
        replaceVoice: params.replaceVoice,
        voiceId: params.voiceId || undefined,
        backgroundMood: params.backgroundMood,
        addCaptions: true
      },
      // Progress callback
      (status: string, step: string, progress: number) => {
        try {
          jobQueries.updateProgress.run(status, step, progress, jobId);
          console.log(`[DB UPDATE] ${progress}% - ${step}`);
        } catch (err) {
          console.error('Failed to update progress in database:', err);
        }
      }
    );

    if (result.success) {
      // Update job as completed
      jobQueries.complete.run(jobId);

      // Convert absolute videoPath to relative path
      const projectRoot = path.resolve(process.cwd(), '..');
      const relativeVideoPath = result.videoPath
        ? path.relative(projectRoot, result.videoPath).replace(/\\/g, '/')
        : '';

      // Update video with result
      videoQueries.updateVideoPath.run(
        relativeVideoPath,
        result.duration || 0,
        result.segments || 0,
        videoId
      );
      videoQueries.updateStatus.run('completed', videoId);

      console.log('');
      console.log('✅ GROK LIP SYNC GENERATION COMPLETE!');
      console.log(`📁 Output: ${relativeVideoPath}`);
      console.log('');
    } else {
      throw new Error(result.error || 'Generation failed');
    }
  } catch (error: any) {
    console.error('Lip-sync video generation error:', error);
    jobQueries.fail.run(error.message, jobId);
    videoQueries.updateStatus.run('failed', videoId);
  }
}
