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
   * Each segment uses the last frame of the previous segment (with portrait composited) as its seed
   *
   * Flow:
   * 1. Segment 1: Use original portrait → KIE.AI generates video
   * 2. Extract last frame from segment 1 video
   * 3. Composite original transparent portrait OVER the extracted frame
   * 4. Upload composited frame to GCS
   * 5. Segment 2: Use composited frame as seed → KIE.AI generates video
   * 6. Repeat for all segments
   *
   * This creates visual continuity: same character, evolving backgrounds
   */
  async generateVideoSegmentsWithFrameChaining(
    grokPrompts: GrokPrompt[],
    initialSeedImagePath: string,
    outputDir: string,
    extractAndCompositeFrame: (videoPath: string, outputPath: string) => Promise<string>
  ): Promise<GrokVideoResponse[]> {
    const results: GrokVideoResponse[] = [];
    let currentSeedPath = initialSeedImagePath;

    console.log('');
    console.log('🔗 FRAME CHAINING ENABLED');
    console.log('   Each segment\'s last frame becomes the next segment\'s seed');
    console.log(`   Initial seed: ${initialSeedImagePath}`);
    console.log('');

    // Create images directory for transition frames
    const imagesDir = path.resolve(outputDir, '../images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log(`   Created transition frames directory: ${imagesDir}`);
    }

    for (let i = 0; i < grokPrompts.length; i++) {
      const prompt = grokPrompts[i];
      const isFirstSegment = i === 0;
      const isLastSegment = i === grokPrompts.length - 1;

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📹 SEGMENT ${i + 1}/${grokPrompts.length}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`   Seed image: ${currentSeedPath.substring(0, 80)}${currentSeedPath.length > 80 ? '...' : ''}`);
      console.log(`   Prompt: ${prompt.videoPrompt.substring(0, 100)}...`);
      if (prompt.continuityNote) {
        console.log(`   Continuity: ${prompt.continuityNote}`);
      }

      // Generate video segment using current seed
      // forceUpload=true for segments after the first (they use composited frames)
      const result = await this.generateVideo(
        prompt,
        currentSeedPath,
        outputDir,
        !isFirstSegment  // forceUpload for all segments after first
      );
      results.push(result);

      if (result.status !== 'completed') {
        console.error(`   ❌ Segment ${i + 1} failed to generate`);
        continue;
      }

      console.log(`   ✓ Segment ${i + 1} video generated: ${result.videoUrl}`);

      // If not the last segment, prepare the seed for the next segment
      if (!isLastSegment) {
        console.log('');
        console.log(`   🔄 FRAME CHAINING: Preparing seed for segment ${i + 2}...`);

        try {
          const compositedFramePath = path.resolve(
            imagesDir,
            `transition_composite_${i}.jpg`
          );

          // Step 1: Extract last frame from video AND composite portrait over it
          console.log(`   Step 1: Extracting last frame from video...`);
          console.log(`           Video: ${result.videoUrl}`);
          console.log(`           Output: ${compositedFramePath}`);

          await extractAndCompositeFrame(result.videoUrl, compositedFramePath);

          // Step 2: Verify the composited frame was created
          if (!fs.existsSync(compositedFramePath)) {
            throw new Error(`Composited frame was not created at ${compositedFramePath}`);
          }

          const stats = fs.statSync(compositedFramePath);
          if (stats.size < 1000) {
            throw new Error(`Composited frame is too small (${stats.size} bytes) - likely corrupted`);
          }

          console.log(`   Step 2: Composited frame created (${(stats.size / 1024).toFixed(1)}KB)`);

          // Step 3: Upload to GCS
          console.log(`   Step 3: Uploading composited frame to GCS...`);
          const { GCSStorageService } = await import('./gcs-storage.service');
          const gcsStorage = new GCSStorageService();
          const timestamp = Date.now();
          const remoteFileName = `composited_${timestamp}_segment_${i}.jpg`;

          const gcsUrl = await gcsStorage.uploadImage(compositedFramePath, remoteFileName);

          // Step 4: Wait for GCS propagation
          console.log(`   Step 4: Waiting 4s for GCS propagation...`);
          await new Promise(resolve => setTimeout(resolve, 4000));

          // Step 5: Update seed for next segment
          const previousSeed = currentSeedPath;
          currentSeedPath = gcsUrl;

          console.log(`   ✅ FRAME CHAIN COMPLETE`);
          console.log(`      Previous seed: ${previousSeed.substring(0, 60)}...`);
          console.log(`      New seed (GCS): ${gcsUrl}`);
          console.log(`      Segment ${i + 2} will use this composited frame`);

        } catch (error: any) {
          console.error(`   ❌ FRAME CHAINING FAILED: ${error.message}`);
          console.error(`   Full error:`, error);
          console.warn(`   ⚠️  Segment ${i + 2} will use the ORIGINAL portrait (no continuity)`);
          // Reset to initial seed if compositing fails - at least the video will generate
          currentSeedPath = initialSeedImagePath;
        }
      }
    }

    console.log('');
    console.log('=' .repeat(60));
    console.log('✓ Frame-chained generation complete!');
    console.log(`   Total segments: ${results.length}`);
    console.log(`   Successful: ${results.filter(r => r.status === 'completed').length}`);
    console.log('=' .repeat(60));

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
