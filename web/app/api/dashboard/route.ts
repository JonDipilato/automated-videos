import { NextResponse } from 'next/server';
import { videoQueries } from '@/lib/db';

export async function GET() {
  try {
    // Validate database queries are available
    if (!videoQueries?.getAll) {
      console.error('Database not properly initialized: videoQueries.getAll is undefined');
      return NextResponse.json({
        error: 'Database not initialized',
        stats: {
          totalVideos: 0,
          completedVideos: 0,
          generatingVideos: 0,
          failedVideos: 0,
          totalDuration: 0,
          topNiche: 'none',
        },
        recentVideos: [],
      });
    }

    // Get all videos
    const allVideos = videoQueries.getAll.all() as any[];

    // Calculate stats
    const totalVideos = allVideos.length;
    const completedVideos = allVideos.filter((v) => v.status === 'completed').length;
    const generatingVideos = allVideos.filter((v) => v.status === 'generating').length;
    const failedVideos = allVideos.filter((v) => v.status === 'failed').length;

    // Calculate total duration of completed videos
    const totalDuration = allVideos
      .filter((v) => v.status === 'completed' && v.duration)
      .reduce((sum, v) => sum + (v.duration || 0), 0);

    // Get recent videos (last 5)
    const recentVideos = allVideos
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    // Get niche distribution
    const nicheDistribution = allVideos.reduce((acc: any, video) => {
      acc[video.niche] = (acc[video.niche] || 0) + 1;
      return acc;
    }, {});

    const topNiche = Object.entries(nicheDistribution).sort(
      ([, a]: any, [, b]: any) => b - a
    )[0]?.[0] || 'none';

    return NextResponse.json({
      stats: {
        totalVideos,
        completedVideos,
        generatingVideos,
        failedVideos,
        totalDuration,
        topNiche,
      },
      recentVideos,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
