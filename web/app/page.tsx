"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Navigation } from "@/components/navigation";

interface DashboardData {
  stats: {
    totalVideos: number;
    completedVideos: number;
    generatingVideos: number;
    failedVideos: number;
    totalDuration: number;
    topNiche: string;
  };
  recentVideos: any[];
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await fetch('/api/dashboard');
      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getNicheLabel = (niche: string) => {
    const labels: any = {
      "ai-tech": "AI & Tech",
      "business": "Business",
      "fitness": "Fitness",
      "personal-dev": "Personal Dev",
      "education": "Education",
      "content": "Content",
      "cooking": "Cooking",
      "real-estate": "Real Estate",
      "gaming": "Gaming",
      "faith": "Faith"
    };
    return labels[niche] || niche;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation />
      <main className="max-w-7xl mx-auto p-8 pt-24">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            AI Video Studio
          </h1>
          <p className="text-xl text-purple-200 mb-6">
            Create spectacular videos in minutes with AI
          </p>
          <Link href="/create">
            <Button
              size="lg"
              className="text-lg px-8 py-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              Create New Video →
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="text-center text-white">Loading dashboard...</div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-md border-purple-400/30 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-4xl font-bold text-white mb-1">
                      {data?.stats?.totalVideos ?? 0}
                    </div>
                    <div className="text-purple-200">Total Videos</div>
                  </div>
                  <div className="text-5xl">🎬</div>
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 backdrop-blur-md border-green-400/30 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-4xl font-bold text-white mb-1">
                      {data?.stats?.completedVideos ?? 0}
                    </div>
                    <div className="text-green-200">Completed</div>
                  </div>
                  <div className="text-5xl">✅</div>
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-500/20 to-orange-600/20 backdrop-blur-md border-yellow-400/30 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-4xl font-bold text-white mb-1">
                      {data?.stats?.generatingVideos ?? 0}
                    </div>
                    <div className="text-yellow-200">Generating</div>
                  </div>
                  <div className="text-5xl">⏳</div>
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 backdrop-blur-md border-blue-400/30 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-4xl font-bold text-white mb-1">
                      {formatDuration(data?.stats?.totalDuration ?? 0)}
                    </div>
                    <div className="text-blue-200">Total Duration</div>
                  </div>
                  <div className="text-5xl">⏱️</div>
                </div>
              </Card>
            </div>

            {/* Recent Videos */}
            {data?.recentVideos && data.recentVideos.length > 0 && (
              <Card className="bg-white/10 backdrop-blur-md border-white/20 p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-white">Recent Videos</h2>
                  <Link href="/library">
                    <Button variant="ghost" className="text-purple-300 hover:text-white">
                      View All →
                    </Button>
                  </Link>
                </div>
                <div className="space-y-3">
                  {data.recentVideos.map((video) => (
                    <div
                      key={video.id}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="text-white font-medium mb-1">{video.topic}</div>
                        <div className="text-sm text-purple-200">
                          {getNicheLabel(video.niche)} • {new Date(video.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm px-3 py-1 rounded-full ${
                          video.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                          video.status === 'generating' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {video.status}
                        </span>
                        {video.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/20 text-white hover:bg-white/10"
                            onClick={() => window.open(`/api/videos/${video.id}`, '_blank')}
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-white/5 backdrop-blur-sm border-white/10 p-6">
                <div className="text-3xl mb-3">🎬</div>
                <h3 className="text-lg font-semibold text-white mb-2">10 Niches</h3>
                <p className="text-sm text-purple-200">Pre-optimized content categories</p>
              </Card>
              <Card className="bg-white/5 backdrop-blur-sm border-white/10 p-6">
                <div className="text-3xl mb-3">🤖</div>
                <h3 className="text-lg font-semibold text-white mb-2">AI-Powered</h3>
                <p className="text-sm text-purple-200">Automatic script and video generation</p>
              </Card>
              <Card className="bg-white/5 backdrop-blur-sm border-white/10 p-6">
                <div className="text-3xl mb-3">📱</div>
                <h3 className="text-lg font-semibold text-white mb-2">Multi-Platform</h3>
                <p className="text-sm text-purple-200">YouTube, TikTok, Instagram ready</p>
              </Card>
              <Card className="bg-white/5 backdrop-blur-sm border-white/10 p-6">
                <div className="text-3xl mb-3">⚡</div>
                <h3 className="text-lg font-semibold text-white mb-2">Fast</h3>
                <p className="text-sm text-purple-200">Professional videos in minutes</p>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
