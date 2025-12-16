import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { videoQueries, jobQueries, portraitQueries } from '@/lib/db';
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
import { CustomScriptWorkflow } from '../../../../src/workflows/custom-script.workflow';
import { Platform } from '../../../../src/types';

// Scene type matching frontend
interface CustomScene {
  id: string;
  timestamp: string;
  title: string;
  visual: string;
  voiceover: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, portraitPath, platforms, voiceId, scenes } = body;

    // Validate database queries are available
    if (!videoQueries?.create || !jobQueries?.create) {
      console.error('Database not properly initialized');
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Validate input
    if (!title || !scenes || scenes.length === 0) {
      return NextResponse.json({ error: 'Missing required fields (title or scenes)' }, { status: 400 });
    }

    // Validate each scene has voiceover
    const invalidScenes = scenes.filter((s: CustomScene) => !s.voiceover || s.voiceover.trim() === '');
    if (invalidScenes.length > 0) {
      return NextResponse.json({
        error: `Scene(s) missing voiceover: ${invalidScenes.map((s: CustomScene) => s.title || 'Untitled').join(', ')}`
      }, { status: 400 });
    }

    // Generate IDs
    const videoId = uuidv4();
    const jobId = uuidv4();

    // Create video record (use 'custom' as niche)
    videoQueries.create.run(
      videoId,
      jobId,
      'custom',
      title,
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
        finalPortraitPath = process.env.DEFAULT_PORTRAIT_URL || '';
        if (!finalPortraitPath) {
          throw new Error('No portrait provided and no default portrait available. Please upload a portrait first.');
        }
      }
    }

    // Start generation in background (non-blocking)
    startCustomVideoGeneration(jobId, videoId, {
      title,
      portraitPath: finalPortraitPath,
      platforms: platforms || ['youtube', 'tiktok'],
      voiceId: voiceId || null,
      scenes: scenes as CustomScene[]
    }).catch((error) => {
      console.error('Background custom generation error:', error);
      jobQueries.fail.run(error.message, jobId);
      videoQueries.updateStatus.run('failed', videoId);
    });

    return NextResponse.json({ jobId, videoId, status: 'started' });
  } catch (error) {
    console.error('Generate Custom API error:', error);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}

async function startCustomVideoGeneration(
  jobId: string,
  videoId: string,
  params: {
    title: string;
    portraitPath: string;
    platforms: Platform[];
    voiceId: string | null;
    scenes: CustomScene[];
  }
) {
  try {
    // Update job status
    jobQueries.updateProgress.run('generating', 'Initializing services...', 0, jobId);

    // Load configuration
    const config = ConfigLoader.loadServiceConfig();

    // Initialize services
    const openai = new OpenAIService(config.openai.apiKey, config.openai.model);
    const grok = new GrokService(
      config.grok.apiKey,
      config.grok.baseUrl,
      config.grok.videoModel,
      config.grok.imageModel
    );

    // Use selected voice ID if provided, otherwise fall back to config default
    const selectedVoiceId = params.voiceId || config.elevenlabs.voiceId;
    console.log(`🎤 Using voice: ${selectedVoiceId}${params.voiceId ? ' (selected)' : ' (default from config)'}`);

    const elevenlabs = new ElevenLabsService(
      config.elevenlabs.apiKey,
      selectedVoiceId,
      config.elevenlabs.voiceSettings
    );
    const ffmpeg = new FFmpegService(1080, 30, 'libx264', '5000k');
    const duplicateDetector = new DuplicateDetector(ConfigLoader.getDatabasePath());
    const socialMedia = new SocialMediaService();
    const scheduler = new SchedulerService(process.env.TIMEZONE || 'UTC');
    const captions = new CaptionsService(config.openai.apiKey);

    // Create workflow with correct output directory
    const workDir = path.resolve(process.cwd(), '..', 'output');
    const workflow = new CustomScriptWorkflow(
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

    // Update progress
    jobQueries.updateProgress.run('generating', 'Starting custom script generation...', 5, jobId);
    videoQueries.updateStatus.run('generating', videoId);

    // Run generation with progress updates
    const result = await workflow.generateFromCustomScript(
      params.title,
      params.scenes,
      params.portraitPath,
      params.platforms,
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
    } else {
      throw new Error(result.error || 'Generation failed');
    }
  } catch (error: any) {
    console.error('Custom video generation error:', error);
    jobQueries.fail.run(error.message, jobId);
    videoQueries.updateStatus.run('failed', videoId);
  }
}
