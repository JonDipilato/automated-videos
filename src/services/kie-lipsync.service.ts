import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { GCSStorageService } from './gcs-storage.service';

/**
 * Response from lip-sync video generation
 */
export interface LipSyncVideoResponse {
  videoUrl: string;
  dialogue: string;
  background: string;
  segmentIndex: number;
  status: 'completed' | 'failed';
  hasAudio: boolean;
}

/**
 * Background mood presets for spectacular visuals
 */
export type BackgroundMood = 'dramatic' | 'futuristic' | 'nature' | 'urban' | 'corporate' | 'custom';

/**
 * KIE Lip Sync Service
 *
 * Creates lip-synced videos using Grok Imagine's native speech capabilities.
 * Uses the confirmed working prompt format:
 *
 * Line: "dialogue here"
 * Keep the original video motion, lip movement, expressions...
 * Background: [enhanced description]
 *
 * IMPORTANT: This service WRAPS the existing KIE.AI infrastructure.
 * It does NOT replace kie.service.ts - it uses the same API with different prompts.
 */
export class KieLipSyncService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string = 'https://api.kie.ai/api/v1/jobs';
  private gcsStorage: GCSStorageService;

  constructor(apiKey: string) {
    this.apiKey = apiKey;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 180000, // 3 minutes for video generation
    });

    // Reuse existing GCS storage service
    this.gcsStorage = new GCSStorageService();
  }

  /**
   * Build the lip-sync prompt format that enables Grok's native speech
   *
   * User-tested and confirmed working format:
   * Line: "dialogue"
   * Keep the original video motion, lip movement, expressions...
   * Background: [enhanced spectacular description]
   */
  buildLipSyncPrompt(dialogue: string, background: string): string {
    return `Line: "${dialogue}"
Keep the original video motion, lip movement, expressions, and the speaker exactly as they are.
Do NOT freeze the face or replace the speaker.
Only modify the background environment behind or move with the person.

Background: ${background}`;
  }

  /**
   * Enhance background descriptions to create SPECTACULAR visuals
   * Transforms basic descriptions into cinematic prompts
   */
  enhanceBackground(basic: string, mood: BackgroundMood): string {
    const enhancements: Record<BackgroundMood, string> = {
      dramatic: 'volumetric god rays, dramatic lens flares, deep cinematic shadows, epic sense of scale, film grain texture',
      futuristic: 'holographic overlays, pulsing neon blue accents, floating particle effects, cyberpunk aesthetic, chrome reflections',
      nature: 'golden hour lighting, ethereal morning mist, stunning depth layers, photorealistic detail, National Geographic quality',
      urban: 'rain-slicked streets, neon signs reflecting in puddles, atmospheric fog, cinematic noir shadows, moody lighting',
      corporate: 'sleek glass surfaces, elegant soft bokeh, professional-grade lighting, premium minimalist feel, executive atmosphere',
      custom: '' // No enhancement for custom mode
    };

    const enhancement = enhancements[mood];
    if (mood === 'custom' || !enhancement) {
      return `${basic}, cinematic 4K quality, professional lighting`;
    }

    return `${basic}, ${enhancement}, cinematic 4K, ultra-detailed, award-winning cinematography`;
  }

  /**
   * Generate a video segment with lip-sync
   * Uses KIE.AI API with the lip-sync prompt format
   */
  async generateWithLipSync(
    portraitUrl: string,
    dialogue: string,
    background: string,
    outputDir: string,
    segmentIndex: number,
    mood: BackgroundMood = 'dramatic',
    forceUpload: boolean = false
  ): Promise<LipSyncVideoResponse> {
    try {
      // Step 1: Get image URL (same as existing kie.service.ts logic)
      let imageUrl: string;

      if (portraitUrl.startsWith('http://') || portraitUrl.startsWith('https://')) {
        imageUrl = portraitUrl;
        if (forceUpload) {
          console.log(`  ↳ Using composited frame from previous segment`);
        } else {
          console.log(`  ↳ Using portrait URL directly (first segment)`);
        }
      } else {
        // Local file - upload to GCS first (same as existing)
        console.log(`  ↳ Uploading local image to GCS...`);
        imageUrl = await this.uploadImageToGCS(portraitUrl);
      }

      // Step 2: Enhance background for spectacular visuals
      const enhancedBackground = this.enhanceBackground(background, mood);

      // Step 3: Build lip-sync prompt
      const lipSyncPrompt = this.buildLipSyncPrompt(dialogue, enhancedBackground);

      console.log(`  ↳ Dialogue: "${dialogue.substring(0, 50)}${dialogue.length > 50 ? '...' : ''}"`);
      console.log(`  ↳ Background mood: ${mood}`);
      console.log(`  ↳ Enhanced prompt: ${lipSyncPrompt.substring(0, 100)}...`);

      // Step 4: Create video generation task (same API as kie.service.ts)
      const taskId = await this.createVideoTask(imageUrl, lipSyncPrompt, 'normal');
      console.log(`  ↳ KIE task created: ${taskId}`);

      // Step 5: Poll for completion (same as existing)
      const videoUrl = await this.pollTaskCompletion(taskId);

      // Step 6: Download video
      const videoPath = await this.downloadVideo(
        videoUrl,
        outputDir,
        `lipsync_segment_${segmentIndex}.mp4`
      );

      console.log(`  ✓ Lip-sync segment ${segmentIndex} generated with audio`);

      return {
        videoUrl: videoPath,
        dialogue,
        background: enhancedBackground,
        segmentIndex,
        status: 'completed',
        hasAudio: true, // Grok generates audio with lip-sync
      };
    } catch (error) {
      console.error(`KIE lip-sync generation failed for segment ${segmentIndex}:`, error);
      return {
        videoUrl: '',
        dialogue,
        background,
        segmentIndex,
        status: 'failed',
        hasAudio: false,
      };
    }
  }

  /**
   * Create video task - same API as kie.service.ts
   */
  private async createVideoTask(
    imageUrl: string,
    prompt: string,
    mode: 'fun' | 'normal' | 'spicy' = 'normal'
  ): Promise<string> {
    const response = await this.client.post('/createTask', {
      model: 'grok-imagine/image-to-video',
      input: {
        image_urls: [imageUrl],
        prompt: prompt,
        mode: mode,
      },
    });

    if (response.data.code !== 200) {
      throw new Error(`KIE API error: ${response.data.msg}`);
    }

    return response.data.data.taskId;
  }

  /**
   * Poll for task completion - copied from kie.service.ts
   */
  private async pollTaskCompletion(
    taskId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.client.get(`/recordInfo?taskId=${taskId}`);

        if (response.data.code !== 200) {
          throw new Error(`KIE API error: ${response.data.msg}`);
        }

        const data = response.data.data;
        const state = data.state;

        if (state === 'success') {
          const resultJson = JSON.parse(data.resultJson);
          if (resultJson.resultUrls && resultJson.resultUrls.length > 0) {
            return resultJson.resultUrls[0];
          }
          throw new Error('No video URL in successful response');
        } else if (state === 'fail') {
          console.error(`KIE.AI lip-sync error:`, {
            failCode: data.failCode,
            failMsg: data.failMsg,
            taskId: taskId,
          });
          throw new Error(`Video generation failed: ${data.failMsg || 'Unknown error'}`);
        }

        // Still waiting
        if (attempt % 6 === 0) {
          console.log(`  ↳ Still generating lip-sync (attempt ${attempt + 1}/${maxAttempts})...`);
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw new Error('Lip-sync video generation timeout after 5 minutes');
  }

  /**
   * Download video - copied from kie.service.ts
   */
  private async downloadVideo(
    url: string,
    outputDir: string,
    filename: string
  ): Promise<string> {
    const outputPath = path.join(outputDir, filename);

    const response = await axios.get(url, {
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(outputPath));
      writer.on('error', reject);
    });
  }

  /**
   * Upload image to GCS - copied from kie.service.ts
   * Includes 4s propagation wait
   */
  private async uploadImageToGCS(imagePath: string): Promise<string> {
    try {
      const timestamp = Date.now();
      const originalName = path.basename(imagePath);
      const remoteFileName = `lipsync_${timestamp}_${originalName}`;

      const publicUrl = await this.gcsStorage.uploadImage(imagePath, remoteFileName);

      // Wait 4 seconds for GCS propagation (same as existing)
      console.log(`  ↳ Waiting 4s for GCS propagation...`);
      await new Promise(resolve => setTimeout(resolve, 4000));

      return publicUrl;
    } catch (error) {
      console.error('Image upload to GCS failed:', error);
      throw new Error(`Failed to upload image to GCS: ${error}`);
    }
  }
}
