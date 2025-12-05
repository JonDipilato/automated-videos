import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { videoQueries } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    // Validate database queries are available
    if (!videoQueries?.getById) {
      console.error('Database not properly initialized');
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Get video from database
    const video = videoQueries.getById.get(videoId) as any;

    if (!video || !video.video_path) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check if video_path is a public URL (for multi-tenant SaaS)
    if (video.video_path.startsWith('http://') || video.video_path.startsWith('https://')) {
      // Redirect to the public URL (GCS, S3, etc.)
      return NextResponse.redirect(video.video_path, 302);
    }

    // Otherwise, serve from local filesystem (for local development)
    const videoPath = path.join(process.cwd(), '..', video.video_path);
    const videoBuffer = await readFile(videoPath);

    // Return video with proper headers
    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoBuffer.length.toString(),
        'Content-Disposition': `inline; filename="${path.basename(video.video_path)}"`,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Video serve error:', error);
    return NextResponse.json({ error: 'Failed to load video' }, { status: 500 });
  }
}
