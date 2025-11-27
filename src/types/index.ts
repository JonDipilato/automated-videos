export interface VideoGenerationConfig {
  seedPortrait: string;
  topic: string;
  voiceCloneId: string;
  videoSegmentDuration: number;
  transitionDuration: number;
  targetPlatforms: Platform[];
  ctaConfig: CTAConfig;
  schedulingConfig: SchedulingConfig;
  outputResolution: number;
  maxVideoLength: number;  // Required - must be explicitly set
  introDuration?: number;  // Optional, defaults to 3s
  outroDuration?: number;  // Optional, defaults to 3s
}

export type Platform =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'linkedin';

export interface CTAConfig {
  text: string;
  url: string;
  position: 'beginning' | 'end' | 'both';
  duration?: number;
}

export type ScheduleStrategy = 'optimal' | 'random' | 'manual' | 'smart' | 'immediate';

export interface SchedulingConfig {
  autoPublish: boolean;
  strategy: ScheduleStrategy;
  scheduleTime?: Date; // For manual strategy
  delayHours?: number; // For immediate strategy
  timezone?: string; // Timezone (e.g., 'America/New_York', 'UTC')
  avoidWeekends?: boolean; // Skip weekend posting
  spreadPosts?: boolean; // Spread posts across multiple days
  minGapMinutes?: number; // Minimum gap between posts
}

export interface PlatformSchedule {
  platform: Platform;
  scheduledTime: Date;
  strategy: ScheduleStrategy;
  reasoning: string;
}

export interface ScriptGeneration {
  script: string;
  storyOutline: string;
  keyPoints: string[];
  tone: string;
  estimatedDuration: number;
}

export interface GrokPrompt {
  segmentIndex: number;
  videoPrompt: string;
  backgroundPrompt: string;
  transitionType: 'crossfade' | 'morph' | 'zoom' | 'pan';
  duration: number;
}

export interface AudioGeneration {
  audioPath: string;
  duration: number;
  segmentCount: number;
  format: string;
  sampleRate: number;
}

export interface VideoSegment {
  segmentIndex: number;
  videoPath: string;
  backgroundPath: string;
  duration: number;
  grokPrompt: GrokPrompt;
}

export interface AssembledVideo {
  videoPath: string;
  duration: number;
  resolution: string;
  fileSize: number;
  format: string;
  hasAudio: boolean;
  hasCTA: boolean;
}

export interface PlatformMetadata {
  platform: Platform;
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
  category?: string;
  thumbnail?: string;
  visibility: 'public' | 'private' | 'unlisted';
  scheduledTime?: Date;
}

export interface ContentFingerprint {
  id: string;
  title: string;
  description: string;
  scriptHash: string;
  storyOutlineHash: string;
  createdAt: Date;
  platforms: Platform[];
  publishedUrls: Map<Platform, string>;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarityScore: number;
  matchedContent?: ContentFingerprint;
  reason?: string;
}

export interface PublishResult {
  platform: Platform;
  success: boolean;
  url?: string;
  error?: string;
  scheduledFor?: Date;
}

export interface VideoGenerationResult {
  success: boolean;
  videoPath?: string;
  metadata?: PlatformMetadata[];
  publishResults?: PublishResult[];
  schedules?: PlatformSchedule[];
  error?: string;
  duration?: number;
  segments?: number;
}

export interface GrokImageResponse {
  imageUrl: string;
  prompt: string;
  seed?: number;
  dimensions: {
    width: number;
    height: number;
  };
}

export interface GrokVideoResponse {
  videoUrl: string;
  prompt: GrokPrompt;
  duration: number;
  seedImage: string;
  status: 'processing' | 'completed' | 'failed';
}

export interface ElevenLabsVoiceSettings {
  stability: number;
  similarityBoost: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface TransitionConfig {
  type: 'crossfade' | 'morph' | 'zoom' | 'pan' | 'slide';
  duration: number;
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

export interface FFmpegConfig {
  inputFiles: string[];
  outputPath: string;
  audioPath: string;
  transitions: TransitionConfig[];
  resolution: number;
  fps: number;
  codec: string;
  bitrate: string;
  ctaOverlay?: {
    imagePath: string;
    position: 'beginning' | 'end' | 'both';
    duration: number;
  };
}

export interface PromptTemplate {
  name: string;
  template: string;
  variables: string[];
  category: 'script' | 'video' | 'background' | 'metadata';
}

export interface RetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
}

export interface ServiceConfig {
  openai: {
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  grok: {
    apiKey: string;
    baseUrl: string;
    videoModel: string;
    imageModel: string;
  };
  elevenlabs: {
    apiKey: string;
    voiceId: string;
    voiceSettings: ElevenLabsVoiceSettings;
  };
  retry: RetryConfig;
}

export interface WorkflowState {
  jobId: string;
  status: 'initializing' | 'generating_script' | 'generating_audio' | 'generating_visuals' | 'assembling_video' | 'generating_metadata' | 'publishing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  error?: string;
  result?: VideoGenerationResult;
  startTime: Date;
  endTime?: Date;
}
