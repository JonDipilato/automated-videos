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
   * Estimates audio duration from text word count
   * ElevenLabs averages ~2.4 words/second at normal settings
   */
  estimateAudioDuration(text: string): number {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    // ElevenLabs at normal settings: ~2.4 words per second
    // Using 2.3 to be slightly conservative (better to overestimate duration)
    return wordCount / 2.3;
  }

  /**
   * Truncates script to fit within target duration
   * Uses sentence-boundary truncation for clean cutoffs
   */
  truncateToFitDuration(text: string, targetDuration: number, toleranceSeconds: number = 5): string {
    const maxDuration = targetDuration + toleranceSeconds;
    // Calculate max words: duration * 2.3 words/second
    const maxWords = Math.floor(maxDuration * 2.3);

    const currentWords = text.trim().split(/\s+/).length;
    if (currentWords <= maxWords) {
      return text;
    }

    console.log(`  ↳ 📏 Truncating script: ${currentWords} words → ${maxWords} words (target: ${targetDuration}s + ${toleranceSeconds}s tolerance)`);
    return this.truncateAtSentence(text, maxWords);
  }

  /**
   * Intelligently truncates text at sentence boundaries to prevent mid-sentence cutoffs
   */
  private truncateAtSentence(text: string, maxWords: number): string {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;

    // Try to find a sentence boundary within the limit
    // Look for periods, exclamation marks, question marks
    const withinLimit = words.slice(0, maxWords).join(' ');
    const sentenceEnders = /[.!?]\s*$/;

    // Work backwards from max to find last complete sentence
    for (let i = maxWords; i >= Math.floor(maxWords * 0.7); i--) {
      const candidate = words.slice(0, i).join(' ');
      if (sentenceEnders.test(candidate)) {
        console.log(`  ↳ Truncated at sentence boundary: ${i} words (target: ${maxWords})`);
        return candidate;
      }
    }

    // If no sentence boundary found in the acceptable range, add ellipsis
    const truncated = words.slice(0, maxWords).join(' ');
    // Check if last word already has punctuation
    if (!/[.!?]$/.test(truncated)) {
      console.log(`  ↳ No sentence boundary found, adding period: ${maxWords} words`);
      return truncated + '.';
    }

    return truncated;
  }

  /**
   * Generates a comprehensive script and story outline based on the topic
   */
  async generateScript(
    topic: string,
    targetDuration: number,
    segmentDuration: number = 7,
    niche?: string
  ): Promise<ScriptGeneration> {
    // Calculate target word count for TTS
    // Calibrated for 6-7s video segments: ~95 WPM target, 110 WPM max
    const targetMinutes = targetDuration / 60;
    const targetWordCount = Math.floor(targetMinutes * 95);  // 95 WPM (calibrated for 6.5s avg)
    const maxWordCount = Math.floor(targetMinutes * 110);    // Upper limit at 110 WPM

    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  📊 SCRIPT GENERATION DEBUG:`);
    console.log(`     Topic: "${topic}"`);
    console.log(`     Niche: ${niche || 'default'}`);
    console.log(`     Target duration: ${targetDuration}s`);
    console.log(`     Target words: ${targetWordCount} (at 95 WPM)`);
    console.log(`     Max words: ${maxWordCount} (at 110 WPM)`);
    console.log(`     Absolute max: ${Math.floor((targetDuration / 60) * 120)} words (120 WPM hard limit)`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Niche-specific content guidance
    let nicheGuidance = '';
    if (niche === 'epic-battles') {
      nicheGuidance = `
EPIC BATTLES NICHE:
- Describe intense, high-energy action sequences
- Emphasize explosive energy attacks, glowing auras, and lightning-fast movements
- Use dynamic language: "clash", "surge", "explosive", "devastating"
- Build tension with power escalation and dramatic showdowns
- Focus on visual spectacle: energy blasts, shockwaves, speed trails
- Keep the pace FAST and INTENSE throughout`;
    } else if (niche === 'custom') {
      nicheGuidance = `
CUSTOM NICHE:
- Analyze the topic and determine the most effective tone and style
- Adapt your approach to maximize engagement for this specific content
- Be creative and flexible - find the unique angle that makes this topic compelling
- Focus on what will resonate most with the target audience for this topic`;
    }

    const systemPrompt = `You are a senior YouTube Shorts script editor who writes tight, high-value narratives.
You specialize in creating powerful, inspiring content that resonates with modern audiences.
Your scripts are concrete, example-driven, and avoid corporate fluff.
The script should be conversational, dynamic, and designed for AI voice narration.
CRITICAL: You MUST strictly adhere to the word count limit provided and use CLEAN text formatting.`;

    const userPrompt = `Create a compelling ${targetDuration}-second video script about: "${topic}"

CONTENT APPROACH:
- Match the tone and theme to the specific topic provided
- Provide actionable, valuable insights relevant to the topic
- Use modern, relatable language and examples
- Focus on transformation and empowerment${nicheGuidance}

CRITICAL CONSTRAINT - WORD COUNT:
- Target: ${targetWordCount} words (STRICT LIMIT)
- Maximum: ${maxWordCount} words (DO NOT EXCEED)
- This ensures the script takes exactly ${targetDuration} seconds when spoken at natural pace

FORMATTING RULES (CRITICAL for ElevenLabs):
- Use ONLY plain text - NO asterisks, NO markdown, NO special characters
- NO bullet points, NO bold/italic markers, NO parentheses for emphasis
- NO stage directions like [pause] or (dramatic)
- Just clean, natural spoken sentences
- Use commas and periods for natural pauses
- Write EXACTLY how it should be spoken

STRUCTURE FOR SHORTS (keep it flowing, not choppy):
- Hook: 1 strong sentence that poses a problem or surprising fact
- Setup: 1 sentence of context that tees up the value
- Value: 3 sentences, each = one actionable move with a mini example (numbers, timeframe, or concrete “how”)
- Close: 1-2 sentences with a crisp takeaway + CTA
- Keep one clear throughline; no random topic jumps

SCRIPT REQUIREMENTS:
1. COMPLETE NARRATIVE ARC:
   - Hook (first 5-7s): Attention-grabbing problem or question
   - Value (middle 70%): Deliver 2-3 concrete, actionable insights
   - Conclusion (final 10s): Clear takeaway and call-to-action
   - CRITICAL: Ensure the story feels COMPLETE, not rushed or cut off

2. DELIVERY VALUE:
   - Provide specific, implementable advice viewers can use TODAY
   - No generic motivational fluff - give real strategies
   - Include at least 2-3 specific examples or tactics
   - Answer: "What can someone DO with this information?"
   - Include a quick “for example…” moment with a number, timebox, or tool name

3. PACING & ENGAGEMENT:
   - Use conversational, engaging language
   - Include natural pauses for emphasis (via punctuation only)
   - Break into clear segments for visual changes
   - Make every word count - no filler
   - Build tension and resolution naturally

4. FORMATTING (CRITICAL):
   - STAY WITHIN THE WORD COUNT LIMIT - this is the most important requirement
   - Use ONLY plain text for ElevenLabs compatibility
   - Write EXACTLY how it should be spoken

UNIQUENESS:
- Avoid generic content or clichés
- Provide specific, actionable insights
- Use unique angles on familiar topics
- No duplicate storylines or repetitive content

Provide:
1. Full script (CLEAN text only, within word count)
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
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content generated from OpenAI');
    }

    const result = JSON.parse(content);

    // CLEAN script formatting for ElevenLabs (remove asterisks, markdown, special chars)
    const cleanScriptFormatting = (text: string): string => {
      return text
        .replace(/\*\*/g, '')        // Remove bold markdown
        .replace(/\*/g, '')          // Remove asterisks
        .replace(/_/g, '')           // Remove underscores
        .replace(/\[.*?\]/g, '')     // Remove stage directions [like this]
        .replace(/\(.*?\)/g, '')     // Remove parenthetical notes (like this)
        .replace(/#{1,6}\s/g, '')    // Remove markdown headers
        .replace(/`/g, '')           // Remove backticks
        .replace(/~/g, '')           // Remove tildes
        .replace(/\s+/g, ' ')        // Normalize whitespace
        .trim();
    };

    // Extract text and count words
    const extractTextFromScript = (script: any): string => {
      if (typeof script === 'string') {
        try {
          const parsed = JSON.parse(script);
          return extractTextFromScript(parsed);
        } catch {
          return script;
        }
      } else if (Array.isArray(script)) {
        return script.map((item: any) => {
          if (typeof item === 'string') return item;
          return item.text || item.content || '';
        }).join(' ');
      } else if (typeof script === 'object' && script !== null) {
        if (script.text && typeof script.text === 'object') {
          return Object.values(script.text).filter(v => typeof v === 'string').join(' ');
        }
        return Object.values(script).filter(v => typeof v === 'string').join(' ');
      }
      return String(script);
    };

    // ENFORCE word count limit for accurate TTS duration
    let finalScript = result.script;

    // Preserve original script text for prompt generation (cleaned, before truncation)
    let originalScriptText = extractTextFromScript(result.script);
    originalScriptText = cleanScriptFormatting(originalScriptText);

    let scriptText = extractTextFromScript(finalScript);

    // Apply cleaning to remove any formatting issues
    scriptText = cleanScriptFormatting(scriptText);

    const words = scriptText.trim().split(/\s+/);
    const actualWordCount = words.length;

    console.log(`  ↳ Generated script: ${actualWordCount} words (target: ${targetWordCount}, max: ${maxWordCount})`);

    // ✅ USE FULL SCRIPT - No truncation!
    // We'll generate enough video segments to match the actual audio duration
    if (actualWordCount > maxWordCount) {
      console.log(`  ↳ ℹ️  Script is ${actualWordCount - maxWordCount} words over target (${maxWordCount})`);
      console.log(`  ↳ 📹 Will generate additional video segments to match full audio duration`);
    } else if (actualWordCount > targetWordCount) {
      console.log(`  ↳ ℹ️  Script is ${actualWordCount - targetWordCount} words over target (${targetWordCount})`);
      console.log(`  ↳ 📹 Will generate additional video segments to match full audio duration`);
    }

    // ✅ PRE-TTS VALIDATION: Estimate duration BEFORE spending ElevenLabs credits
    const estimatedDuration = this.estimateAudioDuration(scriptText);
    const maxAllowedDuration = targetDuration + 5; // 5 second tolerance (reduced from 10s)

    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  📊 PRE-TTS DURATION ESTIMATE:`);
    console.log(`     Estimated audio: ${estimatedDuration.toFixed(1)}s`);
    console.log(`     Target duration: ${targetDuration}s`);
    console.log(`     Max allowed: ${maxAllowedDuration}s (5s tolerance)`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Reasonable max now 1.15x target (was 3x - way too loose!)
    const reasonableMaxWords = Math.floor(maxAllowedDuration * 2.3); // words at 2.3 words/sec

    if (estimatedDuration > maxAllowedDuration) {
      console.warn(`  ↳ ⚠️  Estimated duration (${estimatedDuration.toFixed(1)}s) exceeds limit (${maxAllowedDuration}s)`);
      console.warn(`  ↳ 📏 Truncating script to fit duration BEFORE TTS to save credits`);
      finalScript = this.truncateToFitDuration(scriptText, targetDuration, 5);
      const newEstimate = this.estimateAudioDuration(finalScript);
      console.log(`  ↳ ✅ Truncated: new estimate ${newEstimate.toFixed(1)}s`);
    } else if (actualWordCount > reasonableMaxWords) {
      console.warn(`  ↳ ⚠️  Script is long (${actualWordCount} words, max: ${reasonableMaxWords})`);
      console.warn(`  ↳ Truncating at sentence boundary`);
      finalScript = this.truncateAtSentence(scriptText, reasonableMaxWords);
    } else {
      // Use the full script - no truncation
      finalScript = scriptText;
      console.log(`  ↳ ✅ Using full ${actualWordCount}-word script (est. ${estimatedDuration.toFixed(1)}s)`)
    }

    return {
      script: finalScript,
      originalScript: originalScriptText, // Preserve full cleaned script text for prompt generation
      storyOutline: result.storyOutline,
      keyPoints: result.keyPoints,
      tone: result.tone,
      estimatedDuration: targetDuration, // Use actual target, not AI's estimate
    };
  }

  /**
   * Generates optimized Grok prompts for each video segment with perfect continuity
   */
  async generateGrokPrompts(
    scriptGeneration: ScriptGeneration,
    segmentCount: number,
    seedPortraitDescription: string,
    segmentDuration: number = 7,
    niche?: string
  ): Promise<GrokPrompt[]> {
    // ⚠️ Special case: For single-segment videos, create a simple prompt
    if (segmentCount <= 1) {
      return [{
        segmentIndex: 0,
        videoPrompt: `Keep original motion and lip movement. Leave speaker unchanged. Modify background only. Background: Professional studio with soft lighting, suitable for ${scriptGeneration.tone} content. ${scriptGeneration.keyPoints.join(', ')}. Cinematic 4K quality.`,
        backgroundPrompt: `Professional studio setup with soft lighting and depth, suitable for ${scriptGeneration.tone} content`,
        transitionType: 'crossfade' as const,
        duration: segmentDuration,
        continuityNote: 'Single-segment video - maintains consistent framing throughout'
      }];
    }

    // Niche-specific visual style requirements
    let nicheVisualStyle = '';
    if (niche === 'epic-battles') {
      nicheVisualStyle = `

⚔️ EPIC BATTLES VISUAL STYLE (CRITICAL - APPLY TO ALL PROMPTS):
- BATTLE ENVIRONMENTS: Ancient battlefields, volcanic arenas, shattered floating islands, storm-ravaged wastelands, cosmic void battlegrounds, ruined temples with mystical energy
- COMBAT LIGHTING: Explosive flashes, crackling lightning, fiery glows, pulsing power auras, clashing energy beams, dramatic backlighting from explosions
- POWER EFFECTS: Glowing auras surrounding fighters, energy charging sequences, shockwave ripples, speed lines, afterimage trails, elemental manifestations (fire, lightning, ice, dark energy)
- DYNAMIC COMBAT POSES: Mid-strike freeze frames, power-up stances, defensive blocks with energy shields, aerial combat poses, dramatic landing impacts
- CAMERA WORK FOR ACTION: Whip pans following attacks, impact zoom on strikes, orbiting during power-ups, ground-level shots looking up at towering figures, slow-motion during climactic moments
- COLOR PALETTE: Intense oranges/reds for fire attacks, electric blues for energy, deep purples for dark power, golden yellow for ultimate forms, contrasting warm vs cool for opposing forces
- VISUAL INTENSITY: Screen-filling energy blasts, ground-shattering impacts, atmospheric debris and particles, dramatic lens flares from power sources, dust and smoke from destruction
- EMOTIONAL ENERGY: Raw power, unstoppable force, legendary warrior spirit, climactic showdown tension, overwhelming intensity`;
    }

    let systemPrompt = `You are an elite cinematographer and visual storytelling expert for Grok's video generation AI.
Create VISUALLY STUNNING, FUTURISTIC, and CINEMATIC prompts that produce BREATHTAKING, EPIC results with PERFECT CONTINUITY.
Focus on FUTURISTIC TECH, AI AESTHETICS, NEON COLORS, and EXCITING scene transitions that captivate viewers.
CRITICAL: Every scene must flow naturally with NO teleporting or logic breaks.

🎬 FUTURISTIC VISUAL EXCELLENCE REQUIREMENTS:
- FUTURISTIC LIGHTING: Vibrant neon glows (cyan, magenta, purple), holographic effects, LED rim lighting, volumetric laser beams, electric blue accents
- TECH/AI AESTHETICS: Holographic interfaces, floating data visualizations, neural network patterns, circuit board textures, digital particles
- DYNAMIC CAMERA WORK: Low angles for power, dutch angles for energy, dramatic zooms, sweeping movements through tech environments
- FUTURISTIC ENVIRONMENTS: High-tech command centers, holographic displays, neon-lit cityscapes, AI server rooms with glowing racks, floating platforms, glass towers with LED patterns
- VISUAL EFFECTS: Glowing particles, data streams, holographic projections, electric arcs, matrix-style code rain, aurora effects
- CINEMATIC STYLE: Cyberpunk color grading (teal/magenta, purple/orange), high contrast neon vs darkness, lens flares from tech lights
- EMOTIONAL IMPACT: Powerful poses amidst futuristic tech, confident expressions with holographic reflections, commanding presence in high-tech spaces${nicheVisualStyle}

🎤 LIP SYNC VIDEO FORMAT (CRITICAL):
All prompts MUST use this exact format to preserve lip sync and speaker motion:
- Start with: "Keep original motion and lip movement. Leave speaker unchanged. Modify background only."
- Then describe ONLY the background/environment changes
- The speaker's face, expressions, and lip movements are automatically synced with audio
- Focus on BACKGROUND transformations while keeping the speaker intact`;

    // Use original full script for prompt generation (not truncated version)
    const scriptForPrompts = scriptGeneration.originalScript || scriptGeneration.script;
    console.log(`\n📝 Generating prompts from script:`);
    console.log(`   Script length: ${scriptForPrompts.split(/\s+/).length} words`);
    console.log(`   Using: ${scriptGeneration.originalScript ? 'originalScript (full)' : 'script (truncated)'}`);
    console.log(`   Segments: ${segmentCount}`);
    console.log(`   Niche: ${niche || 'default'}`);

    // Niche-specific user prompt additions
    let nicheUserPromptAddition = '';
    if (niche === 'epic-battles') {
      nicheUserPromptAddition = `

⚔️ EPIC BATTLES SPECIFIC REQUIREMENTS:
- Every scene must feature INTENSE ACTION and POWER
- Include glowing energy auras, explosive effects, and dramatic combat poses
- Use battle-appropriate environments: arenas, battlefields, cosmic voids, volcanic landscapes
- Camera should emphasize IMPACT: ground-level shots, dramatic angles, speed-focused movements
- Color palette: fiery oranges, electric blues, deep purples, golden power-ups
- Each segment should escalate in intensity toward a climactic moment

EPIC BATTLES CONTINUITY PATTERN:
Segment 1: Warrior standing in destroyed battlefield, power aura flickering to life, camera slowly rising
Segment 2: Energy gathering around warrior, debris floating upward, lightning crackling in background
Segment 3: Explosive power-up sequence, ground shattering, camera orbiting rapidly around glowing figure
Segment 4: Mid-combat pose, energy blast firing, shockwave rippling outward, slow-motion debris
Segment 5: Aerial combat moment, afterimage trails, clashing energy beams lighting up the scene
Segment 6: Landing impact creating crater, dust explosion, camera at ground level looking up
Segment 7: Victory pose with full power aura, defeated enemies in background, epic backlighting
Segment 8: Close-up of warrior's face, determined expression, power fading to calm, camera slowly pulling back

EXAMPLE EPIC BATTLES VIDEO PROMPT:
"Keep original motion and lip movement. Leave speaker unchanged. Modify background only. Background: EXPLOSIVE volcanic battlefield with crackling golden energy auras, ground shattering into floating debris. Lightning strikes illuminate the arena while afterimage trails show incredible speed. Fiery oranges and electric blues clash in massive explosions. Slow-motion particles and embers swirl through the air. Camera dramatically reveals the scale of destruction with epic backlighting from volcanic eruptions. Cinematic 4K quality with intense battle atmosphere."`;
    }

    const userPrompt = `Based on this script and story, create ${segmentCount} unique visual prompts for Grok Imagine with PERFECT CONTINUITY.

Script: ${scriptForPrompts}
Story Outline: ${scriptGeneration.storyOutline}
Tone: ${scriptGeneration.tone}

Portrait Description: ${seedPortraitDescription}

CRITICAL CONTINUITY RULES:
1. Every scene must logically flow to the next (NO TELEPORTING)
2. Always return to portrait/face between major scene changes
3. Physical movement must make sense (walking, driving, entering, sitting, etc.)
4. Scene transitions must be natural and motivated

CONTINUITY PATTERN EXAMPLE:
Segment 1: Close-up of speaker's face (portrait) delivering hook
Segment 2: Wide shot of speaker standing on cliff edge, wind in hair
Segment 3: Camera follows speaker walking down path from cliff
Segment 4: Speaker approaching car in parking lot
Segment 5: Interior shot of speaker driving, looking determined
Segment 6: Speaker parking car, getting out
Segment 7: Speaker entering workspace/office
Segment 8: Close-up of speaker's face as they sit down, concluding thought

KEY: Each scene MUST connect to the previous one. No sudden location jumps without showing the transition.

🎤 MANDATORY: LIP SYNC VIDEO FORMAT
Every video prompt MUST use this exact format to enable automatic lip sync:
- FIRST LINE MUST BE: "Keep original motion and lip movement. Leave speaker unchanged. Modify background only."
- Then describe ONLY the background/environment - the speaker is automatically preserved with lip sync
- Focus on BACKGROUND changes: lighting, environment, effects, atmosphere
- The AI will automatically sync the speaker's lips to the audio

For EACH segment, provide:
1. videoPrompt: EXPLOSIVE, DYNAMIC, FUTURISTIC cinematic prompt for ${segmentDuration} seconds of THRILLING footage
   - FIRST LINE MUST BE: "Keep original motion and lip movement. Leave speaker unchanged. Modify background only."
   - Then describe the BACKGROUND in 3-4 sentences: environment, lighting, effects, atmosphere
   - MANDATORY MOTION: Every background MUST have constant movement - camera motion, environmental motion, lighting effects
   - CAMERA MOVEMENTS (use multiple): Smooth push-ins, pull-outs, orbiting circles, rising cranes, gliding sliders, whip pans, dramatic reveals
   - SPEED & PACING: Fast cuts between angles, quick dynamic movements, energetic transitions, never static
   - FUTURISTIC LIGHTING: Vibrant neon glows (cyan, magenta, purple, electric blue), holographic light effects, LED rim lighting, volumetric laser beams, matrix-style data streams
   - TECH ENVIRONMENTS: Futuristic command centers with holographic displays, AI server rooms with glowing racks, neon-lit cyberpunk cityscapes, floating platforms, glass towers with pulsing LED patterns, neural network visualizations
   - VISUAL EFFECTS: Floating holographic interfaces, glowing data particles, electric arcs, aurora-like energy waves, digital rain, circuit patterns, pulsing light trails
   - BACKGROUND EFFECTS: Floating holographic interfaces, glowing data particles, electric arcs, aurora-like energy waves, digital rain, circuit patterns
   - ATMOSPHERE: Powerful, futuristic, inspiring, tech-forward, commanding presence, next-level confidence
   - COLOR GRADING: Vibrant cyberpunk palette (teal/magenta, purple/orange, electric blue/hot pink), high contrast neon vs deep shadows, cinematic sci-fi aesthetic
   - CONTINUITY: Background MUST connect logically to previous scene with natural spatial progression
   - Example: "Keep original motion and lip movement. Leave speaker unchanged. Modify background only. Background: Futuristic AI command center with floating holographic displays showing neural network visualizations. Camera rapidly orbits as neon cyan and magenta lights pulse rhythmically. Volumetric laser beams cut through atmospheric haze while glowing data particles swirl. Massive curved display wall shows real-time AI processing visuals. Electric blue rim lighting against purple-tinged darkness. Holographic interfaces materialize with cyberpunk color grading and bokeh from hundreds of tiny LED indicators. Cinematic 4K quality."

2. backgroundPrompt: High-quality background image prompt
   - Cinematic, professional composition
   - MUST connect to previous location or show transition space
   - Lighting that complements the scene
   - Depth and atmosphere
   - Should seamlessly blend with the portrait

3. transitionType: Choose from 'crossfade', 'morph', 'zoom', 'pan'
   - Use 'crossfade' for gentle scene changes
   - Use 'pan' for spatial movement
   - Use 'zoom' for emphasis shifts

4. duration: ${segmentDuration} seconds per segment

5. continuityNote: Brief description of how this segment connects to the next

Make each segment visually distinct but perfectly connected.
Ensure ZERO logic breaks or teleporting between scenes.
Always return to close-up of face at strategic moments (beginning, middle, end).
${nicheUserPromptAddition}
Format as JSON array with fields: segmentIndex, videoPrompt, backgroundPrompt, transitionType, duration, continuityNote`;

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

    // ⚠️ DEBUG: Log what OpenAI actually returns
    console.log(`  📊 OpenAI response keys: ${Object.keys(result).join(', ')}`);

    // Try multiple possible keys for the prompts array
    let prompts = result.prompts || result.segments || result.scenes || [];

    // If none of those worked, check if any value is an array
    if (!Array.isArray(prompts) || prompts.length === 0) {
      const arrayValues = Object.values(result).filter(v => Array.isArray(v));
      if (arrayValues.length > 0) {
        prompts = arrayValues[0] as any[];
        console.log(`  ↳ Found prompts in alternate key`);
      }
    }

    console.log(`  ↳ Extracted ${prompts.length} prompts`);

    // ⚠️ CRITICAL: Trim to exact segment count (OpenAI often generates more than requested)
    if (prompts.length > segmentCount) {
      console.warn(`  ⚠️  OpenAI generated ${prompts.length} prompts but only ${segmentCount} needed. Trimming...`);
      return prompts.slice(0, segmentCount);
    }

    return prompts;
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
   * Generates raw text response from a prompt (no JSON formatting)
   * Used for simple text generation tasks like script scenes
   */
  async generateRaw(prompt: string, maxTokens: number = 2000): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content generated from OpenAI');
    }

    return content;
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
