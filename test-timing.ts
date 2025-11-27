import * as dotenv from 'dotenv';
import { OpenAIService } from './src/services/openai.service';
import { ElevenLabsService } from './src/services/elevenlabs.service';
import * as path from 'path';
import * as fs from 'fs';

// Force reload environment variables
delete require.cache[require.resolve('dotenv')];
dotenv.config({ override: true });

async function testTiming() {
  console.log('🧪 Testing OpenAI → ElevenLabs Timing Accuracy\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const targetDuration = args[0] ? parseInt(args[0]) : 8;
  const topic = args[1] || 'Quick AI tip';

  console.log(`📊 Test Configuration:`);
  console.log(`   Target Duration: ${targetDuration}s`);
  console.log(`   Topic: "${topic}"`);
  console.log('');

  // Initialize services
  const openai = new OpenAIService(
    process.env.OPENAI_API_KEY || '',
    process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
  );

  const elevenlabs = new ElevenLabsService(
    process.env.ELEVENLABS_API_KEY || '',
    process.env.ELEVENLABS_VOICE_ID || '',
    {
      stability: parseFloat(process.env.ELEVENLABS_STABILITY || '0.5'),
      similarityBoost: parseFloat(process.env.ELEVENLABS_SIMILARITY_BOOST || '0.75'),
      style: parseFloat(process.env.ELEVENLABS_STYLE || '0.5'),
      useSpeakerBoost: process.env.ELEVENLABS_USE_SPEAKER_BOOST === 'true',
    }
  );

  try {
    // Step 1: Generate script
    console.log('📝 Step 1: Generating script with OpenAI...');
    const scriptGeneration = await openai.generateScript(
      topic,
      targetDuration,
      7 // segment duration
    );

    // Extract and analyze script text
    const extractText = (script: any): string => {
      if (typeof script === 'string') {
        try {
          const parsed = JSON.parse(script);
          return extractText(parsed);
        } catch {
          return script;
        }
      } else if (Array.isArray(script)) {
        return script.map((item: any) => {
          if (typeof item === 'string') return item;
          return item.text || item.content || '';
        }).join(' ');
      } else if (typeof script === 'object' && script !== null) {
        if (script.text && typeof script.text === 'object') {
          return Object.values(script.text).filter(v => typeof v === 'string').join(' ');
        }
        return Object.values(script).filter(v => typeof v === 'string').join(' ');
      }
      return String(script);
    };

    const scriptText = extractText(scriptGeneration.script);
    const words = scriptText.trim().split(/\s+/);
    const actualWordCount = words.length;

    console.log('');
    console.log('📄 Script Analysis:');
    console.log(`   Word Count: ${actualWordCount}`);
    console.log(`   Estimated Duration: ${scriptGeneration.estimatedDuration}s`);
    console.log('');
    console.log('   Script Text:');
    console.log(`   "${scriptText}"`);
    console.log('');

    // Step 2: Generate audio
    console.log('🎤 Step 2: Generating audio with ElevenLabs...');
    const testAudioPath = path.join(process.cwd(), 'output', 'test-audio.mp3');
    const audioGeneration = await elevenlabs.generateAudio(
      scriptGeneration.script,
      testAudioPath,
      7 // segment duration
    );

    console.log('');
    console.log('🎵 Audio Generation Results:');
    console.log(`   Actual Audio Duration: ${audioGeneration.duration.toFixed(2)}s`);
    console.log(`   Segments Needed: ${audioGeneration.segmentCount}`);
    console.log(`   Audio File: ${testAudioPath}`);
    console.log('');

    // Step 3: Analyze accuracy
    console.log('📊 Timing Accuracy Analysis:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const difference = Math.abs(audioGeneration.duration - targetDuration);
    const percentOff = ((difference / targetDuration) * 100).toFixed(1);
    const wordsPerMinute = (actualWordCount / (audioGeneration.duration / 60)).toFixed(0);

    console.log(`   Target Duration:     ${targetDuration}s`);
    console.log(`   Actual Duration:     ${audioGeneration.duration.toFixed(2)}s`);
    console.log(`   Difference:          ${difference.toFixed(2)}s (${percentOff}% off)`);
    console.log(`   Word Count:          ${actualWordCount} words`);
    console.log(`   Actual Speaking Rate: ${wordsPerMinute} WPM`);
    console.log('');

    if (difference <= 1) {
      console.log('✅ EXCELLENT - Within 1 second of target!');
    } else if (difference <= 2) {
      console.log('✓ GOOD - Within 2 seconds of target');
    } else if (difference <= 5) {
      console.log('⚠️  ACCEPTABLE - Within 5 seconds of target');
    } else {
      console.log('❌ NEEDS ADJUSTMENT - More than 5 seconds off target');
    }
    console.log('');

    // Recommendations
    if (difference > 1) {
      const targetWPM = (actualWordCount / (targetDuration / 60)).toFixed(0);
      const recommendedWords = Math.floor((targetDuration / 60) * parseInt(wordsPerMinute));

      console.log('💡 Recommendations:');
      console.log(`   To hit ${targetDuration}s exactly:`);
      console.log(`   - Target WPM in code should be: ${wordsPerMinute} (currently 95)`);
      console.log(`   - Or reduce word count to: ~${recommendedWords} words`);
      console.log('');
    }

    // Clean up audio file
    if (fs.existsSync(testAudioPath)) {
      fs.unlinkSync(testAudioPath);
      console.log('🧹 Cleaned up test audio file');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Usage
console.log('Usage: npm run test:timing [duration] [topic]');
console.log('Example: npm run test:timing 8 "Quick AI tip"');
console.log('');

testTiming().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
