import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { videoQueries, jobQueries, portraitQueries } from '@/lib/db';
import path from 'path';

// Import services from CLI
import { ConfigLoader } from '../../../../src/utils/config';
import { OpenAIService } from '../../../../src/services/openai.service';
import { FFmpegService } from '../../../../src/services/ffmpeg.service';
import { CaptionsService } from '../../../../src/services/captions.service';
import { KieLipSyncService } from '../../../../src/services/kie-lipsync.service';
import { GrokLipSyncAutoWorkflow } from '../../../../src/workflows/grok-lipsync-auto.workflow';
import { Platform, BackgroundMood } from '../../../../src/types';

// Request body type
interface LipSyncAutoRequest {
  niche: string;
  topic: string;
  portraitPath: string | null;
  platforms: Platform[];
  backgroundMood: BackgroundMood;
  duration: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LipSyncAutoRequest;
    const { niche, topic, portraitPath, platforms, backgroundMood, duration } = body;

    // Validate database queries are available
    if (!videoQueries?.create || !jobQueries?.create) {
      console.error('Database not properly initialized');
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Validate input
    if (!niche || !topic) {
      return NextResponse.json({ error: 'Missing required fields (niche or topic)' }, { status: 400 });
    }

    // Generate IDs
    const videoId = uuidv4();
    const jobId = uuidv4();

    // Create video record (use niche from form)
    videoQueries.create.run(
      videoId,
      jobId,
      niche,
      topic, // Use topic as title
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
    startLipSyncAutoGeneration(jobId, videoId, {
      niche,
      topic,
      portraitPath: finalPortraitPath,
      platforms: platforms || ['youtube', 'tiktok'],
      backgroundMood: backgroundMood || 'dramatic',
      duration: duration || 30
    }).catch((error) => {
      console.error('Background lip-sync auto generation error:', error);
      jobQueries.fail.run(error.message, jobId);
      videoQueries.updateStatus.run('failed', videoId);
    });

    return NextResponse.json({ jobId, videoId, status: 'started' });
  } catch (error) {
    console.error('Generate Lip Sync Auto API error:', error);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}

async function startLipSyncAutoGeneration(
  jobId: string,
  videoId: string,
  params: {
    niche: string;
    topic: string;
    portraitPath: string;
    platforms: Platform[];
    backgroundMood: BackgroundMood;
    duration: number;
  }
) {
  try {
    // Update job status
    jobQueries.updateProgress.run('generating', 'Initializing Grok Lip Sync Auto services...', 0, jobId);

    // Load configuration
    const config = ConfigLoader.loadServiceConfig();

    // Initialize services
    // KIE API uses its own key (same as GrokService)
    const kieApiKey = process.env.KIE_API_KEY || '';
    if (!kieApiKey) {
      throw new Error('KIE_API_KEY environment variable is required');
    }

    const openai = new OpenAIService(config.openai.apiKey);
    const kieLipSync = new KieLipSyncService(kieApiKey);
    const ffmpeg = new FFmpegService(1080, 30, 'libx264', '5000k');
    const captions = new CaptionsService(config.openai.apiKey);

    // Create workflow with correct output directory
    const workDir = path.resolve(process.cwd(), '..', 'output');
    const workflow = new GrokLipSyncAutoWorkflow(
      openai,
      kieLipSync,
      ffmpeg,
      captions,
      workDir
    );

    // Update progress
    jobQueries.updateProgress.run('generating', 'Starting automatic script generation...', 5, jobId);
    videoQueries.updateStatus.run('generating', videoId);

    console.log('');
    console.log('🎬 STARTING GROK LIP SYNC AUTO WORKFLOW');
    console.log('='.repeat(60));
    console.log(`📋 Job ID: ${jobId}`);
    console.log(`🎯 Niche: ${params.niche}`);
    console.log(`📝 Topic: ${params.topic}`);
    console.log(`🎨 Background Mood: ${params.backgroundMood}`);
    console.log(`⏱️  Duration: ${params.duration}s`);
    console.log(`🎤 Voice: Grok Native Lip Sync`);
    console.log('');

    // Run generation with progress updates
    const result = await workflow.generate(
      params.niche,
      params.topic,
      params.portraitPath,
      params.platforms,
      params.backgroundMood,
      params.duration,
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
      console.log('✅ GROK LIP SYNC AUTO GENERATION COMPLETE!');
      console.log(`📁 Output: ${relativeVideoPath}`);
      console.log('');
    } else {
      throw new Error(result.error || 'Generation failed');
    }
  } catch (error: any) {
    console.error('Lip-sync auto video generation error:', error);
    jobQueries.fail.run(error.message, jobId);
    videoQueries.updateStatus.run('failed', videoId);
  }
}
