import OpenAI from 'openai';
import {
  ScriptGeneration,
  GrokPrompt,
  PlatformMetadata,
  Platform,
} from '../types';

export class OpenAIService {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4-turbo-preview') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  /**
   * Generates a comprehensive script and story outline based on the topic
   */
  async generateScript(
    topic: string,
    targetDuration: number = 60
  ): Promise<ScriptGeneration> {
    const systemPrompt = `You are an expert scriptwriter for short-form video content.
Create engaging, hook-driven scripts optimized for social media platforms.
The script should be conversational, dynamic, and designed for AI voice narration.`;

    const userPrompt = `Create a compelling ${targetDuration}-second video script about: "${topic}"

Requirements:
1. Start with a strong hook (first 3 seconds)
2. Use conversational, engaging language
3. Include natural pauses for emphasis
4. Break into clear segments for visual changes
5. End with a strong call-to-action hint
6. Optimize for AI voice narration (clear pronunciation)

Provide:
1. Full script with timing markers
2. Story outline with key points
3. Tone description
4. Estimated duration per segment

Format as JSON with fields: script, storyOutline, keyPoints (array), tone, estimatedDuration`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content generated from OpenAI');
    }

    const result = JSON.parse(content);
    return {
      script: result.script,
      storyOutline: result.storyOutline,
      keyPoints: result.keyPoints,
      tone: result.tone,
      estimatedDuration: result.estimatedDuration,
    };
  }

  /**
   * Generates optimized Grok prompts for each video segment
   */
  async generateGrokPrompts(
    scriptGeneration: ScriptGeneration,
    segmentCount: number,
    seedPortraitDescription: string
  ): Promise<GrokPrompt[]> {
    const systemPrompt = `You are an expert at creating prompts for Grok's image and video generation AI.
Create highly detailed, visually descriptive prompts that produce cinematic, professional results.
Focus on lighting, composition, mood, and realistic details.`;

    const userPrompt = `Based on this script and story, create ${segmentCount} unique visual prompts for Grok Imagine.

Script: ${scriptGeneration.script}
Story Outline: ${scriptGeneration.storyOutline}
Tone: ${scriptGeneration.tone}

Portrait Description: ${seedPortraitDescription}

For EACH segment, provide:
1. videoPrompt: Detailed prompt for generating a 7-second video with the portrait as seed
   - Include specific actions, expressions, lighting, camera movement
   - Maintain consistency with the portrait
   - Match the script's mood and timing

2. backgroundPrompt: High-quality background image prompt
   - Cinematic, professional composition
   - Lighting that complements the scene
   - Depth and atmosphere
   - Should seamlessly blend with the portrait

3. transitionType: Choose from 'crossfade', 'morph', 'zoom', 'pan'
4. duration: 7 seconds per segment

Make each segment visually distinct but narratively cohesive.
Ensure smooth visual flow between segments.

Format as JSON array with fields: segmentIndex, videoPrompt, backgroundPrompt, transitionType, duration`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content generated from OpenAI');
    }

    const result = JSON.parse(content);
    return result.prompts || result.segments || [];
  }

  /**
   * Generates platform-optimized metadata for each social media platform
   */
  async generatePlatformMetadata(
    scriptGeneration: ScriptGeneration,
    platforms: Platform[]
  ): Promise<PlatformMetadata[]> {
    const systemPrompt = `You are an expert social media strategist and SEO specialist.
Create platform-optimized metadata that maximizes engagement, reach, and monetization potential.
Each platform has unique requirements and best practices.`;

    const userPrompt = `Create optimized metadata for these platforms: ${platforms.join(', ')}

Content:
Script: ${scriptGeneration.script}
Story: ${scriptGeneration.storyOutline}
Tone: ${scriptGeneration.tone}
Key Points: ${scriptGeneration.keyPoints.join(', ')}

Platform-specific requirements:
- YouTube: SEO-optimized title (60 chars), description (300+ words), 10-15 tags, timestamps
- TikTok: Hook-focused title, trending hashtags (5-10), viral potential
- Instagram: Engaging caption, strategic hashtags (15-20), emoji usage
- Facebook: Engagement-focused, longer description, community language
- Twitter: Concise (280 chars), hashtags (2-3), thread potential
- LinkedIn: Professional tone, value-focused, industry hashtags

Requirements for ALL:
1. Unique titles (no duplicates across platforms)
2. Unique descriptions (no copy-paste)
3. SEO-optimized for each platform's algorithm
4. Include relevant keywords naturally
5. Call-to-action appropriate for the platform
6. Monetization-safe (no duplicate content issues)

Format as JSON array with fields: platform, title, description, tags, hashtags, category, visibility`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content generated from OpenAI');
    }

    const result = JSON.parse(content);
    const metadataArray = result.metadata || result.platforms || [];

    return metadataArray.map((meta: any) => ({
      platform: meta.platform,
      title: meta.title,
      description: meta.description,
      tags: meta.tags || [],
      hashtags: meta.hashtags || [],
      category: meta.category,
      visibility: meta.visibility || 'public',
    }));
  }

  /**
   * Refines a Grok prompt if generation fails
   */
  async refineGrokPrompt(
    originalPrompt: string,
    failureReason: string
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at refining AI image/video generation prompts to avoid failures and improve results.',
        },
        {
          role: 'user',
          content: `The following Grok prompt failed: "${originalPrompt}"

Failure reason: ${failureReason}

Please refine this prompt to:
1. Avoid the failure reason
2. Be more specific and detailed
3. Include better composition guidance
4. Maintain the original intent

Return only the refined prompt text, no explanations.`,
        },
      ],
      temperature: 0.6,
    });

    return response.choices[0].message.content || originalPrompt;
  }

  /**
   * Generates a master prompt that orchestrates the entire video generation process
   */
  async generateMasterPrompt(
    topic: string,
    portraitDescription: string,
    targetDuration: number
  ): Promise<{
    scriptGeneration: ScriptGeneration;
    masterInstructions: string;
  }> {
    const scriptGeneration = await this.generateScript(topic, targetDuration);

    const masterInstructions = `
MASTER VIDEO GENERATION PLAN
============================

Topic: ${topic}
Target Duration: ${targetDuration} seconds
Tone: ${scriptGeneration.tone}

SCRIPT:
${scriptGeneration.script}

STORY OUTLINE:
${scriptGeneration.storyOutline}

KEY POINTS:
${scriptGeneration.keyPoints.map((point, idx) => `${idx + 1}. ${point}`).join('\n')}

VISUAL STRATEGY:
1. Use portrait as seed for consistency
2. Generate unique backgrounds for each segment
3. Maintain lighting and mood consistency
4. Ensure smooth transitions between scenes
5. Match visual pace with audio narration

AUDIO STRATEGY:
1. Generate full narration first
2. Calculate exact segment count needed
3. Ensure 7-second segments align with natural pauses
4. Sync visual changes with audio emphasis points

ASSEMBLY STRATEGY:
1. Crossfade transitions for smooth flow
2. Background replacement for intro/outro
3. CTA overlay at strategic points
4. Audio-video perfect sync

This master prompt ensures all AI services work in harmony to create a cohesive, engaging video.
`;

    return {
      scriptGeneration,
      masterInstructions,
    };
  }

  /**
   * Analyzes portrait image and generates a description for prompt context
   */
  async analyzePortrait(portraitPath: string): Promise<string> {
    // Note: This would use GPT-4 Vision API if the image is passed
    // For now, we'll create a placeholder that can be enhanced
    const systemPrompt = `You are an expert at describing portraits for AI image generation.
Provide detailed, technical descriptions focusing on:
- Facial features and expressions
- Lighting and shadows
- Composition and framing
- Clothing and styling
- Background elements
- Mood and atmosphere`;

    // In production, you would upload the image and use vision capabilities
    // For now, returning a template
    return `Professional portrait with natural lighting, centered composition, neutral expression,
modern styling. This description should be replaced with actual vision API analysis.`;
  }
}
