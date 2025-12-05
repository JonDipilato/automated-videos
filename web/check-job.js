const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), '..', 'data', 'content.db');
const db = new Database(dbPath);

const jobId = '685159ef-2a07-467f-9a2e-251a2423bed4';

console.log(`\n=== Checking Job ${jobId} ===`);
const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
if (job) {
  console.log('Job found:');
  console.log(job);

  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(job.video_id);
  console.log('\nAssociated video:');
  console.log(video);
} else {
  console.log('❌ Job NOT FOUND in database!');
  console.log('\nThis explains why the page is stuck - the job doesn\'t exist.');
}

console.log('\n=== All Recent Jobs ===');
const recentJobs = db.prepare('SELECT id, video_id, status, progress, started_at FROM jobs ORDER BY started_at DESC LIMIT 5').all();
recentJobs.forEach(j => {
  console.log(`${j.id} - ${j.status} (${j.progress}%) - ${j.started_at}`);
});

db.close();
