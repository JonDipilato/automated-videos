import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { GrokVideoResponse, GrokPrompt } from '../types';
import { GCSStorageService } from './gcs-storage.service';

/**
 * KIE.AI Service for Grok Imagine Image-to-Video generation
 * Documentation: https://kie.ai/api-docs
 */
export class KieService {
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

    // Initialize GCS storage for frame uploads
    this.gcsStorage = new GCSStorageService();
  }

  /**
   * Generates a video from an image using Grok Imagine
   * @param forceUpload - Force upload of the seed image even if PORTRAIT_URL is set (for transition frames)
   */
  async generateVideo(
    grokPrompt: GrokPrompt,
    seedImagePath: string,
    outputDir: string,
    forceUpload: boolean = false
  ): Promise<GrokVideoResponse> {
    try {
      // Step 1: Get image URL
      let imageUrl: string;

      // Priority order for image source:
      // 1. If seedImagePath is already a public URL (from web UI or GCS), use it directly
      // 2. If local file, upload to GCS first
      //
      // NO flattening needed - use portraits as-is
      // For subsequent segments, composited frames (last frame + portrait) are used

      if (seedImagePath.startsWith('http://') || seedImagePath.startsWith('https://')) {
        // Already a public URL - use directly
        imageUrl = seedImagePath;
        if (forceUpload) {
          console.log(`  ↳ Using composited frame from previous segment`);
        } else {
          console.log(`  ↳ Using portrait URL directly (first segment)`);
        }
      } else {
        // Local file - upload to GCS first
        console.log(`  ↳ Uploading local image to GCS...`);
        imageUrl = await this.uploadImageToTemp(seedImagePath);
      }

      // Step 2: Create video generation task
      const enhancedPrompt = this.enhanceVideoPrompt(grokPrompt.videoPrompt);

      console.log(`  ↳ Original prompt: ${grokPrompt.videoPrompt.substring(0, 100)}...`);
      console.log(`  ↳ Enhanced prompt: ${enhancedPrompt}`);

      const taskId = await this.createVideoTask(
        imageUrl,
        enhancedPrompt,
        'normal' // mode: fun, normal, or spicy
      );

      console.log(`  ↳ KIE task created: ${taskId}`);

      // Step 3: Poll for completion
      const videoUrl = await this.pollTaskCompletion(taskId);

      // Step 4: Download video
      const videoPath = await this.downloadVideo(
        videoUrl,
        outputDir,
        `segment_${grokPrompt.segmentIndex}.mp4`
      );

      return {
        videoUrl: videoPath,
        prompt: grokPrompt,
        duration: grokPrompt.duration,
        seedImage: seedImagePath,
        status: 'completed',
      };
    } catch (error) {
      console.error(`KIE video generation failed for segment ${grokPrompt.segmentIndex}:`, error);
      return {
        videoUrl: '',
        prompt: grokPrompt,
        duration: grokPrompt.duration,
        seedImage: seedImagePath,
        status: 'failed',
      };
    }
  }

  /**
   * Generates multiple video segments in parallel
   */
  async generateVideoSegments(
    grokPrompts: GrokPrompt[],
    seedImagePath: string,
    outputDir: string,
    parallel: boolean = true,
    forceUpload: boolean = false
  ): Promise<GrokVideoResponse[]> {
    if (parallel) {
      // Generate all segments in parallel for speed
      const promises = grokPrompts.map((prompt) =>
        this.generateVideo(prompt, seedImagePath, outputDir, forceUpload)
      );
      return await Promise.all(promises);
    } else {
      // Generate sequentially if API has rate limits
      const results: GrokVideoResponse[] = [];
      for (const prompt of grokPrompts) {
        const result = await this.generateVideo(
          prompt,
          seedImagePath,
          outputDir,
          forceUpload
        );
        results.push(result);
      }
      return results;
    }
  }

  /**
   * Creates a video generation task
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
   * Polls for task completion
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
          console.error(`KIE.AI error details:`, {
            failCode: data.failCode,
            failMsg: data.failMsg,
            taskId: taskId,
            fullResponse: JSON.stringify(data, null, 2)
          });
          throw new Error(`Video generation failed: ${data.failMsg || 'Unknown error'} (Code: ${data.failCode || 'N/A'})`);
        }

        // Still waiting, log progress
        if (attempt % 6 === 0) {
          // Log every 30 seconds
          console.log(`  ↳ Still generating (attempt ${attempt + 1}/${maxAttempts})...`);
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw new Error('Video generation timeout after 5 minutes');
  }

  /**
   * Downloads video from URL to local path
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
   * Uploads image to Google Cloud Storage and returns public URL
   */
  private async uploadImageToTemp(imagePath: string): Promise<string> {
    try {
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const originalName = path.basename(imagePath);
      const remoteFileName = `${timestamp}_${originalName}`;

      // Upload to GCS
      const publicUrl = await this.gcsStorage.uploadImage(imagePath, remoteFileName);

      // Wait 4 seconds for GCS propagation to all edge servers
      // This prevents KIE.AI from getting 500 errors when trying to fetch the image
      console.log(`  ↳ Waiting 4s for GCS propagation...`);
      await new Promise(resolve => setTimeout(resolve, 4000));

      return publicUrl;
    } catch (error) {
      console.error('Image upload to GCS failed:', error);
      throw new Error(`Failed to upload image to GCS: ${error}`);
    }
  }

  /**
   * Enhances prompt for KIE.AI while preserving dynamic details
   */
  private enhanceVideoPrompt(prompt: string): string {
    // KIE.AI works better with action-focused prompts
    // Keep dynamic movement but simplify overly technical jargon

    let enhanced = prompt
      // Keep dynamic camera movements but simplify terminology
      .replace(/cinematography/gi, '')
      .replace(/golden hour lighting/gi, 'warm lighting')
      .replace(/depth of field/gi, '')
      // Clean up redundant technical terms
      .replace(/\s+/g, ' ')
      .trim();

    // Don't over-truncate - keep all the dynamic details!
    // KIE.AI can handle 3-4 sentences if they're action-focused
    const sentences = enhanced.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Keep up to 4 sentences to preserve all the movement details
    if (sentences.length > 4) {
      enhanced = sentences.slice(0, 4).join('. ').trim() + '.';
    }

    // If still too long or empty, use a reasonable default
    if (!enhanced || enhanced.length < 10) {
      enhanced = "Person speaking with natural expressions and subtle movements";
    }

    // Add final period if missing
    if (!/[.!?]$/.test(enhanced)) {
      enhanced += '.';
    }

    return enhanced;
  }
}
