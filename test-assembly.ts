import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Force reload environment variables
delete require.cache[require.resolve('dotenv')];
dotenv.config({ override: true });

async function testAssembly() {
  const args = process.argv.slice(2);
  const jobId = args[0];

  if (!jobId) {
    console.log('🧪 Test Video Assembly from Existing Assets\n');
    console.log('Usage: npm run test:assembly <job-id>');
    console.log('\nExample: npm run test:assembly ea6551bb-c8c2-4e87-b808-09bf08c4b194\n');
    console.log('Available jobs with videos:');

    // Find folders with video files
    const outputDir = path.join(process.cwd(), 'output');
    if (fs.existsSync(outputDir)) {
      const dirs = fs.readdirSync(outputDir);
      for (const dir of dirs) {
        const videosPath = path.join(outputDir, dir, 'videos');
        if (fs.existsSync(videosPath)) {
          const files = fs.readdirSync(videosPath).filter(f => f.endsWith('.mp4'));
          if (files.length > 0) {
            console.log(`  ${dir} (${files.length} videos)`);
          }
        }
      }
    }
    console.log('');
    process.exit(0);
  }

  console.log('🧪 Testing Video Assembly\n');
  console.log(`📁 Job ID: ${jobId}\n`);

  const jobDir = path.join(process.cwd(), 'output', jobId);

  // Verify folder exists
  if (!fs.existsSync(jobDir)) {
    console.error(`❌ Job folder not found: ${jobDir}`);
    process.exit(1);
  }

  // Check assets
  const audioPath = path.join(jobDir, 'audio', 'narration.mp3');
  const videosDir = path.join(jobDir, 'videos');
  const finalDir = path.join(jobDir, 'final');

  console.log('📊 Checking assets:');

  if (!fs.existsSync(audioPath)) {
    console.error('  ❌ Audio file missing');
    process.exit(1);
  }
  console.log(`  ✅ Audio: ${path.basename(audioPath)}`);

  if (!fs.existsSync(videosDir)) {
    console.error('  ❌ Videos directory missing');
    process.exit(1);
  }

  const videoFiles = fs.readdirSync(videosDir)
    .filter(f => f.endsWith('.mp4') && f.startsWith('segment_'))
    .sort();

  if (videoFiles.length === 0) {
    console.error('  ❌ No video segments found');
    process.exit(1);
  }

  console.log(`  ✅ Video segments: ${videoFiles.length} files`);
  videoFiles.forEach(f => console.log(`     - ${f}`));
  console.log('');

  // Create final directory if it doesn't exist
  if (!fs.existsSync(finalDir)) {
    fs.mkdirSync(finalDir, { recursive: true });
  }

  try {
    console.log('🎬 Step 1: Creating concat list...');
    const concatList = path.join(finalDir, 'concat_list.txt');
    const concatContent = videoFiles.map(f =>
      `file '${path.join(videosDir, f).replace(/\\/g, '/')}'`
    ).join('\n');
    fs.writeFileSync(concatList, concatContent);
    console.log(`  ✅ Created: ${concatList}`);
    console.log('');

    console.log('🎬 Step 2: Concatenating video segments...');
    const tempVideo = path.join(finalDir, 'temp_concatenated.mp4');
    const concatCommand = `ffmpeg -f concat -safe 0 -i "${concatList}" -c copy "${tempVideo}" -y`;
    execSync(concatCommand, { stdio: 'pipe' });
    console.log(`  ✅ Created: ${tempVideo}`);
    console.log('');

    console.log('🎤 Step 3: Adding audio narration...');
    const finalVideo = path.join(finalDir, 'final_video.mp4');
    const audioCommand = `ffmpeg -i "${tempVideo}" -i "${audioPath}" -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 -shortest "${finalVideo}" -y`;
    execSync(audioCommand, { stdio: 'pipe' });
    console.log(`  ✅ Created: ${finalVideo}`);
    console.log('');

    // Check final video
    if (fs.existsSync(finalVideo)) {
      const stats = fs.statSync(finalVideo);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  ✅ SUCCESS! Final video assembled!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log(`📁 Location: ${finalVideo}`);
      console.log(`📊 Size: ${sizeMB} MB`);
      console.log(`🎬 Segments: ${videoFiles.length}`);
      console.log('');
      console.log('🎉 You can now review the video!');
      console.log('');

      // Clean up temp file
      if (fs.existsSync(tempVideo)) {
        fs.unlinkSync(tempVideo);
        console.log('🧹 Cleaned up temporary files');
        console.log('');
      }
    } else {
      console.error('❌ Final video was not created');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Assembly failed:', error);
    process.exit(1);
  }
}

testAssembly().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
