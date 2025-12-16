/**
 * Quick local test to verify FFmpeg compositing works
 * NO API CREDITS USED - tests only the local FFmpeg compositing logic
 *
 * Usage: npx ts-node test-composite.ts <portrait-path> <video-path>
 * Example: npx ts-node test-composite.ts ./portrait.png ./output/xxx/segment_0.mp4
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function testComposite() {
  const portraitPath = process.argv[2];
  const videoPath = process.argv[3];

  if (!portraitPath || !videoPath) {
    console.log('Usage: npx ts-node test-composite.ts <portrait-path> <video-path>');
    console.log('');
    console.log('This tests FFmpeg compositing locally (FREE - no API credits)');
    console.log('');
    console.log('Example:');
    console.log('  npx ts-node test-composite.ts ./test-portrait.png ./output/xxx/segment_0.mp4');
    process.exit(1);
  }

  if (!fs.existsSync(portraitPath)) {
    console.error(`Portrait not found: ${portraitPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(videoPath)) {
    console.error(`Video not found: ${videoPath}`);
    process.exit(1);
  }

  const tempFrame = path.join(path.dirname(videoPath), 'test_frame.jpg');
  const compositedOutput = path.join(path.dirname(videoPath), 'test_composited.jpg');

  console.log('=== FFmpeg Composite Test (FREE - No API Credits) ===\n');

  // Step 1: Get video duration
  console.log('1. Getting video duration...');
  const durationCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
  const duration = parseFloat(execSync(durationCmd, { encoding: 'utf8' }).trim());
  console.log(`   Duration: ${duration}s`);

  // Step 2: Extract frame 1s before end
  const extractTime = Math.max(0, duration - 1);
  console.log(`2. Extracting frame at ${extractTime}s...`);
  const extractCmd = `ffmpeg -ss ${extractTime} -i "${videoPath}" -frames:v 1 -q:v 2 "${tempFrame}" -y`;
  execSync(extractCmd, { stdio: 'pipe' });
  console.log(`   Extracted: ${tempFrame}`);

  // Step 3: Composite with portrait
  console.log('3. Compositing portrait on frame...');
  const compositeCmd = `ffmpeg -i "${tempFrame}" -i "${portraitPath}" ` +
    `-filter_complex "[1:v]format=rgba[portrait_rgba];` +
    `[portrait_rgba][0:v]scale2ref=-1:ih[portrait_scaled][bg];` +
    `[bg][portrait_scaled]overlay=(W-w)/2:(H-h)/2[blended];` +
    `[blended]format=rgb24[composited]" ` +
    `-map "[composited]" -frames:v 1 -qscale:v 2 "${compositedOutput}" -y`;

  try {
    execSync(compositeCmd, { stdio: 'pipe' });
    console.log(`   SUCCESS! Composited frame saved to: ${compositedOutput}`);

    // Verify output
    const stats = fs.statSync(compositedOutput);
    console.log(`   File size: ${(stats.size / 1024).toFixed(1)}KB`);

    // Check pixel format
    const verifyCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of default=noprint_wrappers=1:nokey=1 "${compositedOutput}"`;
    const pixFmt = execSync(verifyCmd, { encoding: 'utf8' }).trim();
    console.log(`   Pixel format: ${pixFmt}`);

    if (pixFmt === 'yuvj420p' || pixFmt === 'yuvj444p' || !pixFmt.includes('a')) {
      console.log('\n✅ SUCCESS: Compositing works! No alpha channel = no checkerboard.');
      console.log(`\nOpen this file to verify: ${compositedOutput}`);
    } else {
      console.log('\n⚠️  WARNING: Output may have alpha channel, verify manually.');
    }

    // Cleanup temp frame
    if (fs.existsSync(tempFrame)) {
      fs.unlinkSync(tempFrame);
    }

  } catch (error: any) {
    console.error('\n❌ COMPOSITING FAILED!');
    console.error('Error:', error.message);
    console.error('\nThis is the bug we need to fix before running paid generation.');
    process.exit(1);
  }
}

testComposite().catch(console.error);
