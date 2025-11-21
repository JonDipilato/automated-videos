import * as fs from 'fs';
import axios from 'axios';
import { google } from 'googleapis';
import {
  Platform,
  PlatformMetadata,
  PublishResult,
  SchedulingConfig,
} from '../types';

export class SocialMediaService {
  private youtubeClient: any;
  private credentials: Map<Platform, any>;

  constructor() {
    this.credentials = new Map();
    this.loadCredentials();
  }

  /**
   * Publishes video to multiple platforms
   */
  async publishToMultiplePlatforms(
    videoPath: string,
    metadataList: PlatformMetadata[],
    schedulingConfig: SchedulingConfig
  ): Promise<PublishResult[]> {
    console.log('📤 Publishing to social media platforms...');

    const results: PublishResult[] = [];

    for (const metadata of metadataList) {
      try {
        let result: PublishResult;

        if (schedulingConfig.autoPublish) {
          result = await this.publishToPlatform(videoPath, metadata);
        } else {
          result = await this.scheduleToPlatform(
            videoPath,
            metadata,
            schedulingConfig.scheduleTime || new Date()
          );
        }

        results.push(result);
        console.log(`  ✓ ${metadata.platform}: ${result.success ? 'Success' : 'Failed'}`);
      } catch (error) {
        results.push({
          platform: metadata.platform,
          success: false,
          error: String(error),
        });
        console.error(`  ✗ ${metadata.platform}: ${error}`);
      }
    }

    return results;
  }

  /**
   * Publishes video to a single platform
   */
  private async publishToPlatform(
    videoPath: string,
    metadata: PlatformMetadata
  ): Promise<PublishResult> {
    switch (metadata.platform) {
      case 'youtube':
        return await this.publishToYouTube(videoPath, metadata);
      case 'tiktok':
        return await this.publishToTikTok(videoPath, metadata);
      case 'instagram':
        return await this.publishToInstagram(videoPath, metadata);
      case 'facebook':
        return await this.publishToFacebook(videoPath, metadata);
      case 'twitter':
        return await this.publishToTwitter(videoPath, metadata);
      case 'linkedin':
        return await this.publishToLinkedIn(videoPath, metadata);
      default:
        return {
          platform: metadata.platform,
          success: false,
          error: 'Unsupported platform',
        };
    }
  }

  /**
   * Schedules video for future publishing
   */
  private async scheduleToPlatform(
    videoPath: string,
    metadata: PlatformMetadata,
    scheduleTime: Date
  ): Promise<PublishResult> {
    // In production, use a job queue (Bull, Agenda, etc.)
    console.log(`  Scheduling ${metadata.platform} for ${scheduleTime.toISOString()}`);

    // For now, return scheduled status
    return {
      platform: metadata.platform,
      success: true,
      scheduledFor: scheduleTime,
    };
  }

  /**
   * Publishes to YouTube
   */
  private async publishToYouTube(
    videoPath: string,
    metadata: PlatformMetadata
  ): Promise<PublishResult> {
    try {
      const youtube = google.youtube('v3');
      const auth = this.getYouTubeAuth();

      // Upload video
      const response = await youtube.videos.insert({
        auth,
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags,
            categoryId: metadata.category || '22', // People & Blogs
          },
          status: {
            privacyStatus: metadata.visibility,
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(videoPath),
        },
      });

      const videoId = response.data.id;
      const url = `https://www.youtube.com/watch?v=${videoId}`;

      return {
        platform: 'youtube',
        success: true,
        url,
      };
    } catch (error) {
      return {
        platform: 'youtube',
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Publishes to TikTok
   */
  private async publishToTikTok(
    videoPath: string,
    metadata: PlatformMetadata
  ): Promise<PublishResult> {
    try {
      const accessToken = this.credentials.get('tiktok')?.accessToken;
      if (!accessToken) {
        throw new Error('TikTok access token not configured');
      }

      // Step 1: Initialize upload
      const initResponse = await axios.post(
        'https://open-api.tiktok.com/share/video/upload/',
        {
          video: {
            caption: `${metadata.title}\n\n${metadata.description}\n\n${metadata.hashtags.map(h => `#${h}`).join(' ')}`,
            privacy_level: metadata.visibility === 'public' ? 'PUBLIC_TO_EVERYONE' : 'SELF_ONLY',
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Step 2: Upload video file
      const uploadUrl = initResponse.data.data.upload_url;
      const videoBuffer = fs.readFileSync(videoPath);

      await axios.put(uploadUrl, videoBuffer, {
        headers: {
          'Content-Type': 'video/mp4',
        },
      });

      return {
        platform: 'tiktok',
        success: true,
        url: 'https://www.tiktok.com/@yourprofile', // TikTok doesn't return direct URL
      };
    } catch (error) {
      return {
        platform: 'tiktok',
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Publishes to Instagram (Reels)
   */
  private async publishToInstagram(
    videoPath: string,
    metadata: PlatformMetadata
  ): Promise<PublishResult> {
    try {
      const accessToken = this.credentials.get('instagram')?.accessToken;
      const businessAccountId = this.credentials.get('instagram')?.businessAccountId;

      if (!accessToken || !businessAccountId) {
        throw new Error('Instagram credentials not configured');
      }

      // Step 1: Create media container
      const containerResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${businessAccountId}/media`,
        {
          media_type: 'REELS',
          video_url: videoPath, // Must be publicly accessible URL
          caption: `${metadata.title}\n\n${metadata.description}\n\n${metadata.hashtags.map(h => `#${h}`).join(' ')}`,
          access_token: accessToken,
        }
      );

      const creationId = containerResponse.data.id;

      // Step 2: Publish media
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${businessAccountId}/media_publish`,
        {
          creation_id: creationId,
          access_token: accessToken,
        }
      );

      return {
        platform: 'instagram',
        success: true,
        url: `https://www.instagram.com/reel/${publishResponse.data.id}`,
      };
    } catch (error) {
      return {
        platform: 'instagram',
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Publishes to Facebook
   */
  private async publishToFacebook(
    videoPath: string,
    metadata: PlatformMetadata
  ): Promise<PublishResult> {
    try {
      const accessToken = this.credentials.get('facebook')?.accessToken;
      const pageId = this.credentials.get('facebook')?.pageId;

      if (!accessToken || !pageId) {
        throw new Error('Facebook credentials not configured');
      }

      // Upload video
      const videoBuffer = fs.readFileSync(videoPath);

      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${pageId}/videos`,
        {
          description: `${metadata.title}\n\n${metadata.description}\n\n${metadata.hashtags.map(h => `#${h}`).join(' ')}`,
          access_token: accessToken,
          file_url: videoPath, // Or upload as multipart
        }
      );

      return {
        platform: 'facebook',
        success: true,
        url: `https://www.facebook.com/${pageId}/videos/${response.data.id}`,
      };
    } catch (error) {
      return {
        platform: 'facebook',
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Publishes to Twitter (X)
   */
  private async publishToTwitter(
    videoPath: string,
    metadata: PlatformMetadata
  ): Promise<PublishResult> {
    try {
      const credentials = this.credentials.get('twitter');
      if (!credentials) {
        throw new Error('Twitter credentials not configured');
      }

      // Step 1: Upload media
      const mediaUploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
      const videoBuffer = fs.readFileSync(videoPath);
      const videoSize = fs.statSync(videoPath).size;

      // Initialize upload
      const initResponse = await axios.post(
        mediaUploadUrl,
        {
          command: 'INIT',
          total_bytes: videoSize,
          media_type: 'video/mp4',
          media_category: 'tweet_video',
        },
        {
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
          },
        }
      );

      const mediaId = initResponse.data.media_id_string;

      // Step 2: Create tweet with video
      const tweetText = `${metadata.title}\n\n${metadata.description}\n\n${metadata.hashtags.map(h => `#${h}`).join(' ')}`;

      const tweetResponse = await axios.post(
        'https://api.twitter.com/2/tweets',
        {
          text: tweetText.substring(0, 280), // Twitter character limit
          media: {
            media_ids: [mediaId],
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const tweetId = tweetResponse.data.data.id;

      return {
        platform: 'twitter',
        success: true,
        url: `https://twitter.com/i/status/${tweetId}`,
      };
    } catch (error) {
      return {
        platform: 'twitter',
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Publishes to LinkedIn
   */
  private async publishToLinkedIn(
    videoPath: string,
    metadata: PlatformMetadata
  ): Promise<PublishResult> {
    try {
      const accessToken = this.credentials.get('linkedin')?.accessToken;
      const organizationId = this.credentials.get('linkedin')?.organizationId;

      if (!accessToken || !organizationId) {
        throw new Error('LinkedIn credentials not configured');
      }

      // Step 1: Register upload
      const registerResponse = await axios.post(
        'https://api.linkedin.com/v2/assets?action=registerUpload',
        {
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
            owner: `urn:li:organization:${organizationId}`,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Step 2: Create post with video
      const postResponse = await axios.post(
        'https://api.linkedin.com/v2/ugcPosts',
        {
          author: `urn:li:organization:${organizationId}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: `${metadata.title}\n\n${metadata.description}\n\n${metadata.hashtags.map(h => `#${h}`).join(' ')}`,
              },
              shareMediaCategory: 'VIDEO',
              media: [
                {
                  status: 'READY',
                  media: registerResponse.data.value.asset,
                },
              ],
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': metadata.visibility.toUpperCase(),
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        platform: 'linkedin',
        success: true,
        url: 'https://www.linkedin.com/feed/', // LinkedIn doesn't return direct post URL
      };
    } catch (error) {
      return {
        platform: 'linkedin',
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Gets YouTube OAuth2 client
   */
  private getYouTubeAuth(): any {
    const credentials = this.credentials.get('youtube');
    if (!credentials) {
      throw new Error('YouTube credentials not configured');
    }

    const oauth2Client = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret,
      'http://localhost:3000/oauth2callback'
    );

    oauth2Client.setCredentials({
      refresh_token: credentials.refreshToken,
    });

    return oauth2Client;
  }

  /**
   * Loads credentials from environment variables
   */
  private loadCredentials(): void {
    // YouTube
    if (process.env.YOUTUBE_CLIENT_ID) {
      this.credentials.set('youtube', {
        clientId: process.env.YOUTUBE_CLIENT_ID,
        clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
        refreshToken: process.env.YOUTUBE_REFRESH_TOKEN,
      });
    }

    // Instagram
    if (process.env.INSTAGRAM_ACCESS_TOKEN) {
      this.credentials.set('instagram', {
        accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
        businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
      });
    }

    // TikTok
    if (process.env.TIKTOK_ACCESS_TOKEN) {
      this.credentials.set('tiktok', {
        accessToken: process.env.TIKTOK_ACCESS_TOKEN,
        clientKey: process.env.TIKTOK_CLIENT_KEY,
      });
    }

    // Facebook
    if (process.env.FACEBOOK_ACCESS_TOKEN) {
      this.credentials.set('facebook', {
        accessToken: process.env.FACEBOOK_ACCESS_TOKEN,
        pageId: process.env.FACEBOOK_PAGE_ID,
      });
    }

    // Twitter
    if (process.env.TWITTER_API_KEY) {
      this.credentials.set('twitter', {
        apiKey: process.env.TWITTER_API_KEY,
        apiSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
      });
    }

    // LinkedIn
    if (process.env.LINKEDIN_ACCESS_TOKEN) {
      this.credentials.set('linkedin', {
        accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
        organizationId: process.env.LINKEDIN_ORGANIZATION_ID,
      });
    }
  }

  /**
   * Validates platform credentials
   */
  async validateCredentials(platform: Platform): Promise<boolean> {
    const creds = this.credentials.get(platform);
    if (!creds) {
      console.error(`❌ ${platform} credentials not configured`);
      return false;
    }

    console.log(`✓ ${platform} credentials found`);
    return true;
  }

  /**
   * Gets list of configured platforms
   */
  getConfiguredPlatforms(): Platform[] {
    return Array.from(this.credentials.keys()) as Platform[];
  }
}
