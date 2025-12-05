import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { AudioGeneration, ElevenLabsVoiceSettings } from '../types';

export class ElevenLabsService {
  private client: AxiosInstance;
  private apiKey: string;
  private voiceId: string;
  private voiceSettings: ElevenLabsVoiceSettings;

  constructor(
    apiKey: string,
    voiceId: string,
    voiceSettings: ElevenLabsVoiceSettings = {
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0.5,
      useSpeakerBoost: true,
    }
  ) {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
    this.voiceSettings = voiceSettings;

    this.client = axios.create({
      baseURL: 'https://api.elevenlabs.io/v1',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generates audio from script using voice clone (AUDIO-FIRST APPROACH)
   * This is the critical first step that determines video segment count
   */
  async generateAudio(
    script: string,
    outputPath: string,
    segmentDuration: number = 7
  ): Promise<AudioGeneration> {
    try {
      console.log('🎤 Generating audio narration (Audio-First Approach)...');

      // Extract plain text if script is in timestamped format
      let textToSpeak = script;
      try {
        // Check if script is already an object/array or needs parsing
        let parsed = typeof script === 'string' ? JSON.parse(script) : script;

        if (Array.isArray(parsed)) {
          if (typeof parsed[0] === 'string') {
            // Handle array of strings with embedded timestamps: "[0:00-0:03] \"text\""
            textToSpeak = parsed.map((str: string) => {
              // Remove timestamp pattern [HH:MM-HH:MM] and extract quoted text
              return str.replace(/^\[[\d:]+\-[\d:]+\]\s*"(.+)"$/, '$1').replace(/\\"/g, '"');
            }).join(' ');
          } else {
            // Handle array of objects with text/content fields
            textToSpeak = parsed.map((segment: any) => segment.text || segment.content || '').join(' ');
          }
          console.log('  ↳ Extracted text from timestamped script');
        } else if (typeof parsed === 'object' && parsed !== null) {
          // Handle object with time-range keys: {"0-3s": "text", "4-30s": "text"}
          // or nested objects: {"text": {"0-3s": "text"}}
          if (parsed.text && typeof parsed.text === 'object') {
            textToSpeak = Object.values(parsed.text).join(' ');
          } else {
            textToSpeak = Object.values(parsed).filter(v => typeof v === 'string').join(' ');
          }
          console.log('  ↳ Extracted text from object-based script format');
        }
      } catch (e) {
        // Script is already plain text, use as-is
      }

      // Generate the audio
      const response = await this.client.post(
        `/text-to-speech/${this.voiceId}`,
        {
          text: textToSpeak,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: this.voiceSettings.stability,
            similarity_boost: this.voiceSettings.similarityBoost,
            style: this.voiceSettings.style,
            use_speaker_boost: this.voiceSettings.useSpeakerBoost,
          },
        },
        {
          responseType: 'arraybuffer',
        }
      );

      // Save audio file
      fs.writeFileSync(outputPath, Buffer.from(response.data));

      // Get audio duration
      const duration = await this.getAudioDuration(outputPath);

      // Calculate segment count (critical for video generation)
      // Add +1 buffer segment ONLY if under safety limit (10 segments max)
      // (KIE videos can be 6-7s, so better to have extra than freeze-frame)
      const baseSegmentCount = Math.ceil(duration / segmentDuration);
      const segmentCount = baseSegmentCount < 10 ? baseSegmentCount + 1 : baseSegmentCount;

      console.log(`✓ Audio generated: ${duration.toFixed(2)}s`);
      if (segmentCount > baseSegmentCount) {
        console.log(`✓ Segments needed: ${segmentCount} (${baseSegmentCount} + 1 buffer) @ ${segmentDuration}s each`);
      } else {
        console.log(`✓ Segments needed: ${segmentCount} (at safety limit, no buffer) @ ${segmentDuration}s each`);
      }

      return {
        audioPath: outputPath,
        duration,
        segmentCount,
        format: 'mp3',
        sampleRate: 44100,
      };
    } catch (error) {
      console.error('ElevenLabs audio generation failed:', error);
      throw new Error(`Failed to generate audio: ${error}`);
    }
  }

  /**
   * Generates audio with precise timing markers for segment boundaries
   */
  async generateTimedAudio(
    script: string,
    outputDir: string,
    segmentDuration: number = 7
  ): Promise<{
    audioGeneration: AudioGeneration;
    segmentTimestamps: number[];
  }> {
    const outputPath = path.join(outputDir, 'narration.mp3');
    const audioGeneration = await this.generateAudio(
      script,
      outputPath,
      segmentDuration
    );

    // Calculate exact timestamps for each segment boundary
    const segmentTimestamps: number[] = [];
    for (let i = 0; i < audioGeneration.segmentCount; i++) {
      segmentTimestamps.push(i * segmentDuration);
    }
    segmentTimestamps.push(audioGeneration.duration); // Add final timestamp

    return {
      audioGeneration,
      segmentTimestamps,
    };
  }

  /**
   * Gets the duration of an audio file in seconds
   */
  private async getAudioDuration(audioPath: string): Promise<number> {
    // Using ffprobe (part of ffmpeg) to get accurate audio duration
    const { execSync } = require('child_process');

    try {
      const output = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
        { encoding: 'utf8' }
      );

      return parseFloat(output.trim());
    } catch (error) {
      console.error('Failed to get audio duration:', error);
      // Fallback: estimate based on character count (rough approximation)
      return this.estimateDuration(fs.readFileSync(audioPath).length);
    }
  }

  /**
   * Estimates audio duration from file size (fallback method)
   */
  private estimateDuration(fileSizeBytes: number): Promise<number> {
    // MP3 at 128kbps: ~16KB per second
    const estimatedSeconds = fileSizeBytes / 16000;
    return Promise.resolve(estimatedSeconds);
  }

  /**
   * Lists available voices for the account
   */
  async listVoices(): Promise<any[]> {
    try {
      const response = await this.client.get('/voices');
      return response.data.voices;
    } catch (error) {
      console.error('Failed to list voices:', error);
      return [];
    }
  }

  /**
   * Gets information about the configured voice
   */
  async getVoiceInfo(): Promise<any> {
    try {
      const response = await this.client.get(`/voices/${this.voiceId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get voice info:', error);
      return null;
    }
  }

  /**
   * Validates that the voice clone exists and is accessible
   */
  async validateVoice(): Promise<boolean> {
    try {
      const voiceInfo = await this.getVoiceInfo();
      if (!voiceInfo) {
        console.error(`❌ Voice ID ${this.voiceId} not found`);
        return false;
      }
      console.log(`✓ Voice validated: ${voiceInfo.name}`);
      return true;
    } catch (error) {
      console.error('Voice validation failed:', error);
      return false;
    }
  }

  /**
   * Optimizes voice settings for different content types
   */
  optimizeVoiceSettings(contentType: 'energetic' | 'calm' | 'professional' | 'storytelling'): void {
    switch (contentType) {
      case 'energetic':
        this.voiceSettings = {
          stability: 0.4,
          similarityBoost: 0.8,
          style: 0.7,
          useSpeakerBoost: true,
        };
        break;
      case 'calm':
        this.voiceSettings = {
          stability: 0.7,
          similarityBoost: 0.7,
          style: 0.3,
          useSpeakerBoost: true,
        };
        break;
      case 'professional':
        this.voiceSettings = {
          stability: 0.6,
          similarityBoost: 0.75,
          style: 0.4,
          useSpeakerBoost: true,
        };
        break;
      case 'storytelling':
        this.voiceSettings = {
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.6,
          useSpeakerBoost: true,
        };
        break;
    }
  }

  /**
   * Generates multiple audio variations for A/B testing
   */
  async generateAudioVariations(
    script: string,
    outputDir: string,
    variationCount: number = 3
  ): Promise<AudioGeneration[]> {
    const variations: AudioGeneration[] = [];

    const settingsVariations = [
      { stability: 0.4, similarityBoost: 0.8, style: 0.6 },
      { stability: 0.5, similarityBoost: 0.75, style: 0.5 },
      { stability: 0.6, similarityBoost: 0.7, style: 0.4 },
    ];

    for (let i = 0; i < Math.min(variationCount, settingsVariations.length); i++) {
      // Temporarily change settings
      const originalSettings = { ...this.voiceSettings };
      this.voiceSettings = {
        ...settingsVariations[i],
        useSpeakerBoost: true,
      };

      const outputPath = path.join(outputDir, `narration_v${i + 1}.mp3`);
      const audio = await this.generateAudio(script, outputPath);
      variations.push(audio);

      // Restore original settings
      this.voiceSettings = originalSettings;
    }

    return variations;
  }

  /**
   * Splits audio into segments for individual processing
   */
  async splitAudioIntoSegments(
    audioPath: string,
    segmentTimestamps: number[],
    outputDir: string
  ): Promise<string[]> {
    const { execSync } = require('child_process');
    const segmentPaths: string[] = [];

    for (let i = 0; i < segmentTimestamps.length - 1; i++) {
      const startTime = segmentTimestamps[i];
      const duration = segmentTimestamps[i + 1] - startTime;
      const outputPath = path.join(outputDir, `audio_segment_${i}.mp3`);

      try {
        execSync(
          `ffmpeg -i "${audioPath}" -ss ${startTime} -t ${duration} -c copy "${outputPath}" -y`,
          { stdio: 'pipe' }
        );
        segmentPaths.push(outputPath);
      } catch (error) {
        console.error(`Failed to split audio segment ${i}:`, error);
      }
    }

    return segmentPaths;
  }

  /**
   * Normalizes audio volume for consistent playback
   */
  async normalizeAudio(inputPath: string, outputPath: string): Promise<void> {
    const { execSync } = require('child_process');

    try {
      execSync(
        `ffmpeg -i "${inputPath}" -af "loudnorm=I=-16:LRA=11:TP=-1.5" "${outputPath}" -y`,
        { stdio: 'pipe' }
      );
      console.log('✓ Audio normalized');
    } catch (error) {
      console.error('Audio normalization failed:', error);
      // Copy original if normalization fails
      fs.copyFileSync(inputPath, outputPath);
    }
  }
}
