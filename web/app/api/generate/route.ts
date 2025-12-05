import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { videoQueries, jobQueries, nicheQueries, portraitQueries } from '@/lib/db';
import path from 'path';

// Import existing services from CLI
import { ConfigLoader } from '../../../../src/utils/config';
import { OpenAIService } from '../../../../src/services/openai.service';
import { GrokService } from '../../../../src/services/grok.service';
import { ElevenLabsService } from '../../../../src/services/elevenlabs.service';
import { FFmpegService } from '../../../../src/services/ffmpeg.service';
import { DuplicateDetector } from '../../../../src/services/duplicate-detector';
import { SocialMediaService } from '../../../../src/services/social-media.service';
import { SchedulerService } from '../../../../src/services/scheduler.service';
import { CaptionsService } from '../../../../src/services/captions.service';
import { VideoGenerationWorkflow } from '../../../../src/workflows/video-generation.workflow';
import { Platform } from '../../../../src/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { niche, topic, portraitPath, duration, platforms } = body;

    // Validate database queries are available
    if (!videoQueries?.create || !jobQueries?.create || !nicheQueries?.getById) {
      console.error('Database not properly initialized');
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Validate input
    if (!niche || !topic) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get niche details
    const nicheData = nicheQueries.getById.get(niche) as any;
    if (!nicheData) {
      return NextResponse.json({ error: 'Invalid niche' }, { status: 400 });
    }

    // Generate IDs
    const videoId = uuidv4();
    const jobId = uuidv4();

    // Create video record
    videoQueries.create.run(
      videoId,
      jobId,
      niche,
      topic,
      portraitPath || null,
      JSON.stringify(platforms || ['youtube', 'tiktok']),
      'pending'
    );

    // Create job record
    jobQueries.create.run(jobId, videoId, 'pending');

    // Use provided portrait URL or get default from database
    let finalPortraitPath = portraitPath;
    if (!finalPortraitPath) {
      const defaultPortrait = portraitQueries.getDefault.get() as any;
      if (defaultPortrait) {
        finalPortraitPath = defaultPortrait.filepath;
      } else {
        // Fallback to environment variable or error
        finalPortraitPath = process.env.DEFAULT_PORTRAIT_URL || '';
        if (!finalPortraitPath) {
          throw new Error('No portrait provided and no default portrait available. Please upload a portrait first.');
        }
      }
    }

    // Start generation in background (non-blocking)
    startVideoGeneration(jobId, videoId, {
      niche: nicheData,
      topic,
      portraitPath: finalPortraitPath,  // Public GCS URL
      duration: duration || nicheData.default_duration,
      platforms: platforms || JSON.parse(nicheData.platforms)
    }).catch((error) => {
      console.error('Background generation error:', error);
      jobQueries.fail.run(error.message, jobId);
      videoQueries.updateStatus.run('failed', videoId);
    });

    return NextResponse.json({ jobId, videoId, status: 'started' });
  } catch (error) {
    console.error('Generate API error:', error);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}

async function startVideoGeneration(
  jobId: string,
  videoId: string,
  params: {
    niche: any;
    topic: string;
    portraitPath: string;
    duration: number;
    platforms: Platform[];
  }
) {
  try {
    // Update job status
    jobQueries.updateProgress.run('generating', 'Initializing services...', 0, jobId);

    // Load configuration
    const config = ConfigLoader.loadServiceConfig();

    // Initialize services (same as CLI)
    const openai = new OpenAIService(config.openai.apiKey, config.openai.model);
    const grok = new GrokService(
      config.grok.apiKey,
      config.grok.baseUrl,
      config.grok.videoModel,
      config.grok.imageModel
    );
    const elevenlabs = new ElevenLabsService(
      config.elevenlabs.apiKey,
      config.elevenlabs.voiceId,
      config.elevenlabs.voiceSettings
    );
    const ffmpeg = new FFmpegService(1080, 30, 'libx264', '5000k');
    const duplicateDetector = new DuplicateDetector(ConfigLoader.getDatabasePath());
    const socialMedia = new SocialMediaService();
    const scheduler = new SchedulerService(process.env.TIMEZONE || 'UTC');
    const captions = new CaptionsService(config.openai.apiKey);

    // Create workflow with correct output directory (relative to project root)
    // Use path.resolve to get absolute path pointing to project root's output folder
    const workDir = path.resolve(process.cwd(), '..', 'output');
    const workflow = new VideoGenerationWorkflow(
      openai,
      grok,
      elevenlabs,
      ffmpeg,
      duplicateDetector,
      socialMedia,
      scheduler,
      captions,
      workDir
    );

    // Create video config
    const videoConfig = ConfigLoader.createDefaultConfig(
      params.portraitPath,
      params.topic,
      params.platforms,
      params.duration
    );

    // Update progress
    jobQueries.updateProgress.run('generating', 'Starting generation...', 5, jobId);
    videoQueries.updateStatus.run('generating', videoId);

    // Run generation with real-time progress updates
    const result = await workflow.generateVideo(
      videoConfig,
      // Progress callback - updates database in real-time
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

      // Convert absolute videoPath to relative path (relative to project root)
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
    } else {
      throw new Error(result.error || 'Generation failed');
    }
  } catch (error: any) {
    console.error('Video generation error:', error);
    jobQueries.fail.run(error.message, jobId);
    videoQueries.updateStatus.run('failed', videoId);
  }
}
