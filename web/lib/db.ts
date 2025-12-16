import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Connect to existing database
const dbPath = path.join(process.cwd(), '../data/content.db');
console.log('📁 Database path:', dbPath);

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  console.log('📁 Creating data directory:', dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize tables FIRST before creating prepared statements
function initializeDatabase() {
  // Videos generated through web UI
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      job_id TEXT UNIQUE,
      status TEXT DEFAULT 'pending',

      niche TEXT,
      topic TEXT,
      script TEXT,

      portrait_path TEXT,
      video_path TEXT,
      thumbnail_path TEXT,

      duration REAL,
      segment_count INTEGER,

      platforms TEXT,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Pre-configured and custom niches
  db.exec(`
    CREATE TABLE IF NOT EXISTS niches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_preconfigured INTEGER DEFAULT 0,

      default_duration INTEGER DEFAULT 60,
      tone TEXT DEFAULT 'professional',
      platforms TEXT DEFAULT '["youtube","tiktok"]',
      example_topics TEXT,
      icon TEXT,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // User portrait uploads
  db.exec(`
    CREATE TABLE IF NOT EXISTS portraits (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      thumbnail_path TEXT,
      is_default INTEGER DEFAULT 0,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Generation jobs (for progress tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      video_id TEXT,
      status TEXT DEFAULT 'pending',
      current_step TEXT,
      progress INTEGER DEFAULT 0,
      error TEXT,

      started_at DATETIME,
      completed_at DATETIME,

      FOREIGN KEY (video_id) REFERENCES videos(id)
    );
  `);

  // Insert 10 pre-configured niches
  const insertNiche = db.prepare(`
    INSERT OR IGNORE INTO niches (id, name, description, is_preconfigured, default_duration, tone, platforms, example_topics, icon)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const niches = [
    ['ai-tech', 'AI & Technology', 'AI tools, tech tutorials, software reviews', 1, 60, 'professional', '["youtube","linkedin"]', '["5 AI Tools to Boost Productivity","ChatGPT vs Claude"]', '🤖'],
    ['business', 'Business & Finance', 'Business tips, financial advice, entrepreneurship', 1, 90, 'authoritative', '["linkedin","youtube"]', '["3 Strategies to Scale Your Business","$0 to $100K MRR"]', '💼'],
    ['fitness', 'Health & Fitness', 'Workout tips, nutrition, wellness', 1, 45, 'motivational', '["tiktok","instagram"]', '["5-Minute Morning Routine","Meal Prep Hack"]', '💪'],
    ['personal-dev', 'Personal Development', 'Self-improvement, productivity, mindset', 1, 75, 'inspirational', '["youtube","instagram"]', '["Build Discipline When Motivation Fades"]', '🌱'],
    ['education', 'Education & Learning', 'Study tips, learning methods, skill development', 1, 90, 'educational', '["youtube","tiktok"]', '["Learn Anything 10x Faster","Study Techniques"]', '📚'],
    ['content', 'Content Creation', 'Creator tips, social media growth, monetization', 1, 60, 'practical', '["youtube","tiktok"]', '["1M Views in 30 Days","TikTok Algorithm Secrets"]', '🎬'],
    ['cooking', 'Cooking & Food', 'Recipes, cooking tips, food reviews', 1, 30, 'friendly', '["tiktok","instagram"]', '["30-Second Breakfast Hack","Restaurant-Quality Pasta"]', '🍳'],
    ['real-estate', 'Real Estate', 'Property investing, market analysis, home buying', 1, 90, 'professional', '["youtube","linkedin"]', '["Buy Your First Investment Property"]', '🏡'],
    ['gaming', 'Gaming & Entertainment', 'Gaming tips, reviews, entertainment news', 1, 45, 'exciting', '["youtube","tiktok"]', '["5 Tips to Rank Up Fast","Why This Game Is Breaking Records"]', '🎮'],
    ['faith', 'Spirituality & Faith', 'Biblical wisdom, spiritual growth, faith-based', 1, 90, 'inspirational', '["youtube","facebook"]', '["What the Bible Says About Fear","3 Prayers That Changed My Life"]', '✨'],
    ['epic-battles', 'Epic Battles', 'High-energy action sequences with glowing effects, intense combat, explosive energy attacks', 1, 60, 'intense', '["youtube","tiktok","instagram"]', '["Ultimate Power Showdown","Energy Blast Clash","Speed vs Strength Battle"]', '⚡'],
    ['custom', 'Custom Niche', 'Create your own unique content - AI will optimize everything for you', 1, 60, 'adaptive', '["youtube","tiktok","instagram","linkedin"]', '["My Unique Topic","Whatever You Imagine"]', '✨']
  ];

  for (const niche of niches) {
    insertNiche.run(...niche);
  }

  console.log('✅ Database initialized successfully');
}

// Initialize database immediately
try {
  initializeDatabase();
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  throw error;
}

// Helper functions (created AFTER tables exist)
export const videoQueries = {
  create: db.prepare(`
    INSERT INTO videos (id, job_id, niche, topic, portrait_path, platforms, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),

  getById: db.prepare(`SELECT * FROM videos WHERE id = ?`),

  getByJobId: db.prepare(`SELECT * FROM videos WHERE job_id = ?`),

  getAll: db.prepare(`
    SELECT * FROM videos
    ORDER BY created_at DESC
  `),

  list: db.prepare(`
    SELECT * FROM videos
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `),

  updateStatus: db.prepare(`
    UPDATE videos
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),

  updateVideoPath: db.prepare(`
    UPDATE videos
    SET video_path = ?, duration = ?, segment_count = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
};

console.log('✅ Database queries initialized successfully');

export const nicheQueries = {
  getAll: db.prepare(`SELECT * FROM niches ORDER BY is_preconfigured DESC, name ASC`),

  getById: db.prepare(`SELECT * FROM niches WHERE id = ?`),

  create: db.prepare(`
    INSERT INTO niches (id, name, description, is_preconfigured, default_duration, tone, platforms, example_topics, icon)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)
  `)
};

export const jobQueries = {
  create: db.prepare(`
    INSERT INTO jobs (id, video_id, status, started_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `),

  getById: db.prepare(`SELECT * FROM jobs WHERE id = ?`),

  updateProgress: db.prepare(`
    UPDATE jobs
    SET status = ?, current_step = ?, progress = ?
    WHERE id = ?
  `),

  complete: db.prepare(`
    UPDATE jobs
    SET status = 'completed', progress = 100, completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),

  fail: db.prepare(`
    UPDATE jobs
    SET status = 'failed', error = ?, completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
};

export const portraitQueries = {
  create: db.prepare(`
    INSERT INTO portraits (id, filename, filepath, thumbnail_path, is_default)
    VALUES (?, ?, ?, ?, ?)
  `),

  getAll: db.prepare(`SELECT * FROM portraits ORDER BY created_at DESC`),

  getDefault: db.prepare(`SELECT * FROM portraits WHERE is_default = 1 LIMIT 1`)
};
