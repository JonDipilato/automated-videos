import { NextRequest, NextResponse } from 'next/server';
import { jobQueries, videoQueries } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Validate database queries are available
    if (!jobQueries?.getById || !videoQueries?.getById) {
      console.error('Database not properly initialized');
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Get job status
    const job = jobQueries.getById.get(jobId) as any;

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get associated video
    const video = videoQueries.getById.get(job.video_id) as any;

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        currentStep: job.current_step,
        progress: job.progress,
        error: job.error,
        startedAt: job.started_at,
        completedAt: job.completed_at
      },
      video: video ? {
        id: video.id,
        topic: video.topic,
        videoPath: video.video_path,
        duration: video.duration,
        status: video.status
      } : null
    });
  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
