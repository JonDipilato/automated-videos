import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import { GrokImageResponse, GrokVideoResponse, GrokPrompt } from '../types';
import { KieService } from './kie.service';

export class GrokService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;
  private videoModel: string;
  private imageModel: string;
  private kieService: KieService;

  constructor(
    apiKey: string,
    baseUrl: string = 'https://api.x.ai/v1',
    videoModel: string = 'grok-video-beta',
    imageModel: string = 'grok-vision-beta'
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.videoModel = videoModel;
    this.imageModel = imageModel;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minutes
    });

    // Initialize KIE service for video generation
    const kieApiKey = process.env.KIE_API_KEY || '';
    this.kieService = new KieService(kieApiKey);
  }

  /**
   * Generates a high-quality background image using OpenAI DALL-E 3
   */
  async generateBackground(
    prompt: string,
    width: number = 1920,
    height: number = 1080
  ): Promise<GrokImageResponse> {
    try {
      // Use OpenAI DALL-E 3 for image generation
      // Note: DALL-E 3 supports specific sizes: 1024x1024, 1792x1024, or 1024x1792
      const size = width > height ? '1792x1024' : (width < height ? '1024x1792' : '1024x1024');

      const response = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
          model: 'dall-e-3',
          prompt: this.enhanceBackgroundPrompt(prompt),
          n: 1,
          size: size,
          quality: 'hd',
          style: 'natural',
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
        }
      );

      const imageData = response.data.data[0];

      return {
        imageUrl: imageData.url,
        prompt: prompt,
        seed: undefined,
        dimensions: { width: parseInt(size.split('x')[0]), height: parseInt(size.split('x')[1]) },
      };
    } catch (error) {
      console.error('OpenAI DALL-E background generation failed:', error);
      throw new Error(`Failed to generate background: ${error}`);
    }
  }

  /**
   * Generates a 7-second video using KIE.AI (Grok Imagine image-to-video)
   */
  async generateVideo(
    grokPrompt: GrokPrompt,
    seedImagePath: string,
    outputDir: string,
    forceUpload: boolean = false
  ): Promise<GrokVideoResponse> {
    // Use KIE.AI service for actual video generation
    return await this.kieService.generateVideo(grokPrompt, seedImagePath, outputDir, forceUpload);
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
   * Generates video segments with frame chaining for perfect continuity
   * Each segment uses the last frame of the previous segment as its seed
   */
  async generateVideoSegmentsWithFrameChaining(
    grokPrompts: GrokPrompt[],
    initialSeedImagePath: string,
    outputDir: string,
    ffmpegExtractLastFrame: (videoPath: string, outputPath: string) => Promise<string>
  ): Promise<GrokVideoResponse[]> {
    const results: GrokVideoResponse[] = [];
    let currentSeedPath = initialSeedImagePath;

    console.log('🔗 Generating segments with frame chaining for perfect continuity...');

    for (let i = 0; i < grokPrompts.length; i++) {
      const prompt = grokPrompts[i];

      console.log(`\n📹 Segment ${i + 1}/${grokPrompts.length}:`);
      console.log(`   Using seed: ${path.basename(currentSeedPath)}`);
      if (prompt.continuityNote) {
        console.log(`   Continuity: ${prompt.continuityNote}`);
      }

      // For first segment: use pre-hosted URL if available
      // For subsequent segments: force upload of extracted transition frames
      const forceUpload = i > 0;

      // Generate video segment using current seed
      const result = await this.generateVideo(
        prompt,
        currentSeedPath,
        outputDir,
        forceUpload
      );
      results.push(result);

      // If successful and not the last segment, extract last frame for next segment
      if (result.status === 'completed' && i < grokPrompts.length - 1) {
        try {
          const lastFramePath = path.join(
            outputDir,
            `../images/transition_frame_${i}.png`
          );

          // Extract last frame from this video to use as seed for next
          await ffmpegExtractLastFrame(result.videoUrl, lastFramePath);

          // Update seed for next iteration
          currentSeedPath = lastFramePath;

          console.log(`   ✓ Frame chained to next segment`);
        } catch (error) {
          console.warn(`   ⚠️  Frame extraction failed, using original seed for next segment`);
          // Continue with original seed if extraction fails
        }
      }
    }

    console.log('\n✓ Frame-chained generation complete!');
    return results;
  }

  /**
   * Generates background images for all segments
   */
  async generateBackgrounds(
    grokPrompts: GrokPrompt[],
    outputDir: string
  ): Promise<Map<number, string>> {
    const backgrounds = new Map<number, string>();

    for (const prompt of grokPrompts) {
      try {
        const bgResponse = await this.generateBackground(
          prompt.backgroundPrompt
        );

        // Download background image
        const bgPath = path.join(
          outputDir,
          `background_${prompt.segmentIndex}.png`
        );
        await this.downloadImage(bgResponse.imageUrl, bgPath);

        backgrounds.set(prompt.segmentIndex, bgPath);

        console.log(
          `✓ Generated background ${prompt.segmentIndex + 1}/${grokPrompts.length}`
        );
      } catch (error) {
        console.error(
          `Failed to generate background ${prompt.segmentIndex}:`,
          error
        );
      }
    }

    return backgrounds;
  }

  /**
   * Uploads seed image to Grok and returns image ID
   */
  private async uploadSeedImage(imagePath: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(imagePath));
    formData.append('purpose', 'seed_image');

    const response = await axios.post(`${this.baseUrl}/files`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    return response.data.id;
  }

  /**
   * Polls for video generation completion
   */
  private async pollVideoCompletion(
    videoId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.client.get(`/videos/${videoId}`);
        const status = response.data.status;

        if (status === 'completed') {
          return response.data.url;
        } else if (status === 'failed') {
          throw new Error('Video generation failed');
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw new Error('Video generation timeout');
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
   * Downloads image from URL to local path
   */
  private async downloadImage(url: string, outputPath: string): Promise<void> {
    const response = await axios.get(url, {
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve());
      writer.on('error', reject);
    });
  }

  /**
   * Enhances background prompt with professional cinematography details
   */
  private enhanceBackgroundPrompt(prompt: string): string {
    return `${prompt}.
Professional cinematography, high-quality production, cinematic lighting,
depth of field, photorealistic, 8K resolution, color graded,
atmospheric perspective, balanced composition, studio quality.`;
  }

  /**
   * Enhances video prompt with motion and quality details
   */
  private enhanceVideoPrompt(prompt: string): string {
    return `${prompt}.
Smooth natural motion, professional cinematography, stable camera work,
cinematic lighting, high quality production, photorealistic rendering,
color graded, 60fps fluid motion, consistent lighting throughout,
professional video quality, social media optimized.`;
  }

  /**
   * Replaces portrait background with generated background
   */
  async replacePortraitBackground(
    portraitPath: string,
    backgroundPath: string,
    outputPath: string
  ): Promise<string> {
    // This would use image processing (Sharp, Canvas, or external service)
    // to composite the portrait onto the new background
    // For now, this is a placeholder for the implementation

    console.log(
      `Replacing background: ${portraitPath} + ${backgroundPath} -> ${outputPath}`
    );

    // In production, implement with Sharp for background removal/replacement
    // For now, copy the portrait as placeholder
    fs.copyFileSync(portraitPath, outputPath);

    return outputPath;
  }

  /**
   * Creates transition frames between two backgrounds for smooth morphing
   */
  async createTransitionFrames(
    background1: string,
    background2: string,
    frameCount: number,
    outputDir: string
  ): Promise<string[]> {
    const frames: string[] = [];

    // This would generate interpolated frames between two backgrounds
    // Using techniques like optical flow or AI-based interpolation

    console.log(
      `Creating ${frameCount} transition frames between backgrounds`
    );

    // Placeholder implementation
    for (let i = 0; i < frameCount; i++) {
      const framePath = path.join(outputDir, `transition_frame_${i}.png`);
      // In production, generate actual interpolated frames
      frames.push(framePath);
    }

    return frames;
  }
}
