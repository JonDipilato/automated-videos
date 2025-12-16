"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Navigation } from "@/components/navigation";

// Scene type for custom script mode
interface CustomScene {
  id: string;
  timestamp: string;
  title: string;
  visual: string;
  voiceover: string;
}

// Background mood options for lip-sync mode
const BACKGROUND_MOODS = [
  { value: "dramatic", label: "Dramatic", icon: "🎬", description: "God rays, shadows, epic scale" },
  { value: "futuristic", label: "Futuristic", icon: "🚀", description: "Holograms, neon, cyberpunk" },
  { value: "nature", label: "Nature", icon: "🌿", description: "Golden hour, mist, landscapes" },
  { value: "urban", label: "Urban", icon: "🌃", description: "Rain-slicked streets, neon lights" },
  { value: "corporate", label: "Corporate", icon: "💼", description: "Sleek glass, professional" },
  { value: "custom", label: "Custom", icon: "🎨", description: "Use your descriptions as-is" },
] as const;

type BackgroundMood = typeof BACKGROUND_MOODS[number]["value"];
type GenerationMode = "grok-lipsync" | "elevenlabs-tts";

// Popular ElevenLabs voices with their IDs
const VOICE_OPTIONS = [
  { id: "default", name: "Default (From Settings)", description: "Uses your configured voice", icon: "⚙️", gender: "any" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Young American female, warm & conversational", icon: "👩", gender: "female" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Young American female, soft & engaging", icon: "👩‍🦰", gender: "female" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "Young American female, strong & confident", icon: "💃", gender: "female" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "Young American female, emotional & expressive", icon: "🌸", gender: "female" },
  { id: "jsCqWAovK2LkecY7zXl4", name: "Freya", description: "Young female, modern & trendy", icon: "✨", gender: "female" },
  { id: "oWAxZDx7w5VEj9dCyTzz", name: "Grace", description: "Young American female, southern accent", icon: "🌺", gender: "female" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Young American male, deep & narrative", icon: "👨", gender: "male" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", description: "American male, crisp & authoritative", icon: "🎙️", gender: "male" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Young American male, well-rounded & calm", icon: "🧔", gender: "male" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", description: "Young American male, raspy & dynamic", icon: "🎤", gender: "male" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "Young American male, deep & engaging", icon: "📢", gender: "male" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "British male, deep & authoritative", icon: "🎩", gender: "male" },
];

// Default empty scene template
const createEmptyScene = (): CustomScene => ({
  id: Math.random().toString(36).substr(2, 9),
  timestamp: "0:00–0:10",
  title: "",
  visual: "",
  voiceover: ""
});

export default function CreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"ai" | "custom" | "lipsync">("ai");
  const [voiceFilter, setVoiceFilter] = useState<"all" | "female" | "male">("all");
  const [formData, setFormData] = useState({
    niche: "",
    topic: "",
    portrait: null as File | null,
    duration: "60",
    platforms: ["youtube", "tiktok"],
    voiceId: "default"
  });

  // Grok Lip Sync automatic tab state
  const [lipSyncFormData, setLipSyncFormData] = useState({
    niche: "",
    topic: "",
    portrait: null as File | null,
    duration: "45",
    platforms: ["youtube", "tiktok"],
    backgroundMood: "dramatic" as BackgroundMood,
  });

  // Custom script state
  const [customScriptData, setCustomScriptData] = useState({
    title: "",
    portrait: null as File | null,
    platforms: ["youtube", "tiktok"],
    voiceId: "default",
    scenes: [createEmptyScene()] as CustomScene[],
    // Lip sync options
    generationMode: "grok-lipsync" as GenerationMode,
    backgroundMood: "dramatic" as BackgroundMood,
    replaceVoice: false,  // Option to replace Grok voice with ElevenLabs
  });

  const addScene = () => {
    setCustomScriptData({
      ...customScriptData,
      scenes: [...customScriptData.scenes, createEmptyScene()]
    });
  };

  const removeScene = (id: string) => {
    if (customScriptData.scenes.length > 1) {
      setCustomScriptData({
        ...customScriptData,
        scenes: customScriptData.scenes.filter(s => s.id !== id)
      });
    }
  };

  const updateScene = (id: string, field: keyof CustomScene, value: string) => {
    setCustomScriptData({
      ...customScriptData,
      scenes: customScriptData.scenes.map(s =>
        s.id === id ? { ...s, [field]: value } : s
      )
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activeTab === "ai") {
        // AI-generated mode
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
            platforms: formData.platforms,
            voiceId: formData.voiceId === "default" ? null : formData.voiceId
          })
        });

        const data = await response.json();

        if (data.jobId) {
          router.push(`/generating/${data.jobId}`);
        }
      } else if (activeTab === "custom") {
        // Custom script mode
        let portraitPath = null;
        if (customScriptData.portrait) {
          const portraitFormData = new FormData();
          portraitFormData.append("file", customScriptData.portrait);

          const portraitRes = await fetch("/api/portraits", {
            method: "POST",
            body: portraitFormData
          });
          const portraitData = await portraitRes.json();
          portraitPath = portraitData.filepath;
        }

        // Route to correct API based on generation mode
        if (customScriptData.generationMode === "grok-lipsync") {
          // Grok Lip Sync mode - native voice + lip sync
          const response = await fetch("/api/generate-lipsync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: customScriptData.title,
              portraitPath,
              platforms: customScriptData.platforms,
              backgroundMood: customScriptData.backgroundMood,
              replaceVoice: customScriptData.replaceVoice,
              voiceId: customScriptData.replaceVoice && customScriptData.voiceId !== "default"
                ? customScriptData.voiceId
                : null,
              // Convert scenes to lip-sync format (voiceover -> dialogue)
              scenes: customScriptData.scenes.map(s => ({
                id: s.id,
                dialogue: s.voiceover,  // voiceover becomes dialogue for lip-sync
                visual: s.visual,
                title: s.title,
                timestamp: s.timestamp
              }))
            })
          });

          const data = await response.json();

          if (data.jobId) {
            router.push(`/generating/${data.jobId}`);
          } else if (data.error) {
            alert(data.error);
          }
        } else {
          // ElevenLabs TTS mode - existing custom script workflow
          const response = await fetch("/api/generate-custom", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: customScriptData.title,
              portraitPath,
              platforms: customScriptData.platforms,
              voiceId: customScriptData.voiceId === "default" ? null : customScriptData.voiceId,
              scenes: customScriptData.scenes
            })
          });

          const data = await response.json();

          if (data.jobId) {
            router.push(`/generating/${data.jobId}`);
          } else if (data.error) {
            alert(data.error);
          }
        }
      } else if (activeTab === "lipsync") {
        // Automatic Grok Lip Sync mode - generate script + video with native lip sync
        let portraitPath = null;
        if (lipSyncFormData.portrait) {
          const portraitFormData = new FormData();
          portraitFormData.append("file", lipSyncFormData.portrait);

          const portraitRes = await fetch("/api/portraits", {
            method: "POST",
            body: portraitFormData
          });
          const portraitData = await portraitRes.json();
          portraitPath = portraitData.filepath;
        }

        // Start automatic lip sync generation
        const response = await fetch("/api/generate-lipsync-auto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            niche: lipSyncFormData.niche,
            topic: lipSyncFormData.topic,
            portraitPath,
            duration: parseInt(lipSyncFormData.duration),
            platforms: lipSyncFormData.platforms,
            backgroundMood: lipSyncFormData.backgroundMood,
          })
        });

        const data = await response.json();

        if (data.jobId) {
          router.push(`/generating/${data.jobId}`);
        } else if (data.error) {
          alert(data.error);
        }
      }
    } catch (error) {
      console.error("Failed to start generation:", error);
      alert("Failed to start video generation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to render voice selection (shared between both modes)
  const renderVoiceSelection = (selectedVoiceId: string, onSelect: (id: string) => void) => (
    <div>
      <Label className="text-white text-lg font-semibold mb-3 block">
        Voice Selection
        <span className="text-purple-300 text-sm font-normal ml-2">
          ({VOICE_OPTIONS.find(v => v.id === selectedVoiceId)?.name || "Default"})
        </span>
      </Label>

      {/* Gender Filter */}
      <div className="flex gap-2 mb-4">
        {[
          { value: "all", label: "All Voices" },
          { value: "female", label: "Female" },
          { value: "male", label: "Male" }
        ].map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setVoiceFilter(filter.value as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              voiceFilter === filter.value
                ? "bg-purple-600 text-white"
                : "bg-white/10 text-purple-200 hover:bg-white/20"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Voice Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-2">
        {VOICE_OPTIONS
          .filter(voice => voiceFilter === "all" || voice.gender === voiceFilter || voice.gender === "any")
          .map((voice) => (
          <button
            key={voice.id}
            type="button"
            onClick={() => onSelect(voice.id)}
            className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
              selectedVoiceId === voice.id
                ? "border-purple-400 bg-gradient-to-br from-purple-500/20 to-blue-500/20 shadow-lg"
                : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">{voice.icon}</div>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold truncate ${
                  selectedVoiceId === voice.id ? "text-white" : "text-purple-100"
                }`}>
                  {voice.name}
                </div>
                <div className={`text-xs mt-1 line-clamp-2 ${
                  selectedVoiceId === voice.id ? "text-purple-200" : "text-purple-300/70"
                }`}>
                  {voice.description}
                </div>
              </div>
            </div>
            {selectedVoiceId === voice.id && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
      <p className="text-sm text-purple-300 mt-3">
        Choose a voice for your video narration.
      </p>
    </div>
  );

  // Helper to render platforms (shared between both modes)
  const renderPlatformSelection = (selectedPlatforms: string[], onToggle: (platform: string) => void) => (
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
              selectedPlatforms.includes(platform.name)
                ? "border-white bg-white/10 shadow-lg"
                : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedPlatforms.includes(platform.name)}
              onChange={() => onToggle(platform.name)}
              className="sr-only"
            />
            <span className="text-2xl">{platform.icon}</span>
            <span className="text-white font-medium capitalize">{platform.name}</span>
            {selectedPlatforms.includes(platform.name) && (
              <span className="ml-auto text-green-400">✓</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation />
      <div className="max-w-4xl mx-auto p-8 pt-24">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Create Video</h1>
          <p className="text-purple-200">Choose your creation method</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`flex-1 py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
              activeTab === "ai"
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg"
                : "bg-white/10 text-purple-200 hover:bg-white/20"
            }`}
          >
            <span className="mr-2">🤖</span>
            AI Generated
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            className={`flex-1 py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
              activeTab === "custom"
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg"
                : "bg-white/10 text-purple-200 hover:bg-white/20"
            }`}
          >
            <span className="mr-2">📝</span>
            Custom Script
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("lipsync")}
            className={`flex-1 py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
              activeTab === "lipsync"
                ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg"
                : "bg-white/10 text-purple-200 hover:bg-white/20"
            }`}
          >
            <span className="mr-2">🎤</span>
            Grok Lip Sync
          </button>
        </div>

        {/* AI Generated Tab */}
        {activeTab === "ai" && (
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
                  { value: "epic-battles", emoji: "⚔️", label: "Epic Battles", gradient: "from-red-600 to-yellow-500" },
                  { value: "custom", emoji: "🎨", label: "Custom", gradient: "from-indigo-500 to-purple-600" },
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

            {/* Voice Selection */}
            <div>
              <Label className="text-white text-lg font-semibold mb-3 block">
                Voice Selection
                <span className="text-purple-300 text-sm font-normal ml-2">
                  ({VOICE_OPTIONS.find(v => v.id === formData.voiceId)?.name || "Default"})
                </span>
              </Label>

              {/* Gender Filter */}
              <div className="flex gap-2 mb-4">
                {[
                  { value: "all", label: "All Voices" },
                  { value: "female", label: "Female" },
                  { value: "male", label: "Male" }
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setVoiceFilter(filter.value as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      voiceFilter === filter.value
                        ? "bg-purple-600 text-white"
                        : "bg-white/10 text-purple-200 hover:bg-white/20"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Voice Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-2">
                {VOICE_OPTIONS
                  .filter(voice => voiceFilter === "all" || voice.gender === voiceFilter || voice.gender === "any")
                  .map((voice) => (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, voiceId: voice.id })}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                      formData.voiceId === voice.id
                        ? "border-purple-400 bg-gradient-to-br from-purple-500/20 to-blue-500/20 shadow-lg"
                        : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{voice.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold truncate ${
                          formData.voiceId === voice.id ? "text-white" : "text-purple-100"
                        }`}>
                          {voice.name}
                        </div>
                        <div className={`text-xs mt-1 line-clamp-2 ${
                          formData.voiceId === voice.id ? "text-purple-200" : "text-purple-300/70"
                        }`}>
                          {voice.description}
                        </div>
                      </div>
                    </div>
                    {formData.voiceId === voice.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-sm text-purple-300 mt-3">
                Choose a voice for your video narration. Each voice has unique characteristics.
              </p>
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
        )}

        {/* Custom Script Tab */}
        {activeTab === "custom" && (
          <Card className="bg-white/10 backdrop-blur-md border-white/20 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Info Banner */}
              <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📝</span>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Custom Script Mode</h3>
                    <p className="text-blue-200 text-sm">
                      Define your own scenes with specific visuals and voiceover. Each scene generates one video segment.
                    </p>
                  </div>
                </div>
              </div>

              {/* Generation Mode Selector */}
              <div className="mb-6">
                <Label className="text-white text-lg font-semibold mb-3 block">
                  Generation Mode
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setCustomScriptData({ ...customScriptData, generationMode: "grok-lipsync" })}
                    className={`relative p-5 rounded-xl border-2 transition-all duration-200 text-left ${
                      customScriptData.generationMode === "grok-lipsync"
                        ? "border-purple-400 bg-gradient-to-br from-purple-500/20 to-blue-500/20 shadow-lg"
                        : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">🎤</span>
                      <div>
                        <div className={`font-bold text-lg ${
                          customScriptData.generationMode === "grok-lipsync" ? "text-white" : "text-purple-100"
                        }`}>
                          Grok Lip Sync
                        </div>
                        <div className={`text-sm mt-1 ${
                          customScriptData.generationMode === "grok-lipsync" ? "text-purple-200" : "text-purple-300/70"
                        }`}>
                          Native lip sync + AI voice. Perfect sync, spectacular backgrounds.
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="px-2 py-0.5 bg-green-500/30 text-green-300 text-xs rounded">Recommended</span>
                          <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-xs rounded">Perfect Sync</span>
                        </div>
                      </div>
                    </div>
                    {customScriptData.generationMode === "grok-lipsync" && (
                      <div className="absolute top-3 right-3 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomScriptData({ ...customScriptData, generationMode: "elevenlabs-tts" })}
                    className={`relative p-5 rounded-xl border-2 transition-all duration-200 text-left ${
                      customScriptData.generationMode === "elevenlabs-tts"
                        ? "border-purple-400 bg-gradient-to-br from-purple-500/20 to-blue-500/20 shadow-lg"
                        : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">🎙️</span>
                      <div>
                        <div className={`font-bold text-lg ${
                          customScriptData.generationMode === "elevenlabs-tts" ? "text-white" : "text-purple-100"
                        }`}>
                          ElevenLabs Voice
                        </div>
                        <div className={`text-sm mt-1 ${
                          customScriptData.generationMode === "elevenlabs-tts" ? "text-purple-200" : "text-purple-300/70"
                        }`}>
                          Custom voice selection. 13+ voices + cloning.
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="px-2 py-0.5 bg-blue-500/30 text-blue-300 text-xs rounded">Voice Options</span>
                          <span className="px-2 py-0.5 bg-orange-500/30 text-orange-300 text-xs rounded">Voice Cloning</span>
                        </div>
                      </div>
                    </div>
                    {customScriptData.generationMode === "elevenlabs-tts" && (
                      <div className="absolute top-3 right-3 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Background Mood Selector (only for Grok Lip Sync mode) */}
              {customScriptData.generationMode === "grok-lipsync" && (
                <div className="mb-6">
                  <Label className="text-white text-lg font-semibold mb-3 block">
                    Background Style
                    <span className="text-purple-300 text-sm font-normal ml-2">
                      ({BACKGROUND_MOODS.find(m => m.value === customScriptData.backgroundMood)?.label})
                    </span>
                  </Label>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {BACKGROUND_MOODS.map((mood) => (
                      <button
                        key={mood.value}
                        type="button"
                        onClick={() => setCustomScriptData({ ...customScriptData, backgroundMood: mood.value })}
                        className={`relative p-3 rounded-xl border-2 transition-all duration-200 text-center ${
                          customScriptData.backgroundMood === mood.value
                            ? "border-purple-400 bg-gradient-to-br from-purple-500/20 to-blue-500/20 shadow-lg"
                            : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"
                        }`}
                      >
                        <div className="text-2xl mb-1">{mood.icon}</div>
                        <div className={`text-sm font-medium ${
                          customScriptData.backgroundMood === mood.value ? "text-white" : "text-purple-200"
                        }`}>
                          {mood.label}
                        </div>
                        {customScriptData.backgroundMood === mood.value && (
                          <div className="absolute top-1 right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-purple-300 mt-2">
                    {BACKGROUND_MOODS.find(m => m.value === customScriptData.backgroundMood)?.description}
                  </p>
                </div>
              )}

              {/* Optional: Replace Voice with ElevenLabs (for Grok Lip Sync mode) */}
              {customScriptData.generationMode === "grok-lipsync" && (
                <div className="mb-6">
                  <label
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      customScriptData.replaceVoice
                        ? "border-orange-400/50 bg-orange-500/10"
                        : "border-white/20 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={customScriptData.replaceVoice}
                      onChange={(e) => setCustomScriptData({ ...customScriptData, replaceVoice: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`w-12 h-6 rounded-full transition-all ${
                      customScriptData.replaceVoice ? "bg-orange-500" : "bg-white/20"
                    } relative`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                        customScriptData.replaceVoice ? "left-7" : "left-1"
                      }`} />
                    </div>
                    <div>
                      <div className="text-white font-medium">Replace Voice with ElevenLabs</div>
                      <div className="text-purple-300 text-sm">
                        Extract Grok audio and replace with custom ElevenLabs voice
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {/* Project Title */}
              <div>
                <Label htmlFor="customTitle" className="text-white text-lg font-semibold mb-3 block">
                  Project Title
                </Label>
                <Input
                  id="customTitle"
                  placeholder="e.g., DriftMark Holdings - Recycling Solutions"
                  value={customScriptData.title}
                  onChange={(e) => setCustomScriptData({ ...customScriptData, title: e.target.value })}
                  className="bg-white/5 border-2 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400"
                  required
                />
              </div>

              {/* Portrait Upload */}
              <div>
                <Label htmlFor="customPortrait" className="text-white text-lg font-semibold mb-3 block">
                  Portrait Image
                </Label>
                <div className="relative">
                  <Input
                    id="customPortrait"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCustomScriptData({ ...customScriptData, portrait: e.target.files?.[0] || null })}
                    className="bg-white/5 border-2 border-white/20 text-white file:bg-gradient-to-r file:from-purple-600 file:to-blue-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-md file:font-semibold file:mr-4 hover:border-purple-400 transition-all"
                  />
                  {customScriptData.portrait && (
                    <div className="mt-2 text-sm text-green-300 flex items-center gap-2">
                      ✓ {customScriptData.portrait.name}
                    </div>
                  )}
                </div>
                <p className="text-sm text-purple-300 mt-2">Upload your friend's portrait for the video</p>
              </div>

              {/* Scenes */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-white text-lg font-semibold">
                    Scenes ({customScriptData.scenes.length})
                  </Label>
                  <Button
                    type="button"
                    onClick={addScene}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    size="sm"
                  >
                    + Add Scene
                  </Button>
                </div>

                <div className="space-y-4">
                  {customScriptData.scenes.map((scene, index) => (
                    <div
                      key={scene.id}
                      className="bg-white/5 border border-white/20 rounded-xl p-5 relative"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </span>
                          <Input
                            placeholder="Scene Title (e.g., Opening Scene)"
                            value={scene.title}
                            onChange={(e) => updateScene(scene.id, "title", e.target.value)}
                            className="bg-white/5 border-white/20 text-white placeholder:text-white/40 w-48"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="0:00–0:10"
                            value={scene.timestamp}
                            onChange={(e) => updateScene(scene.id, "timestamp", e.target.value)}
                            className="bg-white/5 border-white/20 text-white placeholder:text-white/40 w-28 text-center"
                          />
                          {customScriptData.scenes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeScene(scene.id)}
                              className="text-red-400 hover:text-red-300 p-2"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label className="text-purple-200 text-sm mb-1 block">
                            Visual Description (what should appear on screen)
                          </Label>
                          <Textarea
                            placeholder="e.g., Streets with scattered waste, overflowing bins, rivers with litter."
                            value={scene.visual}
                            onChange={(e) => updateScene(scene.id, "visual", e.target.value)}
                            className="bg-white/5 border-white/20 text-white placeholder:text-white/40 text-sm"
                            rows={2}
                          />
                        </div>

                        <div>
                          <Label className="text-purple-200 text-sm mb-1 block">
                            Voiceover Script (what will be spoken)
                          </Label>
                          <Textarea
                            placeholder='e.g., "Every day, communities struggle with waste—polluting streets, rivers, and neighborhoods."'
                            value={scene.voiceover}
                            onChange={(e) => updateScene(scene.id, "voiceover", e.target.value)}
                            className="bg-white/5 border-white/20 text-white placeholder:text-white/40 text-sm"
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-purple-300 mt-3">
                  Each scene will generate a separate video segment. The voiceover determines the audio timing.
                </p>
              </div>

              {/* Platforms */}
              {renderPlatformSelection(
                customScriptData.platforms,
                (platform) => {
                  if (customScriptData.platforms.includes(platform)) {
                    setCustomScriptData({
                      ...customScriptData,
                      platforms: customScriptData.platforms.filter(p => p !== platform)
                    });
                  } else {
                    setCustomScriptData({
                      ...customScriptData,
                      platforms: [...customScriptData.platforms, platform]
                    });
                  }
                }
              )}

              {/* Voice Selection - Show for ElevenLabs mode OR when replaceVoice is enabled in Grok mode */}
              {(customScriptData.generationMode === "elevenlabs-tts" || customScriptData.replaceVoice) && (
                renderVoiceSelection(
                  customScriptData.voiceId,
                  (id) => setCustomScriptData({ ...customScriptData, voiceId: id })
                )
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !customScriptData.title || customScriptData.scenes.some(s => !s.voiceover)}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
                size="lg"
              >
                {loading ? (
                  <span className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Starting Generation...
                  </span>
                ) : (
                  `Generate ${customScriptData.scenes.length} Scene Video →`
                )}
              </Button>
            </form>
          </Card>
        )}

        {/* Grok Lip Sync Tab - Automatic Generation with Native Lip Sync */}
        {activeTab === "lipsync" && (
          <Card className="bg-white/10 backdrop-blur-md border-white/20 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Info Banner */}
              <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-400/30 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🎤</span>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Grok Lip Sync - Perfect Audio-Video Sync</h3>
                    <p className="text-pink-200 text-sm">
                      Fully automatic video generation using Grok&apos;s native lip sync. Enter a topic, pick a style, and get perfectly synced videos with spectacular backgrounds.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="px-2 py-0.5 bg-green-500/30 text-green-300 text-xs rounded">Perfect Lip Sync</span>
                      <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-xs rounded">AI Voice</span>
                      <span className="px-2 py-0.5 bg-blue-500/30 text-blue-300 text-xs rounded">Spectacular Backgrounds</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Niche Selection - Same as AI Generated */}
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
                    { value: "epic-battles", emoji: "⚔️", label: "Epic Battles", gradient: "from-red-600 to-yellow-500" },
                    { value: "custom", emoji: "🎨", label: "Custom", gradient: "from-indigo-500 to-purple-600" },
                  ].map((niche) => (
                    <button
                      key={niche.value}
                      type="button"
                      onClick={() => setLipSyncFormData({ ...lipSyncFormData, niche: niche.value })}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                        lipSyncFormData.niche === niche.value
                          ? `border-white bg-gradient-to-br ${niche.gradient} shadow-lg scale-105`
                          : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"
                      }`}
                    >
                      <div className="text-3xl mb-2">{niche.emoji}</div>
                      <div className={`text-sm font-medium ${
                        lipSyncFormData.niche === niche.value ? "text-white" : "text-purple-200"
                      }`}>
                        {niche.label}
                      </div>
                      {lipSyncFormData.niche === niche.value && (
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
                <Label htmlFor="lipsyncTopic" className="text-white text-lg font-semibold mb-3 block">Video Topic</Label>
                <Textarea
                  id="lipsyncTopic"
                  value={lipSyncFormData.topic}
                  onChange={(e) => setLipSyncFormData({ ...lipSyncFormData, topic: e.target.value })}
                  placeholder="e.g., 5 AI Tools to Boost Productivity in 2025"
                  className="bg-white/5 border-2 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all"
                  rows={4}
                  required
                />
                <p className="text-sm text-purple-300 mt-2">Be specific and engaging to get the best results</p>
              </div>

              {/* Portrait Upload - Same style as AI Generated */}
              <div>
                <Label htmlFor="lipsyncPortrait" className="text-white text-lg font-semibold mb-3 block">Portrait Image</Label>
                <div className="relative">
                  <Input
                    id="lipsyncPortrait"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLipSyncFormData({ ...lipSyncFormData, portrait: e.target.files?.[0] || null })}
                    className="bg-white/5 border-2 border-white/20 text-white file:bg-gradient-to-r file:from-purple-600 file:to-blue-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-md file:font-semibold file:mr-4 hover:border-purple-400 transition-all"
                  />
                  {lipSyncFormData.portrait && (
                    <div className="mt-2 text-sm text-green-300 flex items-center gap-2">
                      ✓ {lipSyncFormData.portrait.name}
                    </div>
                  )}
                </div>
                <p className="text-sm text-purple-300 mt-2">Upload your portrait for consistent character appearance</p>
              </div>

              {/* Video Duration - Same as AI Generated */}
              <div>
                <Label htmlFor="lipsyncDuration" className="text-white text-lg font-semibold mb-3 block">
                  Video Duration: <span className="text-purple-300">{lipSyncFormData.duration}s</span>
                  <span className="text-pink-300 text-sm font-normal ml-2">
                    (~{Math.ceil(parseInt(lipSyncFormData.duration) / 5)} scenes)
                  </span>
                </Label>
                <input
                  id="lipsyncDuration"
                  type="range"
                  min="15"
                  max="45"
                  step="5"
                  value={lipSyncFormData.duration}
                  onChange={(e) => setLipSyncFormData({ ...lipSyncFormData, duration: e.target.value })}
                  className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-sm text-purple-300 mt-2">
                  <span>15s (3 scenes)</span>
                  <span>45s (9 scenes)</span>
                </div>
              </div>

              {/* Background Style Selector */}
              <div>
                <Label className="text-white text-lg font-semibold mb-3 block">
                  Background Style
                  <span className="text-pink-300 text-sm font-normal ml-2">
                    ({BACKGROUND_MOODS.find(m => m.value === lipSyncFormData.backgroundMood)?.label})
                  </span>
                </Label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {BACKGROUND_MOODS.map((mood) => (
                    <button
                      key={mood.value}
                      type="button"
                      onClick={() => setLipSyncFormData({ ...lipSyncFormData, backgroundMood: mood.value })}
                      className={`relative p-3 rounded-xl border-2 transition-all duration-200 text-center ${
                        lipSyncFormData.backgroundMood === mood.value
                          ? "border-pink-400 bg-gradient-to-br from-pink-500/20 to-purple-500/20 shadow-lg"
                          : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"
                      }`}
                    >
                      <div className="text-2xl mb-1">{mood.icon}</div>
                      <div className={`text-sm font-medium ${
                        lipSyncFormData.backgroundMood === mood.value ? "text-white" : "text-purple-200"
                      }`}>
                        {mood.label}
                      </div>
                      {lipSyncFormData.backgroundMood === mood.value && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-pink-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-pink-300 mt-2">
                  {BACKGROUND_MOODS.find(m => m.value === lipSyncFormData.backgroundMood)?.description}
                </p>
              </div>

              {/* Platform Selection - Same as AI Generated */}
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
                        lipSyncFormData.platforms.includes(platform.name)
                          ? "border-white bg-white/10 shadow-lg"
                          : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={lipSyncFormData.platforms.includes(platform.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setLipSyncFormData({ ...lipSyncFormData, platforms: [...lipSyncFormData.platforms, platform.name] });
                          } else {
                            setLipSyncFormData({ ...lipSyncFormData, platforms: lipSyncFormData.platforms.filter(p => p !== platform.name) });
                          }
                        }}
                        className="sr-only"
                      />
                      <span className="text-2xl">{platform.icon}</span>
                      <span className="text-white font-medium capitalize">{platform.name}</span>
                      {lipSyncFormData.platforms.includes(platform.name) && (
                        <span className="ml-auto text-green-400">✓</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !lipSyncFormData.niche || !lipSyncFormData.topic}
                className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
                size="lg"
              >
                {loading ? (
                  <span className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Starting Lip Sync Generation...
                  </span>
                ) : (
                  "Generate Lip Sync Video →"
                )}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
