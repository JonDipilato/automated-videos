/**
 * Test script for frame chaining workflow
 * Tests: Extract last frame → Composite portrait → Upload to GCS
 * NO KIE.AI calls - tests only local FFmpeg + GCS upload
 *
 * Usage: npx ts-node test-frame-chain.ts <video-path> <portrait-path>
 * Example: npx ts-node test-frame-chain.ts ./output/xxx/videos/segment_1.mp4 ./web/public/uploads/portrait-xxx.png
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// Import GCS service
import { GCSStorageService } from './src/services/gcs-storage.service';

async function testFrameChain() {
  const videoPath = process.argv[2];
  const portraitPath = process.argv[3];

  if (!videoPath || !portraitPath) {
    console.log('Usage: npx ts-node test-frame-chain.ts <video-path> <portrait-path>');
    console.log('');
    console.log('This tests the frame chaining workflow:');
    console.log('  1. Extract last frame from video (FFmpeg)');
    console.log('  2. Composite portrait over frame (FFmpeg)');
    console.log('  3. Upload composited frame to GCS');
    console.log('');
    console.log('Example:');
    console.log('  npx ts-node test-frame-chain.ts ./output/34457100-7430-43cb-bbd9-3c7e201cc745/videos/segment_1.mp4 ./web/public/uploads/portrait-119ac79f-d966-4339-97df-e520cca8e352.png');
    process.exit(1);
  }

  if (!fs.existsSync(videoPath)) {
    console.error(`Video not found: ${videoPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(portraitPath)) {
    console.error(`Portrait not found: ${portraitPath}`);
    process.exit(1);
  }

  const outputDir = path.dirname(videoPath);
  const tempFrame = path.join(outputDir, 'test_last_frame.jpg');
  const compositedOutput = path.join(outputDir, 'test_composited_frame.jpg');

  console.log('=== Frame Chaining Test ===\n');
  console.log(`Video: ${videoPath}`);
  console.log(`Portrait: ${portraitPath}`);
  console.log('');

  try {
    // Step 1: Get video duration
    console.log('1. Getting video duration...');
    const durationCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
    const duration = parseFloat(execSync(durationCmd, { encoding: 'utf8' }).trim());
    console.log(`   Duration: ${duration}s`);

    // Step 2: Extract frame 1s before end (avoid black frames)
    const extractTime = Math.max(0, duration - 1);
    console.log(`\n2. Extracting frame at ${extractTime.toFixed(2)}s...`);
    const extractCmd = `ffmpeg -ss ${extractTime} -i "${videoPath}" -frames:v 1 -q:v 2 "${tempFrame}" -y`;
    execSync(extractCmd, { stdio: 'pipe' });

    const frameStats = fs.statSync(tempFrame);
    console.log(`   Extracted: ${tempFrame} (${(frameStats.size / 1024).toFixed(1)}KB)`);

    // Step 3: Composite portrait on frame
    console.log('\n3. Compositing portrait on frame...');
    const compositeCmd = `ffmpeg -i "${tempFrame}" -i "${portraitPath}" ` +
      `-filter_complex "[1:v]format=rgba[portrait_rgba];` +
      `[portrait_rgba][0:v]scale2ref=-1:ih[portrait_scaled][bg];` +
      `[bg][portrait_scaled]overlay=(W-w)/2:(H-h)/2[blended];` +
      `[blended]format=rgb24[composited]" ` +
      `-map "[composited]" -frames:v 1 -qscale:v 2 "${compositedOutput}" -y`;

    execSync(compositeCmd, { stdio: 'pipe' });

    const compStats = fs.statSync(compositedOutput);
    console.log(`   Composited: ${compositedOutput} (${(compStats.size / 1024).toFixed(1)}KB)`);

    // Verify pixel format (no alpha)
    const verifyCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of default=noprint_wrappers=1:nokey=1 "${compositedOutput}"`;
    const pixFmt = execSync(verifyCmd, { encoding: 'utf8' }).trim();
    console.log(`   Pixel format: ${pixFmt}`);

    if (pixFmt.includes('a')) {
      console.log('\n   WARNING: Output has alpha channel!');
    } else {
      console.log('   No alpha channel - good!');
    }

    // Step 4: Upload to GCS
    console.log('\n4. Uploading to GCS...');
    const gcsStorage = new GCSStorageService();
    const timestamp = Date.now();
    const remoteFileName = `test_composited_${timestamp}.jpg`;

    const gcsUrl = await gcsStorage.uploadImage(compositedOutput, remoteFileName);

    console.log(`   GCS URL: ${gcsUrl}`);

    // Step 5: Verify GCS URL is accessible (use axios instead of curl for Windows compatibility)
    console.log('\n5. Verifying GCS URL accessibility...');
    try {
      const response = await axios.head(gcsUrl, { timeout: 10000 });
      console.log(`   HTTP ${response.status} - URL is accessible!`);
    } catch (verifyError: any) {
      const status = verifyError.response?.status || 'N/A';
      console.log(`   HTTP ${status} - URL might not be accessible`);
    }

    // Cleanup temp files
    console.log('\n6. Cleaning up temp files...');
    if (fs.existsSync(tempFrame)) {
      fs.unlinkSync(tempFrame);
      console.log(`   Deleted: ${tempFrame}`);
    }
    if (fs.existsSync(compositedOutput)) {
      fs.unlinkSync(compositedOutput);
      console.log(`   Deleted: ${compositedOutput}`);
    }

    console.log('\n=== TEST PASSED ===');
    console.log(`\nComposited frame uploaded to GCS:`);
    console.log(gcsUrl);
    console.log('\nThis URL can be used as seed image for next video segment.');

  } catch (error: any) {
    console.error('\n=== TEST FAILED ===');
    console.error('Error:', error.message);
    if (error.stderr) {
      console.error('FFmpeg stderr:', error.stderr.toString());
    }
    process.exit(1);
  }
}

testFrameChain().catch(console.error);
