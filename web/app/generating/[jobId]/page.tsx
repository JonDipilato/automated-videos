"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface JobStatus {
  job: {
    id: string;
    status: string;
    currentStep: string;
    progress: number;
    error?: string;
  };
  video?: {
    id: string;
    topic: string;
    videoPath?: string;
    duration?: number;
    status: string;
  };
}

interface Step {
  id: string;
  label: string;
  icon: string;
  progressStart: number;
  progressEnd: number;
  substeps?: string[];
}

export default function GeneratingPage({ params }: { params: Promise<{ jobId: string }> }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Poll for status every 2 seconds
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/status/${unwrappedParams.jobId}`);
        const data = await response.json();

        setStatus(data);

        // If completed, redirect to video page
        if (data.job.status === 'completed' && data.video?.videoPath) {
          setTimeout(() => {
            router.push(`/library`);
          }, 2000);
        }

        // If failed, show error
        if (data.job.status === 'failed') {
          setError(data.job.error || 'Video generation failed');
        }
      } catch (err) {
        console.error('Failed to fetch status:', err);
        setError('Failed to check generation status');
      }
    };

    // Poll immediately and then every 2 seconds
    pollStatus();
    const interval = setInterval(pollStatus, 2000);

    return () => clearInterval(interval);
  }, [unwrappedParams.jobId, router]);

  const steps: Step[] = [
    {
      id: 'init',
      label: 'Initializing',
      icon: '⚡',
      progressStart: 0,
      progressEnd: 10,
    },
    {
      id: 'script',
      label: 'Generating Script',
      icon: '✍️',
      progressStart: 10,
      progressEnd: 20,
      substeps: ['Analyzing topic', 'Creating storyline', 'Writing script'],
    },
    {
      id: 'audio',
      label: 'Generating Audio',
      icon: '🎤',
      progressStart: 20,
      progressEnd: 25,
      substeps: ['Creating voice narration', 'Calculating timing'],
    },
    {
      id: 'duplicate',
      label: 'Checking Uniqueness',
      icon: '🔍',
      progressStart: 25,
      progressEnd: 30,
    },
    {
      id: 'prompts',
      label: 'Creating Visual Prompts',
      icon: '🎨',
      progressStart: 30,
      progressEnd: 50,
      substeps: ['Generating cinematic descriptions', 'Planning transitions'],
    },
    {
      id: 'video',
      label: 'Generating Video Segments',
      icon: '🎬',
      progressStart: 50,
      progressEnd: 85,
      substeps: ['This takes 2-3 minutes per segment'],
    },
    {
      id: 'assembly',
      label: 'Assembling Final Video',
      icon: '🎥',
      progressStart: 85,
      progressEnd: 95,
      substeps: ['Merging segments', 'Adding captions', 'Final rendering'],
    },
    {
      id: 'complete',
      label: 'Finalizing',
      icon: '✅',
      progressStart: 95,
      progressEnd: 100,
    },
  ];

  const getCurrentStep = (progress: number) => {
    return steps.find(
      (step) => progress >= step.progressStart && progress < step.progressEnd
    ) || steps[0];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8 flex items-center justify-center">
      <Card className="bg-white/10 backdrop-blur-md border-white/20 p-8 max-w-2xl w-full">
        {error ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-4">❌ Generation Failed</h2>
            <p className="text-white mb-4">{error}</p>
            <button
              onClick={() => router.push('/create')}
              className="text-purple-300 hover:text-purple-200 underline"
            >
              Try Again
            </button>
          </div>
        ) : status?.job.status === 'completed' ? (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-green-400 mb-4">✅ Video Ready!</h2>
            <p className="text-white mb-4">Your video has been generated successfully</p>
            <p className="text-purple-200">Redirecting to library...</p>
          </div>
        ) : (
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Generating Your Video</h2>
            {status?.video && (
              <p className="text-purple-200 mb-6">Topic: {status.video.topic}</p>
            )}

            <div className="space-y-6">
              {/* Overall Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-medium">Overall Progress</span>
                  <span className="text-purple-200 font-bold">{status?.job.progress || 0}%</span>
                </div>
                <Progress value={status?.job.progress || 0} className="h-3" />
              </div>

              {/* Detailed Steps */}
              <div className="space-y-2 bg-white/5 rounded-lg p-4">
                {steps.map((step) => {
                  const progress = status?.job.progress || 0;
                  const isComplete = progress > step.progressEnd;
                  const isActive = progress >= step.progressStart && progress < step.progressEnd;
                  const isPending = progress < step.progressStart;

                  return (
                    <div key={step.id} className="space-y-1">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-lg shrink-0 transition-all ${
                            isComplete
                              ? 'bg-green-500/20 border-2 border-green-400'
                              : isActive
                              ? 'bg-purple-500/20 border-2 border-purple-400 animate-pulse'
                              : 'bg-white/10 border-2 border-white/20'
                          }`}
                        >
                          {isComplete ? (
                            <span className="text-green-400">✓</span>
                          ) : isActive ? (
                            <span className="text-purple-300">{step.icon}</span>
                          ) : (
                            <span className="text-white/40">{step.icon}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`font-semibold ${
                                isComplete
                                  ? 'text-green-300'
                                  : isActive
                                  ? 'text-white'
                                  : 'text-white/40'
                              }`}
                            >
                              {step.label}
                            </span>
                            {isActive && (
                              <span className="text-purple-300 text-sm animate-pulse">
                                In Progress...
                              </span>
                            )}
                            {isComplete && (
                              <span className="text-green-400 text-sm">✓ Done</span>
                            )}
                          </div>
                          {step.substeps && isActive && (
                            <div className="mt-1 space-y-1">
                              {step.substeps.map((substep, idx) => (
                                <div key={idx} className="text-sm text-purple-200 pl-4 border-l-2 border-purple-400/30">
                                  • {substep}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Current Step Detail */}
              {status?.job.currentStep && (
                <div className="bg-purple-500/10 border border-purple-400/30 rounded-lg p-4">
                  <p className="text-sm text-purple-200 mb-1">Current Step:</p>
                  <p className="text-white font-medium">{status.job.currentStep}</p>
                </div>
              )}

              {/* Job ID for Support */}
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-300 mb-1">Job ID (for support)</p>
                <p className="text-xs text-white/60 font-mono">{unwrappedParams.jobId}</p>
              </div>

              <p className="text-purple-200 text-sm text-center mt-6">
                ⏱️ This usually takes 3-5 minutes. Please don't close this page.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
