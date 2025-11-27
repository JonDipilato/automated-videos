import * as dotenv from 'dotenv';
import { KieService } from './src/services/kie.service';
import * as path from 'path';

// Force reload environment variables
delete require.cache[require.resolve('dotenv')];
dotenv.config({ override: true });

async function testKieVideoGeneration() {
  console.log('🧪 Testing KIE.AI Image-to-Video Generation\n');

  // Initialize KIE service
  const kieApiKey = process.env.KIE_API_KEY || '';
  if (!kieApiKey) {
    console.error('❌ KIE_API_KEY not found in environment');
    process.exit(1);
  }

  const kieService = new KieService(kieApiKey);

  // Test parameters
  const portraitUrl = process.env.PORTRAIT_URL || '';
  const outputDir = path.join(__dirname, 'output', 'test-kie');

  console.log(`📸 Portrait URL: ${portraitUrl}`);
  console.log(`📁 Output directory: ${outputDir}\n`);

  // Create output directory
  const fs = require('fs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create a test prompt
  const testPrompt = {
    segmentIndex: 0,
    videoPrompt: 'Person speaking to camera with natural expressions',
    backgroundPrompt: 'Simple background',
    transitionType: 'crossfade' as const,
    duration: 7
  };

  try {
    console.log('🎬 Starting video generation...');
    console.log(`   Prompt: "${testPrompt.videoPrompt}"\n`);

    const result = await kieService.generateVideo(
      testPrompt,
      '', // seedImagePath not needed, we use PORTRAIT_URL
      outputDir
    );

    console.log('\n✅ VIDEO GENERATION SUCCESSFUL!');
    console.log(`📹 Video saved to: ${result.videoUrl}`);
    console.log(`⏱️  Duration: ${result.duration}s`);
    console.log(`🎯 Status: ${result.status}`);

  } catch (error: any) {
    console.error('\n❌ VIDEO GENERATION FAILED');
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testKieVideoGeneration();
