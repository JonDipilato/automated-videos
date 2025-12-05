"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Navigation } from "@/components/navigation";

export default function CreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    niche: "",
    topic: "",
    portrait: null as File | null,
    duration: "60",
    platforms: ["youtube", "tiktok"]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Upload portrait first if provided
      let portraitPath = null;
      if (formData.portrait) {
        const portraitFormData = new FormData();
        portraitFormData.append("file", formData.portrait);

        const portraitRes = await fetch("/api/portraits", {
          method: "POST",
          body: portraitFormData
        });
        const portraitData = await portraitRes.json();
        portraitPath = portraitData.filepath;
      }

      // Start video generation
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: formData.niche,
          topic: formData.topic,
          portraitPath,
          duration: parseInt(formData.duration),
          platforms: formData.platforms
        })
      });

      const data = await response.json();

      if (data.jobId) {
        // Redirect to generation progress page
        router.push(`/generating/${data.jobId}`);
      }
    } catch (error) {
      console.error("Failed to start generation:", error);
      alert("Failed to start video generation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation />
      <div className="max-w-2xl mx-auto p-8 pt-24">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Create Video</h1>
          <p className="text-purple-200">Fill in the details to generate your AI video</p>
        </div>

        <Card className="bg-white/10 backdrop-blur-md border-white/20 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Niche Selection */}
            <div>
              <Label className="text-white text-lg font-semibold mb-3 block">Choose Your Niche</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { value: "ai-tech", emoji: "🤖", label: "AI & Tech", gradient: "from-blue-500 to-cyan-500" },
                  { value: "business", emoji: "💼", label: "Business", gradient: "from-green-500 to-emerald-500" },
                  { value: "fitness", emoji: "💪", label: "Fitness", gradient: "from-orange-500 to-red-500" },
                  { value: "personal-dev", emoji: "🌱", label: "Personal Dev", gradient: "from-purple-500 to-pink-500" },
                  { value: "education", emoji: "📚", label: "Education", gradient: "from-yellow-500 to-orange-500" },
                  { value: "content", emoji: "🎬", label: "Content", gradient: "from-pink-500 to-rose-500" },
                  { value: "cooking", emoji: "🍳", label: "Cooking", gradient: "from-red-500 to-orange-500" },
                  { value: "real-estate", emoji: "🏡", label: "Real Estate", gradient: "from-teal-500 to-green-500" },
                  { value: "gaming", emoji: "🎮", label: "Gaming", gradient: "from-violet-500 to-purple-500" },
                  { value: "faith", emoji: "✨", label: "Faith", gradient: "from-amber-500 to-yellow-500" },
                ].map((niche) => (
                  <button
                    key={niche.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, niche: niche.value })}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                      formData.niche === niche.value
                        ? `border-white bg-gradient-to-br ${niche.gradient} shadow-lg scale-105`
                        : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"
                    }`}
                  >
                    <div className="text-3xl mb-2">{niche.emoji}</div>
                    <div className={`text-sm font-medium ${
                      formData.niche === niche.value ? "text-white" : "text-purple-200"
                    }`}>
                      {niche.label}
                    </div>
                    {formData.niche === niche.value && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic Input */}
            <div>
              <Label htmlFor="topic" className="text-white text-lg font-semibold mb-3 block">Video Topic</Label>
              <Textarea
                id="topic"
                placeholder="e.g., 5 AI Tools to Boost Productivity in 2025"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="bg-white/5 border-2 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all"
                rows={4}
                required
              />
              <p className="text-sm text-purple-300 mt-2">Be specific and engaging to get the best results</p>
            </div>

            {/* Portrait Upload */}
            <div>
              <Label htmlFor="portrait" className="text-white text-lg font-semibold mb-3 block">Portrait Image</Label>
              <div className="relative">
                <Input
                  id="portrait"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, portrait: e.target.files?.[0] || null })}
                  className="bg-white/5 border-2 border-white/20 text-white file:bg-gradient-to-r file:from-purple-600 file:to-blue-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-md file:font-semibold file:mr-4 hover:border-purple-400 transition-all"
                />
                {formData.portrait && (
                  <div className="mt-2 text-sm text-green-300 flex items-center gap-2">
                    ✓ {formData.portrait.name}
                  </div>
                )}
              </div>
              <p className="text-sm text-purple-300 mt-2">Upload your portrait for consistent character appearance</p>
            </div>

            {/* Video Duration */}
            <div>
              <Label htmlFor="duration" className="text-white text-lg font-semibold mb-3 block">
                Video Duration: <span className="text-purple-300">{formData.duration}s</span>
              </Label>
              <input
                id="duration"
                type="range"
                min="15"
                max="180"
                step="5"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-sm text-purple-300 mt-2">
                <span>15s (Quick)</span>
                <span>180s (Extended)</span>
              </div>
            </div>

            {/* Platforms */}
            <div>
              <Label className="text-white text-lg font-semibold mb-3 block">Target Platforms</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "youtube", icon: "📺", color: "red" },
                  { name: "tiktok", icon: "🎵", color: "pink" },
                  { name: "instagram", icon: "📷", color: "purple" },
                  { name: "facebook", icon: "👥", color: "blue" }
                ].map((platform) => (
                  <label
                    key={platform.name}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      formData.platforms.includes(platform.name)
                        ? "border-white bg-white/10 shadow-lg"
                        : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.platforms.includes(platform.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, platforms: [...formData.platforms, platform.name] });
                        } else {
                          setFormData({ ...formData, platforms: formData.platforms.filter(p => p !== platform.name) });
                        }
                      }}
                      className="sr-only"
                    />
                    <span className="text-2xl">{platform.icon}</span>
                    <span className="text-white font-medium capitalize">{platform.name}</span>
                    {formData.platforms.includes(platform.name) && (
                      <span className="ml-auto text-green-400">✓</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || !formData.niche || !formData.topic}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
              size="lg"
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Starting Generation...
                </span>
              ) : (
                "Generate Video →"
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
