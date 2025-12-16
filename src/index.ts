#!/usr/bin/env node

import * as path from 'path';
import { ConfigLoader } from './utils/config';
import { Logger } from './utils/logger';
import { OpenAIService } from './services/openai.service';
import { GrokService } from './services/grok.service';
import { ElevenLabsService } from './services/elevenlabs.service';
import { FFmpegService } from './services/ffmpeg.service';
import { DuplicateDetector } from './services/duplicate-detector';
import { SocialMediaService } from './services/social-media.service';
import { SchedulerService } from './services/scheduler.service';
import { CaptionsService } from './services/captions.service';
import { VideoGenerationWorkflow } from './workflows/video-generation.workflow';
import { Platform } from './types';

async function main() {
  const logger = new Logger();

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║        🎬 AUTOMATED VIDEO GENERATION SYSTEM 🎬                 ║');
  console.log('║                                                                ║');
  console.log('║   AI-Powered Video Creation with Grok, OpenAI & ElevenLabs    ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'help' || command === '--help' || command === '-h' || !command) {
    printHelp();
    return;
  }

  if (command === 'generate') {
    await runGeneration(args.slice(1), logger);
  } else if (command === 'validate') {
    await runValidation(logger);
  } else if (command === 'stats') {
    await showStats(logger);
  } else {
    console.error(`Unknown command: ${command}`);
    console.log('Run "npm start help" for usage information');
  }
}

async function runGeneration(args: string[], logger: Logger) {
  try {
    // Load configuration
    const config = ConfigLoader.loadServiceConfig();

    // Validate configuration
    const errors = ConfigLoader.validateConfig(config);
    if (errors.length > 0) {
      console.error('❌ Configuration errors:');
      errors.forEach((error) => console.error(`  - ${error}`));
      console.error('');
      console.error('Please check your .env file and ensure all required API keys are set.');
      process.exit(1);
    }

    ConfigLoader.printConfigSummary(config);

    // Validate FFmpeg
    if (!FFmpegService.validateFFmpeg()) {
      console.error('Please install FFmpeg: https://ffmpeg.org/download.html');
      process.exit(1);
    }

    // Parse arguments (supports both --arg=value and --arg value syntax)
    const parseArg = (argName: string): string | undefined => {
      // Try --arg=value format first
      const withEquals = args.find((arg) => arg.startsWith(`${argName}=`))?.split('=')[1];
      if (withEquals) return withEquals;

      // Fallback to --arg value format
      const index = args.indexOf(argName);
      if (index !== -1 && index + 1 < args.length) {
        return args[index + 1];
      }

      return undefined;
    };

    const seedPortrait = parseArg('--portrait');
    const topic = parseArg('--topic');
    const platformsArg = parseArg('--platforms');
    const maxLengthArg = parseArg('--max-length');
    const niche = parseArg('--niche');

    if (!seedPortrait || !topic) {
      console.error('❌ Missing required arguments');
      console.error('');
      console.error('Usage:');
      console.error('  npm start generate -- --portrait <path> --topic <topic> [--platforms <list>] [--max-length <seconds>] [--niche <niche>]');
      console.error('');
      console.error('Example:');
      console.error('  npm start generate -- --portrait "./assets/portraits/me.jpg" --topic "5 AI Tips" --platforms youtube,tiktok,instagram --max-length 14');
      console.error('  npm start generate -- --portrait "./assets/portraits/goku.png" --topic "Goku vs Vegeta" --niche epic-battles --max-length 60');
      console.error('');
      console.error('Available niches: ai-tech, business, fitness, personal-dev, education, content, cooking, real-estate, gaming, faith, epic-battles, custom');
      process.exit(1);
    }

    const platforms = platformsArg
      ? (platformsArg.split(',').map((p) => p.trim()) as Platform[])
      : undefined;

    const maxVideoLength = maxLengthArg ? parseInt(maxLengthArg, 10) : undefined;

    // Create video generation config
    const videoConfig = ConfigLoader.createDefaultConfig(
      seedPortrait,
      topic,
      platforms,
      maxVideoLength,  // Pass CLI argument directly
      niche            // Pass niche for specialized visual styles
    );

    // Initialize services
    console.log('🔧 Initializing services...');
    const openai = new OpenAIService(
      config.openai.apiKey,
      config.openai.model
    );
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
    const ffmpeg = new FFmpegService(
      videoConfig.outputResolution,
      30,
      'libx264',
      '5000k'
    );
    const duplicateDetector = new DuplicateDetector(
      ConfigLoader.getDatabasePath()
    );
    const socialMedia = new SocialMediaService();
    const scheduler = new SchedulerService(
      videoConfig.schedulingConfig.timezone || 'UTC'
    );
    const captions = new CaptionsService(config.openai.apiKey);

    console.log('✓ Services initialized');
    console.log('');

    // Create workflow
    const workflow = new VideoGenerationWorkflow(
      openai,
      grok,
      elevenlabs,
      ffmpeg,
      duplicateDetector,
      socialMedia,
      scheduler,
      captions
    );

    // Validate config
    console.log('🔍 Validating configuration...');
    const validationErrors = await workflow.validateConfig(videoConfig);
    if (validationErrors.length > 0) {
      console.warn('⚠️  Configuration warnings:');
      validationErrors.forEach((error) => console.warn(`  - ${error}`));
      console.log('');
    } else {
      console.log('✓ Configuration validated');
      console.log('');
    }

    // Validate video config
    const videoConfigErrors = ConfigLoader.validateVideoConfig(videoConfig);
    if (videoConfigErrors.length > 0) {
      console.error('❌ Video configuration errors:');
      videoConfigErrors.forEach((error) => console.error(`  - ${error}`));
      process.exit(1);
    }

    // Display duration breakdown
    console.log(`📏 Target video duration: ${videoConfig.maxVideoLength}s`);
    console.log(`   Segment duration: ${videoConfig.videoSegmentDuration}s`);
    console.log(`   Intro: ${videoConfig.introDuration || 3}s, Outro: ${videoConfig.outroDuration || 3}s`);
    const contentDuration = videoConfig.maxVideoLength - (videoConfig.introDuration || 3) - (videoConfig.outroDuration || 3);
    console.log(`   Content duration: ${contentDuration}s`);
    console.log('');

    // Run generation
    const result = await workflow.generateVideo(videoConfig);

    if (result.success) {
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('  ✅ SUCCESS! Your video is ready for review!');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
      console.log(`📁 Video Location: ${result.videoPath}`);
      console.log(`⏱️  Duration: ${result.duration?.toFixed(2)}s`);
      console.log(`🎬 Segments: ${result.segments}`);
      console.log('');

      if (result.schedules && result.schedules.length > 0) {
        console.log('📅 Posting Schedule:');
        result.schedules.forEach((schedule) => {
          console.log(`  ${scheduler.formatSchedule(schedule)}`);
        });
        console.log('');
      }

      if (result.publishResults) {
        console.log('📤 Publishing Status:');
        result.publishResults.forEach((pr) => {
          const icon = pr.success ? '✓' : '✗';
          console.log(`  ${icon} ${pr.platform}: ${pr.url || pr.error}`);
        });
        console.log('');
      }

      console.log('👀 Please review the video before final publishing!');
      console.log('');
    } else {
      console.error('❌ Video generation failed');
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    logger.error('Fatal error during video generation', error);
    console.error('');
    console.error('❌ Fatal error occurred');
    console.error(error);
    process.exit(1);
  }
}

async function runValidation(logger: Logger) {
  console.log('🔍 Validating system configuration...');
  console.log('');

  // Load config
  const config = ConfigLoader.loadServiceConfig();
  const errors = ConfigLoader.validateConfig(config);

  if (errors.length > 0) {
    console.error('❌ Configuration errors:');
    errors.forEach((error) => console.error(`  - ${error}`));
    console.log('');
    process.exit(1);
  }

  // Check FFmpeg
  const ffmpegValid = FFmpegService.validateFFmpeg();
  if (!ffmpegValid) {
    console.error('❌ FFmpeg not found');
    process.exit(1);
  }

  // Validate services
  console.log('🔧 Validating API connections...');

  try {
    const elevenlabs = new ElevenLabsService(
      config.elevenlabs.apiKey,
      config.elevenlabs.voiceId,
      config.elevenlabs.voiceSettings
    );
    await elevenlabs.validateVoice();
  } catch (error) {
    console.error('❌ ElevenLabs validation failed');
  }

  const socialMedia = new SocialMediaService();
  const configuredPlatforms = socialMedia.getConfiguredPlatforms();

  console.log('');
  console.log('✓ Configuration valid');
  console.log(`✓ Configured platforms: ${configuredPlatforms.join(', ') || 'none'}`);
  console.log('');
  console.log('🎉 System is ready to generate videos!');
  console.log('');
}

async function showStats(logger: Logger) {
  const duplicateDetector = new DuplicateDetector(ConfigLoader.getDatabasePath());
  const stats = duplicateDetector.getStatistics();

  console.log('📊 Content Statistics');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Total Videos Generated: ${stats.totalContent}`);
  console.log('');
  console.log('Platform Distribution:');
  stats.platformCounts.forEach((count, platform) => {
    console.log(`  ${platform}: ${count}`);
  });
  console.log('');
  if (stats.oldestContent) {
    console.log(`Oldest Content: ${stats.oldestContent.toLocaleDateString()}`);
  }
  if (stats.newestContent) {
    console.log(`Newest Content: ${stats.newestContent.toLocaleDateString()}`);
  }
  console.log('');
}

function printHelp() {
  console.log('USAGE:');
  console.log('  npm start <command> [options]');
  console.log('');
  console.log('COMMANDS:');
  console.log('  generate      Generate a new video');
  console.log('  validate      Validate system configuration');
  console.log('  stats         Show content generation statistics');
  console.log('  help          Show this help message');
  console.log('');
  console.log('GENERATE OPTIONS:');
  console.log('  --portrait <path>         Path to seed portrait image (required)');
  console.log('  --topic <text>            Video topic/theme (required)');
  console.log('  --platforms <list>        Comma-separated platforms (optional)');
  console.log('                            Options: youtube,tiktok,instagram,facebook,twitter,linkedin');
  console.log('  --max-length <seconds>    Maximum video length in seconds (optional, default: 60s)');
  console.log('');
  console.log('EXAMPLES:');
  console.log('  # Generate 14-second video for YouTube and TikTok');
  console.log('  npm start generate -- --portrait "./assets/portraits/me.jpg" --topic "5 AI Tips" --platforms youtube,tiktok --max-length 14');
  console.log('');
  console.log('  # Validate configuration');
  console.log('  npm start validate');
  console.log('');
  console.log('  # Show statistics');
  console.log('  npm start stats');
  console.log('');
  console.log('SETUP:');
  console.log('  1. Copy .env.example to .env');
  console.log('  2. Fill in your API keys');
  console.log('  3. Add your portrait photo to assets/portraits/');
  console.log('  4. Run "npm start validate" to check configuration');
  console.log('  5. Run "npm start generate" to create your first video');
  console.log('');
  console.log('DOCUMENTATION:');
  console.log('  See README.md for detailed setup instructions');
  console.log('  See ARCHITECTURE.md for system design details');
  console.log('');
}

// Run main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
