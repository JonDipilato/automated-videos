# Automated Video Generation System - Architecture

## Overview
Fully automated video generation pipeline that creates AI-generated videos from a seed portrait photo, with voice narration, smooth transitions, and auto-publishing to social media platforms.

## System Flow

```
1. INPUT: Seed portrait photo + Topic
2. OpenAI generates script and story outline
3. ElevenLabs generates audio (AUDIO-FIRST APPROACH)
4. Calculate required video segments based on audio duration
5. OpenAI generates Grok prompts for each segment
6. Grok Imagine generates:
   - Background images (high quality)
   - 7-second videos from portrait with generated backgrounds
7. FFmpeg assembles:
   - Smooth transitions between videos
   - Background replacement for beginning/ending
   - Audio sync
   - CTA overlay
8. Generate platform-optimized metadata
9. Duplicate content check
10. Schedule on social platforms
11. MANUAL REVIEW (only human intervention point)
```

## Components

### 1. Content Generation Service (OpenAI)
- **Master Prompt Generator**: Creates optimized prompts for Grok
- **Script Generator**: Generates engaging scripts based on topic
- **Metadata Generator**: Platform-specific metadata (YouTube, TikTok, Instagram, etc.)
- **Duplicate Detection**: Ensures unique titles, descriptions, stories

### 2. Audio Generation Service (ElevenLabs)
- **Voice Cloning**: Uses user's voice clone
- **Audio Generation**: Generates narration from script
- **Duration Calculation**: Determines number of 7-second video segments needed

### 3. Visual Generation Service (Grok Imagine)
- **Background Generator**: Creates high-quality background images
- **Video Generator**: Generates 7-second videos from seed portrait
- **Transition Assets**: Creates seamless transition elements

### 4. Video Assembly Service (FFmpeg)
- **Scene Composition**: Assembles video segments
- **Transition Effects**: Smooth crossfades and morphing
- **Audio Sync**: Perfectly aligns audio with video
- **CTA Overlay**: Adds call-to-action graphics
- **Background Replacement**: Swaps portrait background for beginning/ending

### 5. Social Media Service
- **Metadata Optimization**: Platform-specific formatting
- **Scheduling**: Auto-schedule across platforms
- **Lead Generation**: CTA with tracking links

### 6. Storage & State Management
- **Content Database**: Stores all generated content
- **Duplicate Tracker**: Prevents duplicate content
- **Asset Management**: Organizes generated media files

## Technology Stack

- **Language**: TypeScript/Node.js
- **AI Services**:
  - OpenAI GPT-4 (script & prompt generation)
  - Grok Imagine (video & image generation)
  - ElevenLabs (voice synthesis)
- **Video Processing**: FFmpeg
- **Storage**: Local filesystem + optional cloud storage
- **Social Media APIs**:
  - YouTube Data API
  - Instagram Graph API
  - TikTok API
  - Facebook Graph API
  - Twitter API
  - LinkedIn API

## Key Features

### Audio-First Approach
1. Generate complete audio narration first
2. Calculate total duration
3. Determine number of 7-second video segments needed: `Math.ceil(audioDuration / 7)`
4. Generate exact number of video segments to match audio

### Smooth Transitions
- Crossfade between video segments (1-second overlap)
- Background morphing for beginning/ending scenes
- Audio continuity maintained throughout

### Duplicate Prevention
- Hash-based content tracking
- Title/description similarity check (cosine similarity)
- Story outline comparison
- Ensures monetization compliance

### Platform Optimization
Each platform gets optimized:
- **YouTube**: Long-form, SEO-optimized titles/descriptions, timestamps
- **TikTok**: Trending hashtags, hook-focused
- **Instagram Reels**: Visual-first captions, emoji usage
- **Facebook**: Engagement-focused, longer descriptions
- **Twitter**: Concise, thread-friendly
- **LinkedIn**: Professional tone, value-focused

## Configuration

```typescript
interface VideoGenerationConfig {
  seedPortrait: string;           // Path to seed portrait photo
  topic: string;                  // Video topic/theme
  voiceCloneId: string;          // ElevenLabs voice ID
  videoSegmentDuration: number;   // 7 seconds default
  transitionDuration: number;     // 1 second default
  targetPlatforms: Platform[];    // Which platforms to publish to
  ctaConfig: {
    text: string;
    url: string;
    position: 'beginning' | 'end' | 'both';
  };
  schedulingConfig: {
    autoPublish: boolean;
    scheduleTime?: Date;
  };
}
```

## Directory Structure

```
automated-videos/
├── src/
│   ├── services/
│   │   ├── openai.service.ts       # Script & prompt generation
│   │   ├── grok.service.ts         # Grok Imagine integration
│   │   ├── elevenlabs.service.ts   # Voice generation
│   │   ├── ffmpeg.service.ts       # Video assembly
│   │   ├── social-media.service.ts # Platform publishing
│   │   └── duplicate-detector.ts   # Content uniqueness
│   ├── workflows/
│   │   └── video-generation.workflow.ts # Main orchestration
│   ├── utils/
│   │   ├── audio-calculator.ts     # Duration calculations
│   │   ├── prompt-templates.ts     # Prompt templates
│   │   └── metadata-optimizer.ts   # Platform-specific metadata
│   ├── types/
│   │   └── index.ts                # TypeScript definitions
│   └── index.ts                    # Main entry point
├── config/
│   ├── platforms.json              # Platform configurations
│   └── prompts.json                # Prompt templates
├── assets/
│   ├── portraits/                  # Seed portraits
│   ├── cta/                        # CTA graphics
│   └── temp/                       # Temporary working files
├── output/
│   ├── videos/                     # Final videos
│   ├── audio/                      # Generated audio
│   ├── images/                     # Generated images
│   └── metadata/                   # Platform metadata
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## API Requirements

### Required API Keys
- `OPENAI_API_KEY`: OpenAI API access
- `GROK_API_KEY`: Grok Imagine access (xAI)
- `ELEVENLABS_API_KEY`: ElevenLabs API access
- `YOUTUBE_API_KEY`: YouTube Data API
- `INSTAGRAM_ACCESS_TOKEN`: Instagram Graph API
- `TIKTOK_ACCESS_TOKEN`: TikTok API
- `FACEBOOK_ACCESS_TOKEN`: Facebook Graph API
- `TWITTER_API_KEY`: Twitter API
- `LINKEDIN_ACCESS_TOKEN`: LinkedIn API

## Monetization Safety

### Content Uniqueness Checks
1. **Title Uniqueness**: Cosine similarity < 0.8
2. **Description Uniqueness**: Semantic similarity check
3. **Story Uniqueness**: Plot point comparison
4. **Visual Uniqueness**: Different backgrounds and prompts each time

### Database Tracking
Stores:
- All generated titles, descriptions, scripts
- Content fingerprints (hash-based)
- Generation timestamps
- Platform publication status

## Lead Generation CTA

### CTA Options
- "Want to learn how I created this? Link in bio!"
- "Get my FREE AI Video Creation Course 👉 [link]"
- "Download my AI Automation Blueprint: [link]"

### Placement
- Beginning: 3-5 seconds intro overlay
- End: 5-7 seconds outro with full CTA
- Both: Subtle watermark + full outro

## Error Handling & Retry Logic

- API failures: 3 retry attempts with exponential backoff
- Video generation failures: Automatic prompt refinement
- Audio/video sync issues: Automatic re-rendering
- Platform API errors: Queue for manual review

## Performance Optimization

- Parallel generation of video segments
- Caching of successful prompts
- Batch processing for multiple videos
- Optimized FFmpeg settings for quality/speed balance

## Next Steps

1. Set up development environment
2. Install dependencies
3. Configure API keys
4. Test each service independently
5. Test full workflow with sample portrait
6. Optimize and tune parameters
7. Deploy to production environment
