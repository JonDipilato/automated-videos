"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/navigation";

interface Video {
  id: string;
  job_id: string;
  topic: string;
  niche: string;
  video_path?: string;
  duration?: number;
  status: string;
  created_at: string;
}

export default function LibraryPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/videos');
      const data = await response.json();
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'generating':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-purple-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'generating':
        return '⏳';
      case 'failed':
        return '❌';
      default:
        return '📝';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation />
      <div className="max-w-6xl mx-auto p-8 pt-24">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Video Library</h1>
            <p className="text-purple-200">View and manage your generated videos</p>
          </div>
          <Link href="/create">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              + Create New Video
            </Button>
          </Link>
        </div>

        {loading ? (
          <Card className="bg-white/10 backdrop-blur-md border-white/20 p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-white text-lg">Loading your videos...</p>
            </div>
          </Card>
        ) : videos.length === 0 ? (
          <Card className="bg-white/10 backdrop-blur-md border-white/20 p-12 text-center">
            <div className="text-6xl mb-4">🎬</div>
            <p className="text-white text-xl mb-2 font-semibold">No videos yet</p>
            <p className="text-purple-200 mb-6">Start creating amazing AI-powered videos</p>
            <Link href="/create">
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg px-8 py-6">
                Create Your First Video →
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video, index) => (
              <Card
                key={video.id}
                className="group bg-white/10 backdrop-blur-md border-white/20 p-6 hover:bg-white/15 hover:border-white/30 hover:scale-[1.02] transition-all duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-3xl group-hover:scale-110 transition-transform duration-300">
                    {getStatusIcon(video.status)}
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                    video.status === 'completed' ? 'bg-green-500/20 text-green-300 border border-green-400/30' :
                    video.status === 'generating' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/30' :
                    video.status === 'failed' ? 'bg-red-500/20 text-red-300 border border-red-400/30' :
                    'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                  }`}>
                    {video.status.toUpperCase()}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-3 line-clamp-2 min-h-[3.5rem] group-hover:text-purple-200 transition-colors">
                  {video.topic}
                </h3>

                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex items-center gap-2 text-purple-200">
                    <span className="text-lg">📁</span>
                    <span className="font-medium">{video.niche}</span>
                  </div>
                  {video.duration && (
                    <div className="flex items-center gap-2 text-purple-200">
                      <span className="text-lg">⏱️</span>
                      <span>{video.duration}s</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-purple-200">
                    <span className="text-lg">📅</span>
                    <span>{new Date(video.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {video.status === 'generating' && (
                    <Link href={`/generating/${video.job_id}`} className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-yellow-400/30 bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/20 hover:border-yellow-400/50 font-semibold"
                      >
                        View Progress →
                      </Button>
                    </Link>
                  )}
                  {video.status === 'completed' && video.video_path && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-green-400/30 bg-green-500/10 text-green-200 hover:bg-green-500/20 hover:border-green-400/50 font-semibold"
                      onClick={() => window.open(`/api/videos/${video.id}`, '_blank')}
                    >
                      ▶ View Video
                    </Button>
                  )}
                  {video.status === 'failed' && (
                    <Link href="/create" className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:border-red-400/50 font-semibold"
                      >
                        🔄 Try Again
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
