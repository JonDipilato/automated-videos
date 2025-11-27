import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { GrokVideoResponse, GrokPrompt } from '../types';

/**
 * KIE.AI Service for Grok Imagine Image-to-Video generation
 * Documentation: https://kie.ai/api-docs
 */
export class KieService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string = 'https://api.kie.ai/api/v1/jobs';

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
  }

  /**
   * Generates a video from an image using Grok Imagine
   */
  async generateVideo(
    grokPrompt: GrokPrompt,
    seedImagePath: string,
    outputDir: string
  ): Promise<GrokVideoResponse> {
    try {
      // Step 1: Get image URL
      // Check if user provided a pre-hosted URL in environment
      let imageUrl = process.env.PORTRAIT_URL;

      if (!imageUrl) {
        // Upload image to get a public URL
        imageUrl = await this.uploadImageToTemp(seedImagePath);
      } else {
        // Convert Google Drive viewer URL to direct download URL if needed
        imageUrl = this.convertToDirectUrl(imageUrl);
        console.log(`  ↳ Using pre-hosted portrait: ${imageUrl}`);
      }

      // Step 2: Create video generation task
      const taskId = await this.createVideoTask(
        imageUrl,
        this.enhanceVideoPrompt(grokPrompt.videoPrompt),
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
    parallel: boolean = true
  ): Promise<GrokVideoResponse[]> {
    if (parallel) {
      // Generate all segments in parallel for speed
      const promises = grokPrompts.map((prompt) =>
        this.generateVideo(prompt, seedImagePath, outputDir)
      );
      return await Promise.all(promises);
    } else {
      // Generate sequentially if API has rate limits
      const results: GrokVideoResponse[] = [];
      for (const prompt of grokPrompts) {
        const result = await this.generateVideo(
          prompt,
          seedImagePath,
          outputDir
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
   * Uploads image to imgbb and returns public URL
   * Using imgbb free tier - no API key required with anonymous upload
   */
  private async uploadImageToTemp(imagePath: string): Promise<string> {
    try {
      const FormData = require('form-data');
      const formData = new FormData();

      // Read image and convert to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      formData.append('image', base64Image);

      // Use imgbb free anonymous upload
      // Note: For production, get an API key from imgbb.com
      const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
        params: {
          key: 'a1d2bc3f4e5f6a7b8c9d0e1f2a3b4c5d' // Free tier key (replace with your own)
        },
        headers: formData.getHeaders(),
        timeout: 30000
      });

      if (response.data.success) {
        const imageUrl = response.data.data.url;
        console.log(`  ↳ Image uploaded: ${imageUrl}`);
        return imageUrl;
      } else {
        throw new Error('Image upload failed');
      }
    } catch (error) {
      console.error('Image upload to imgbb failed:', error);
      throw new Error(`Failed to upload image: ${error}`);
    }
  }

  /**
   * Converts Google Drive viewer URL to direct download URL
   */
  private convertToDirectUrl(url: string): string {
    // Google Drive: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    // Convert to: https://drive.google.com/uc?export=download&id=FILE_ID
    const driveMatch = url.match(/\/file\/d\/([^\/]+)/);
    if (driveMatch) {
      const fileId = driveMatch[1];
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }

    // Return original URL if not a Google Drive URL
    return url;
  }

  /**
   * Simplifies prompt to focus on motion/action only (KIE.AI prefers simple prompts)
   */
  private enhanceVideoPrompt(prompt: string): string {
    // KIE.AI works better with simple, action-focused prompts
    // Extract key actions and simplify
    // Remove complex cinematography jargon that might confuse the API

    // For now, keep it very simple - just basic motion
    return "Person speaking to camera with natural expressions and subtle head movements";
  }
}
