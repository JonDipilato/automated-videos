import { CaptionsService, YOUTUBE_SHORTS_STYLE } from './src/services/captions.service';
import * as dotenv from 'dotenv';

dotenv.config();

async function testCaptions() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in .env');
    process.exit(1);
  }

  // Latest run (Nov 30 17:56) – only burn captions onto existing assets
  const videoPath = 'c:/Users/jon-d/Downloads/Automated-Grok/automated-videos/output/50ee3339-0308-4a0c-a216-9a2b6d80dcb7/final/final_video.mp4';
  const audioPath = 'c:/Users/jon-d/Downloads/Automated-Grok/automated-videos/output/50ee3339-0308-4a0c-a216-9a2b6d80dcb7/audio/narration.mp3';
  const outputPath = 'c:/Users/jon-d/Downloads/Automated-Grok/automated-videos/output/50ee3339-0308-4a0c-a216-9a2b6d80dcb7/final/with_captions.mp4';

  console.log('🎯 Testing captions on existing video...\n');

  const captions = new CaptionsService(apiKey);

  try {
    await captions.addCaptionsWorkflow(
      videoPath,
      audioPath,
      outputPath,
      YOUTUBE_SHORTS_STYLE
    );

    console.log('\n✅ SUCCESS! Video with captions created at:');
    console.log(outputPath);
  } catch (error) {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  }
}

testCaptions();
