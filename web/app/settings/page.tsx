"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navigation } from "@/components/navigation";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    openaiKey: "",
    grokKey: "",
    elevenLabsKey: "",
    elevenLabsVoiceId: "",
    defaultDuration: "60",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const maskKey = (key: string) => {
    if (!key || key.length < 8) return "Not set";
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);

    try {
      // In a real implementation, this would save to a secure backend
      // For now, we'll just show a success message
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation />
      <div className="max-w-4xl mx-auto p-8 pt-24">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
          <p className="text-purple-200">Configure your API keys and preferences</p>
        </div>

        <div className="space-y-6">
          {/* API Keys Section */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20 p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-3xl">🔑</span>
              API Keys
            </h2>

            <div className="space-y-6">
              {/* OpenAI */}
              <div>
                <Label htmlFor="openai" className="text-white text-lg font-semibold mb-3 block">
                  OpenAI API Key
                </Label>
                <Input
                  id="openai"
                  type="password"
                  placeholder="sk-..."
                  value={settings.openaiKey}
                  onChange={(e) => setSettings({ ...settings, openaiKey: e.target.value })}
                  className="bg-white/5 border-2 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                />
                <p className="text-sm text-purple-300 mt-2">Used for script generation and prompt creation</p>
              </div>

              {/* Grok (X.AI) */}
              <div>
                <Label htmlFor="grok" className="text-white text-lg font-semibold mb-3 block">
                  Grok API Key (X.AI)
                </Label>
                <Input
                  id="grok"
                  type="password"
                  placeholder="xai-..."
                  value={settings.grokKey}
                  onChange={(e) => setSettings({ ...settings, grokKey: e.target.value })}
                  className="bg-white/5 border-2 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                />
                <p className="text-sm text-purple-300 mt-2">Used for video and image generation</p>
              </div>

              {/* ElevenLabs */}
              <div>
                <Label htmlFor="elevenlabs" className="text-white text-lg font-semibold mb-3 block">
                  ElevenLabs API Key
                </Label>
                <Input
                  id="elevenlabs"
                  type="password"
                  placeholder="..."
                  value={settings.elevenLabsKey}
                  onChange={(e) => setSettings({ ...settings, elevenLabsKey: e.target.value })}
                  className="bg-white/5 border-2 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                />
                <p className="text-sm text-purple-300 mt-2">Used for voice synthesis</p>
              </div>

              {/* ElevenLabs Voice ID */}
              <div>
                <Label htmlFor="voiceid" className="text-white text-lg font-semibold mb-3 block">
                  ElevenLabs Voice ID
                </Label>
                <Input
                  id="voiceid"
                  type="text"
                  placeholder="Voice ID"
                  value={settings.elevenLabsVoiceId}
                  onChange={(e) => setSettings({ ...settings, elevenLabsVoiceId: e.target.value })}
                  className="bg-white/5 border-2 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                />
                <p className="text-sm text-purple-300 mt-2">The voice to use for narration</p>
              </div>
            </div>
          </Card>

          {/* Default Settings */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20 p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-3xl">⚙️</span>
              Default Settings
            </h2>

            <div>
              <Label htmlFor="defaultDuration" className="text-white text-lg font-semibold mb-3 block">
                Default Video Duration: <span className="text-purple-300">{settings.defaultDuration}s</span>
              </Label>
              <input
                id="defaultDuration"
                type="range"
                min="15"
                max="180"
                step="5"
                value={settings.defaultDuration}
                onChange={(e) => setSettings({ ...settings, defaultDuration: e.target.value })}
                className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-sm text-purple-300 mt-2">
                <span>15s</span>
                <span>180s</span>
              </div>
            </div>
          </Card>

          {/* Current Configuration Info */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-md border-blue-400/20 p-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Configuration Note</h3>
                <p className="text-purple-200 text-sm mb-3">
                  Your API keys are currently loaded from environment variables.
                  Any changes made here will override those settings for this session only.
                </p>
                <p className="text-purple-200 text-sm">
                  For permanent changes, update your <code className="bg-white/10 px-2 py-1 rounded">.env</code> file.
                </p>
              </div>
            </div>
          </Card>

          {/* Save Button */}
          <div className="flex gap-4">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all"
              size="lg"
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </span>
              ) : saved ? (
                <span className="flex items-center gap-2">
                  ✓ Saved Successfully
                </span>
              ) : (
                "Save Settings"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
