const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), '..', 'data', 'content.db');
const db = new Database(dbPath);

// Get all videos
const allVideos = db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();

console.log('\n=== All Videos in Database ===');
allVideos.forEach((video, idx) => {
  console.log(`\n${idx + 1}. Video ID: ${video.id}`);
  console.log(`   Job ID: ${video.job_id}`);
  console.log(`   Topic: ${video.topic}`);
  console.log(`   Status: ${video.status}`);
  console.log(`   Video Path: ${video.video_path}`);
  console.log(`   Created: ${video.created_at}`);

  // Check if video file exists
  if (video.video_path) {
    const fullPath = path.join(process.cwd(), '..', video.video_path);
    const exists = fs.existsSync(fullPath);
    console.log(`   File Exists: ${exists ? '✅ YES' : '❌ NO'}`);
  }
});

// Check for recent output folders
console.log('\n\n=== Recent Output Folders (Not in DB?) ===');
const outputDir = path.join(process.cwd(), '..', 'output');
const folders = fs.readdirSync(outputDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory() && dirent.name.match(/^[0-9a-f-]{36}$/))
  .map(dirent => {
    const folderPath = path.join(outputDir, dirent.name);
    const stats = fs.statSync(folderPath);
    return { name: dirent.name, mtime: stats.mtime };
  })
  .sort((a, b) => b.mtime - a.mtime)
  .slice(0, 10);

folders.forEach((folder, idx) => {
  const inDb = allVideos.some(v => v.video_path && v.video_path.includes(folder.name));
  console.log(`${idx + 1}. ${folder.name}`);
  console.log(`   Modified: ${folder.mtime.toLocaleString()}`);
  console.log(`   In Database: ${inDb ? '✅ YES' : '❌ NO'}`);

  // Check if it has a final video
  const finalPath = path.join(outputDir, folder.name, 'final', 'final_video_with_captions.mp4');
  if (fs.existsSync(finalPath)) {
    const stats = fs.statSync(finalPath);
    console.log(`   Has Final Video: ✅ YES (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${stats.mtime.toLocaleString()})`);
  } else {
    console.log(`   Has Final Video: ❌ NO`);
  }
});

db.close();
