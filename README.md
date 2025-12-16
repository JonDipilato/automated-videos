# 🎬 Automated Video Generation System

> **AI-Powered Video Creation Pipeline** using Grok Imagine, OpenAI GPT-4, and ElevenLabs Voice Cloning

Create professional, AI-generated videos from a single portrait photo with automated narration, smooth transitions, and multi-platform publishing - all with **Audio-First Architecture** for perfect synchronization.

---

## 🌟 Features

### Core Capabilities
- ✅ **Audio-First Approach**: Generate audio narration first, then create exact video segments to match
- ✅ **Grok Imagine Integration**: Generate 7-second video segments from seed portrait photos
- ✅ **Dynamic Backgrounds**: AI-generated high-quality backgrounds for each scene
- ✅ **Smooth Transitions**: Professional crossfades, morphs, and pans between segments
- ✅ **Voice Cloning**: Use ElevenLabs to clone your voice for consistent narration
- ✅ **Background Replacement**: Seamlessly swap portrait backgrounds for intro/outro
- ✅ **CTA Integration**: Add customizable call-to-action overlays for lead generation
- ✅ **Multi-Platform Publishing**: Auto-publish to YouTube, TikTok, Instagram, Facebook, Twitter, LinkedIn
- ✅ **Platform-Optimized Metadata**: SEO-optimized titles, descriptions, and hashtags for each platform
- ✅ **Duplicate Content Detection**: Ensures unique content for monetization compliance
- ✅ **Smart Scheduling**: 5 scheduling strategies based on 2.7B engagement study
- ✅ **Fully Automated**: Runs end-to-end with only manual review before publishing

---

## 🏗️ Architecture

### Workflow Overview

```
1. 📝 OpenAI generates engaging script and story outline
2. 🎤 ElevenLabs generates audio narration (AUDIO-FIRST)
3. 📊 Calculate video segments needed based on audio duration
4. 🎨 OpenAI generates optimized Grok prompts for each segment
5. 🖼️ Grok generates high-quality background images
6. 🎥 Grok generates 7-second videos from seed portrait
7. 🎞️ FFmpeg assembles videos with smooth transitions
8. 🔊 Sync audio perfectly with video
9. 📌 Add CTA overlay for lead generation
10. 📋 Generate platform-optimized metadata
11. 🔍 Check for duplicate content
12. 📤 Auto-publish to social media platforms
13. 👀 Manual review (only human intervention point)
```

### Audio-First Approach

The system generates audio **first** to determine the exact number of video segments needed:

```typescript
Audio Duration: 42 seconds
Segment Duration: 7 seconds
Required Segments: Math.ceil(42 / 7) = 6 segments

// Then generate exactly 6 video segments to match
```

This ensures **perfect audio-video synchronization** every time.

---

## 🚀 Quick Start

### Prerequisites

1. **Node.js** 18+ installed
2. **FFmpeg** installed and in PATH
3. API Keys for:
   - OpenAI (GPT-4)
   - Grok/xAI (for Imagine)
   - ElevenLabs (voice cloning)
   - Social media platforms (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/automated-videos.git
cd automated-videos

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env
```

### Configuration

Edit `.env` file with your credentials:

```env
# Required
OPENAI_API_KEY=sk-...
GROK_API_KEY=xai-...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...

# Optional (for auto-publishing)
YOUTUBE_API_KEY=...
INSTAGRAM_ACCESS_TOKEN=...
TIKTOK_ACCESS_TOKEN=...
# ... etc
```

### Validate Setup

```bash
npm start validate
```

### Generate Your First Video

```bash
npm start generate -- \
  --portrait=./assets/portraits/me.jpg \
  --topic="5 AI Tips for Content Creators" \
  --platforms=youtube,tiktok,instagram
```

---

## 📖 Usage

### Commands

#### Generate Video
```bash
npm start generate -- --portrait=<path> --topic="<topic>" [--platforms=<list>]
```

**Arguments:**
- `--portrait`: Path to your seed portrait photo (required)
- `--topic`: Video topic/theme (required)
- `--platforms`: Comma-separated list of platforms (optional)
  - Options: `youtube`, `tiktok`, `instagram`, `facebook`, `twitter`, `linkedin`
  - Default: `youtube,tiktok,instagram`

**Example:**
```bash
npm start generate -- \
  --portrait=./assets/portraits/john.jpg \
  --topic="Top 3 Marketing Strategies for 2025" \
  --platforms=youtube,linkedin
```

#### Validate Configuration
```bash
npm start validate
```

Checks:
- API keys are configured
- FFmpeg is installed
- Voice clone is accessible
- Platform credentials are valid

#### Show Statistics
```bash
npm start stats
```

Displays:
- Total videos generated
- Platform distribution
- Content history

---

## 🎨 Customization

### CTA Configuration

Edit `.env` to customize your call-to-action:

```env
CTA_TEXT=Want to learn how I made this? Link in bio!
CTA_URL=https://your-landing-page.com
CTA_POSITION=end  # Options: beginning, end, both
CTA_DURATION=5
```

### Video Settings

```env
VIDEO_SEGMENT_DURATION=7    # Duration of each segment in seconds
TRANSITION_DURATION=1       # Transition length in seconds
OUTPUT_RESOLUTION=1080      # Output resolution (720, 1080, 1440)
MAX_VIDEO_LENGTH=180        # Maximum video length in seconds
```

### Voice Settings

Optimize for different content types:

```env
ELEVENLABS_STABILITY=0.5        # 0-1 (higher = more consistent)
ELEVENLABS_SIMILARITY_BOOST=0.75  # 0-1 (higher = closer to original)
ELEVENLABS_STYLE=0.5           # 0-1 (higher = more expressive)
ELEVENLABS_USE_SPEAKER_BOOST=true
```

### Scheduling Settings

The system includes **5 research-backed scheduling strategies** based on analyzing 2.7 billion social media engagements:

```env
# Scheduling Strategy
SCHEDULE_STRATEGY=optimal    # Options: optimal, random, manual, smart, immediate
SCHEDULE_TIMEZONE=UTC        # Your timezone
SCHEDULE_AVOID_WEEKENDS=false
SCHEDULE_SPREAD_POSTS=false
SCHEDULE_MIN_GAP_MINUTES=15

# Auto-Publishing
AUTO_PUBLISH=false           # Set to true to auto-publish
```

**Scheduling Strategies:**

1. **optimal** (Recommended): Research-backed best times for maximum engagement
2. **random**: Randomize within optimal windows for organic look
3. **manual**: You specify exact time (`SCHEDULE_MANUAL_TIME=2025-01-25T14:00:00Z`)
4. **smart**: Optimal times with automatic conflict avoidance
5. **immediate**: Post ASAP with optional delay

**📖 See [SCHEDULING.md](./SCHEDULING.md) for detailed documentation**

---

## 🎯 Best Practices

### Portrait Photos
- **Resolution**: At least 1080x1080 pixels
- **Format**: JPG or PNG
- **Background**: Clean, solid background works best
- **Lighting**: Even, natural lighting
- **Expression**: Neutral expression for versatility

### Topics
- **Specificity**: Be specific (e.g., "5 AI Copywriting Tips" vs "AI Tips")
- **Length**: Aim for 60-90 seconds of content
- **Structure**: Include hook, value, and CTA elements
- **Keywords**: Include relevant keywords for SEO

### Monetization Safety
The system includes built-in duplicate detection to protect your monetization:

- **Title Uniqueness**: <85% similarity
- **Description Uniqueness**: <80% similarity
- **Script Uniqueness**: Hash-based exact match detection
- **Story Uniqueness**: Outline comparison

All content is logged to prevent future duplicates.

---

## 🔧 Advanced Configuration

### Custom Prompt Templates

Create custom prompts in `config/prompts.json`:

```json
{
  "script_template": "Create a {tone} script about {topic}...",
  "video_prompt_template": "Professional video of {description}...",
  "background_prompt_template": "Cinematic background showing {scene}..."
}
```

### Platform-Specific Optimization

Each platform gets optimized metadata:

- **YouTube**: SEO-focused titles, long descriptions, 10-15 tags
- **TikTok**: Hook-focused, trending hashtags
- **Instagram**: Visual-first captions, 15-20 hashtags
- **Facebook**: Engagement-focused, community language
- **Twitter**: Concise (<280 chars), 2-3 hashtags
- **LinkedIn**: Professional tone, value-focused

### Batch Processing

Generate multiple videos in sequence:

```bash
# Create a batch script
for topic in "AI Tip 1" "AI Tip 2" "AI Tip 3"; do
  npm start generate -- \
    --portrait=./assets/portraits/me.jpg \
    --topic="$topic" \
    --platforms=youtube,tiktok
  sleep 60
done
```

---

## 📊 Output Structure

```
output/
└── <job-id>/
    ├── audio/
    │   └── narration.mp3           # Generated audio
    ├── videos/
    │   ├── intro.mp4               # Intro with custom background
    │   ├── segment_0.mp4           # Video segment 1
    │   ├── segment_1.mp4           # Video segment 2
    │   ├── ...
    │   └── outro.mp4               # Outro with custom background
    ├── images/
    │   ├── background_0.png        # Background image 1
    │   ├── background_1.png        # Background image 2
    │   └── ...
    └── final/
        └── final_video.mp4         # Complete assembled video
```

---

## 🔐 API Key Setup

### OpenAI
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create API key
3. Add to `.env` as `OPENAI_API_KEY`

### Grok (xAI)
1. Go to [x.ai](https://x.ai)
2. Sign up for API access
3. Generate API key
4. Add to `.env` as `GROK_API_KEY`

### ElevenLabs
1. Go to [elevenlabs.io](https://elevenlabs.io)
2. Create account
3. Clone your voice (Professional Voice Cloning)
4. Copy Voice ID
5. Generate API key
6. Add both to `.env`:
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_VOICE_ID`

### Social Media Platforms

<details>
<summary><b>YouTube API Setup</b></summary>

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project
3. Enable YouTube Data API v3
4. Create OAuth 2.0 credentials
5. Download credentials
6. Run OAuth flow to get refresh token
7. Add to `.env`:
   ```env
   YOUTUBE_CLIENT_ID=...
   YOUTUBE_CLIENT_SECRET=...
   YOUTUBE_REFRESH_TOKEN=...
   ```
</details>

<details>
<summary><b>Instagram API Setup</b></summary>

1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create app
3. Add Instagram Graph API
4. Get access token and business account ID
5. Add to `.env`:
   ```env
   INSTAGRAM_ACCESS_TOKEN=...
   INSTAGRAM_BUSINESS_ACCOUNT_ID=...
   ```
</details>

<details>
<summary><b>TikTok API Setup</b></summary>

1. Go to [TikTok Developers](https://developers.tiktok.com)
2. Create app
3. Request API access
4. Get client key and access token
5. Add to `.env`:
   ```env
   TIKTOK_CLIENT_KEY=...
   TIKTOK_ACCESS_TOKEN=...
   ```
</details>

---

## 🐛 Troubleshooting

### FFmpeg Not Found
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

### API Rate Limits
If you hit rate limits, adjust in `.env`:
```env
MAX_RETRIES=5
RETRY_DELAY_MS=2000
```

### Memory Issues
For large videos, increase Node.js memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start generate -- ...
```

### Grok Video Generation Timeout
Increase timeout in `.env`:
```env
GROK_TIMEOUT_MS=300000  # 5 minutes
```

---

## 📈 Performance Tips

1. **Parallel Generation**: Videos generate in parallel by default
2. **Prompt Caching**: Successful prompts are cached
3. **Local Processing**: FFmpeg runs locally for speed
4. **Batch Mode**: Generate multiple videos sequentially
5. **Resource Management**: Clean temp files automatically

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- **OpenAI** for GPT-4 API
- **xAI** for Grok Imagine
- **ElevenLabs** for voice cloning technology
- **FFmpeg** for video processing
- Community contributors

---

## 📞 Support

- 📖 [Documentation](./ARCHITECTURE.md)
- 🐛 [Issue Tracker](https://github.com/yourusername/automated-videos/issues)
- 💬 [Discussions](https://github.com/yourusername/automated-videos/discussions)

---

## 🎓 Learn More

Want to learn how to build systems like this? Check out:

- [Video Tutorial Series](#) (coming soon)
- [Blog Post: Building an AI Video Pipeline](#)
- [Case Study: Automating Content Creation](#)

---

## 🚦 Roadmap

- [x] Audio-first video generation
- [x] Multi-platform publishing
- [x] Duplicate content detection
- [ ] Thumbnail generation
- [ ] A/B testing for metadata
- [ ] Analytics integration
- [ ] Batch scheduling
- [ ] Custom transition effects
- [ ] Multi-language support
- [ ] Video editing interface

---

## ⚡ Quick Examples

### Example 1: Tech Tutorial
```bash
npm start generate -- \
  --portrait=./assets/portraits/tech-expert.jpg \
  --topic="How to Build an AI Chatbot in 5 Minutes" \
  --platforms=youtube,linkedin
```

### Example 2: Marketing Tips
```bash
npm start generate -- \
  --portrait=./assets/portraits/marketer.jpg \
  --topic="3 Instagram Growth Hacks That Actually Work" \
  --platforms=instagram,tiktok,facebook
```

### Example 3: Educational Content
```bash
npm start generate -- \
  --portrait=./assets/portraits/teacher.jpg \
  --topic="Understanding Quantum Computing for Beginners" \
  --platforms=youtube,twitter
```

---

## 💡 Pro Tips

1. **Test First**: Run with `AUTO_PUBLISH=false` to review before publishing
2. **Optimize Voice**: Experiment with voice settings for your content type
3. **Platform Strategy**: Different content performs better on different platforms
4. **Consistency**: Use the same portrait across videos for brand recognition
5. **Analytics**: Track which topics and platforms perform best
6. **Batch Create**: Create multiple videos at once for content calendars
7. **Iterate**: Refine prompts based on video quality

---

**Made with ❤️ using AI**

*Automate your content creation. Focus on strategy. Scale your reach.*
