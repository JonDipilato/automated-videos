import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  VideoGenerationConfig,
  Platform,
  ServiceConfig,
  ElevenLabsVoiceSettings,
} from '../types';

// Load environment variables
dotenv.config();

export class ConfigLoader {
  /**
   * Loads service configuration from environment variables
   */
  static loadServiceConfig(): ServiceConfig {
    return {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000'),
      },
      grok: {
        apiKey: process.env.GROK_API_KEY || '',
        baseUrl: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
        videoModel: process.env.GROK_VIDEO_MODEL || 'grok-video-beta',
        imageModel: process.env.GROK_IMAGE_MODEL || 'grok-vision-beta',
      },
      elevenlabs: {
        apiKey: process.env.ELEVENLABS_API_KEY || '',
        voiceId: process.env.ELEVENLABS_VOICE_ID || '',
        voiceSettings: {
          stability: parseFloat(process.env.ELEVENLABS_STABILITY || '0.5'),
          similarityBoost: parseFloat(
            process.env.ELEVENLABS_SIMILARITY_BOOST || '0.75'
          ),
          style: parseFloat(process.env.ELEVENLABS_STYLE || '0.5'),
          useSpeakerBoost:
            process.env.ELEVENLABS_USE_SPEAKER_BOOST === 'true',
        },
      },
      retry: {
        maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
        retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000'),
        backoffMultiplier: parseFloat(process.env.BACKOFF_MULTIPLIER || '2'),
      },
    };
  }

  /**
   * Creates default video generation config
   */
  static createDefaultConfig(
    seedPortrait: string,
    topic: string,
    platforms?: Platform[]
  ): VideoGenerationConfig {
    return {
      seedPortrait,
      topic,
      voiceCloneId: process.env.ELEVENLABS_VOICE_ID || '',
      videoSegmentDuration: parseInt(
        process.env.VIDEO_SEGMENT_DURATION || '7'
      ),
      transitionDuration: parseInt(process.env.TRANSITION_DURATION || '1'),
      targetPlatforms: platforms || this.parsePlatforms(
        process.env.TARGET_PLATFORMS || 'youtube,tiktok,instagram'
      ),
      ctaConfig: {
        text: process.env.CTA_TEXT || 'Want to learn how? Link in bio!',
        url: process.env.CTA_URL || 'https://example.com',
        position: (process.env.CTA_POSITION as any) || 'end',
        duration: parseInt(process.env.CTA_DURATION || '5'),
      },
      schedulingConfig: {
        autoPublish: process.env.AUTO_PUBLISH === 'true',
        strategy: (process.env.SCHEDULE_STRATEGY as any) || 'optimal',
        scheduleTime: process.env.SCHEDULE_MANUAL_TIME
          ? new Date(process.env.SCHEDULE_MANUAL_TIME)
          : undefined,
        delayHours: parseInt(process.env.SCHEDULE_DELAY_HOURS || '0'),
        timezone: process.env.SCHEDULE_TIMEZONE || 'UTC',
        avoidWeekends: process.env.SCHEDULE_AVOID_WEEKENDS === 'true',
        spreadPosts: process.env.SCHEDULE_SPREAD_POSTS === 'true',
        minGapMinutes: parseInt(process.env.SCHEDULE_MIN_GAP_MINUTES || '15'),
      },
      outputResolution: parseInt(process.env.OUTPUT_RESOLUTION || '1080'),
      maxVideoLength: parseInt(process.env.MAX_VIDEO_LENGTH || '180'),
    };
  }

  /**
   * Validates configuration
   */
  static validateConfig(config: ServiceConfig): string[] {
    const errors: string[] = [];

    if (!config.openai.apiKey) {
      errors.push('OPENAI_API_KEY is required');
    }

    if (!config.grok.apiKey) {
      errors.push('GROK_API_KEY is required');
    }

    if (!config.elevenlabs.apiKey) {
      errors.push('ELEVENLABS_API_KEY is required');
    }

    if (!config.elevenlabs.voiceId) {
      errors.push('ELEVENLABS_VOICE_ID is required');
    }

    return errors;
  }

  /**
   * Parses comma-separated platform string
   */
  private static parsePlatforms(platformsStr: string): Platform[] {
    return platformsStr
      .split(',')
      .map((p) => p.trim() as Platform)
      .filter((p) =>
        ['youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'linkedin'].includes(p)
      );
  }

  /**
   * Gets database path
   */
  static getDatabasePath(): string {
    return process.env.DATABASE_PATH || './data/content.db.json';
  }

  /**
   * Prints configuration summary (without sensitive data)
   */
  static printConfigSummary(config: ServiceConfig): void {
    console.log('🔧 Configuration Summary:');
    console.log(`  OpenAI Model: ${config.openai.model}`);
    console.log(`  Grok Video Model: ${config.grok.videoModel}`);
    console.log(`  Grok Image Model: ${config.grok.imageModel}`);
    console.log(`  Voice ID: ${config.elevenlabs.voiceId.substring(0, 8)}...`);
    console.log(`  Max Retries: ${config.retry.maxRetries}`);
    console.log('');
  }
}
