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
      "faith": "Faith",
      "epic-battles": "Epic Battles",
      "custom": "Custom"
    };
    return labels[niche] || niche;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <Navigation />
      <main className="max-w-7xl mx-auto p-8 pt-24 relative z-10">
        {/* Hero Section */}
        <div className="mb-16 text-center animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-400/30 rounded-full mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-purple-200 font-medium">Powered by Grok, OpenAI & ElevenLabs</span>
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-6">
            <span className="bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
              AI Video Studio
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-purple-200/80 mb-8 max-w-2xl mx-auto">
            Create spectacular videos in minutes with AI-powered automation
          </p>
          <Link href="/create">
            <Button
              size="lg"
              className="text-lg px-10 py-7 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 hover:scale-105"
            >
              <span className="mr-2">✨</span>
              Create New Video
              <span className="ml-2">→</span>
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-white text-lg font-medium">Loading dashboard...</div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <Card className="group bg-gradient-to-br from-purple-500/10 to-purple-600/10 backdrop-blur-xl border-purple-400/20 p-6 hover:border-purple-400/40 hover:from-purple-500/20 hover:to-purple-600/20 transition-all duration-300 card-glow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-5xl font-bold text-white mb-2 group-hover:scale-105 transition-transform">
                      {data?.stats?.totalVideos ?? 0}
                    </div>
                    <div className="text-purple-200 font-medium">Total Videos</div>
                  </div>
                  <div className="text-5xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">🎬</div>
                </div>
              </Card>

              <Card className="group bg-gradient-to-br from-green-500/10 to-emerald-600/10 backdrop-blur-xl border-green-400/20 p-6 hover:border-green-400/40 hover:from-green-500/20 hover:to-emerald-600/20 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-5xl font-bold text-white mb-2 group-hover:scale-105 transition-transform">
                      {data?.stats?.completedVideos ?? 0}
                    </div>
                    <div className="text-green-200 font-medium">Completed</div>
                  </div>
                  <div className="text-5xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">✅</div>
                </div>
              </Card>

              <Card className="group bg-gradient-to-br from-yellow-500/10 to-orange-600/10 backdrop-blur-xl border-yellow-400/20 p-6 hover:border-yellow-400/40 hover:from-yellow-500/20 hover:to-orange-600/20 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-5xl font-bold text-white mb-2 group-hover:scale-105 transition-transform">
                      {data?.stats?.generatingVideos ?? 0}
                    </div>
                    <div className="text-yellow-200 font-medium">Generating</div>
                  </div>
                  <div className="text-5xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all generating-pulse">⏳</div>
                </div>
              </Card>

              <Card className="group bg-gradient-to-br from-blue-500/10 to-cyan-600/10 backdrop-blur-xl border-blue-400/20 p-6 hover:border-blue-400/40 hover:from-blue-500/20 hover:to-cyan-600/20 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-5xl font-bold text-white mb-2 group-hover:scale-105 transition-transform">
                      {formatDuration(data?.stats?.totalDuration ?? 0)}
                    </div>
                    <div className="text-blue-200 font-medium">Total Duration</div>
                  </div>
                  <div className="text-5xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">⏱️</div>
                </div>
              </Card>
            </div>

            {/* Recent Videos */}
            {data?.recentVideos && data.recentVideos.length > 0 && (
              <Card className="bg-white/5 backdrop-blur-xl border-white/10 p-8 mb-10 glass">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <span className="text-3xl">📹</span>
                    Recent Videos
                  </h2>
                  <Link href="/library">
                    <Button variant="ghost" className="text-purple-300 hover:text-white hover:bg-white/10 font-semibold">
                      View All →
                    </Button>
                  </Link>
                </div>
                <div className="space-y-4">
                  {data.recentVideos.map((video, index) => (
                    <div
                      key={video.id}
                      className="flex items-center justify-between p-5 bg-white/5 rounded-xl hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all duration-300 animate-fade-in-up"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex-1">
                        <div className="text-white font-semibold mb-2 text-lg">{video.topic}</div>
                        <div className="text-sm text-purple-200/70 flex items-center gap-2">
                          <span className="bg-purple-500/20 px-2 py-0.5 rounded-md">{getNicheLabel(video.niche)}</span>
                          <span>•</span>
                          <span>{new Date(video.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-sm font-semibold px-4 py-1.5 rounded-full border ${
                          video.status === 'completed' ? 'bg-green-500/10 text-green-300 border-green-400/30' :
                          video.status === 'generating' ? 'bg-yellow-500/10 text-yellow-300 border-yellow-400/30' :
                          'bg-red-500/10 text-red-300 border-red-400/30'
                        }`}>
                          {video.status === 'completed' ? '✓ ' : video.status === 'generating' ? '◉ ' : '✗ '}
                          {video.status}
                        </span>
                        {video.status === 'completed' && (
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-md"
                            onClick={() => window.open(`/api/videos/${video.id}`, '_blank')}
                          >
                            ▶ Play
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: "🎬", title: "12 Niches", desc: "Pre-optimized content categories", gradient: "from-purple-500/10 to-pink-500/10" },
                { icon: "🤖", title: "AI-Powered", desc: "Automatic script & video generation", gradient: "from-blue-500/10 to-cyan-500/10" },
                { icon: "📱", title: "Multi-Platform", desc: "YouTube, TikTok, Instagram ready", gradient: "from-green-500/10 to-emerald-500/10" },
                { icon: "⚡", title: "Lightning Fast", desc: "Professional videos in minutes", gradient: "from-yellow-500/10 to-orange-500/10" },
              ].map((feature, index) => (
                <Card
                  key={feature.title}
                  className={`group bg-gradient-to-br ${feature.gradient} backdrop-blur-xl border-white/10 p-6 hover:border-white/30 hover:scale-105 transition-all duration-300`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-purple-200/80">{feature.desc}</p>
                </Card>
              ))}
            </div>

            {/* Bottom CTA */}
            <div className="mt-16 text-center">
              <div className="inline-block p-px bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 rounded-2xl">
                <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl px-12 py-8">
                  <h3 className="text-2xl font-bold text-white mb-3">Ready to create amazing videos?</h3>
                  <p className="text-purple-200/80 mb-6">Start generating professional AI videos today</p>
                  <Link href="/create">
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/25"
                    >
                      Get Started Free →
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
