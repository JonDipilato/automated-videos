const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), '..', 'data', 'content.db');
console.log('Database path:', dbPath);

const db = new Database(dbPath);

// Check the specific job
const jobId = 'cd8363a0-5f12-4fde-a575-3d6f0fdbcbba';

console.log('\n=== Checking Job ===');
const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
console.log(job);

console.log('\n=== Checking Video by Job ID ===');
const videoByJob = db.prepare('SELECT * FROM videos WHERE job_id = ?').get(jobId);
console.log(videoByJob);

console.log('\n=== All Recent Videos ===');
const allVideos = db.prepare('SELECT id, job_id, topic, status, video_path, created_at FROM videos ORDER BY created_at DESC LIMIT 5').all();
console.log(allVideos);

console.log('\n=== All Jobs ===');
const allJobs = db.prepare('SELECT id, video_id, status, progress, started_at FROM jobs ORDER BY started_at DESC LIMIT 5').all();
console.log(allJobs);

db.close();
