import { NextResponse } from 'next/server';
import { videoQueries } from '@/lib/db';

export async function GET() {
  try {
    // Validate database queries are available
    if (!videoQueries?.list) {
      console.error('Database not properly initialized: videoQueries.list is undefined');
      return NextResponse.json({ videos: [] });
    }

    const videos = videoQueries.list.all(100, 0); // Get last 100 videos
    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Videos API error:', error);
    return NextResponse.json({ error: 'Failed to get videos' }, { status: 500 });
  }
}
