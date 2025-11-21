import { Platform } from '../types';
import { addHours, addMinutes, setHours, setMinutes, nextDay, format, isBefore, isAfter } from 'date-fns';

export type ScheduleStrategy = 'optimal' | 'random' | 'manual' | 'smart' | 'immediate';

export interface ScheduleOptions {
  strategy: ScheduleStrategy;
  timezone?: string; // e.g., 'America/New_York', 'UTC'
  manualTime?: Date; // For manual strategy
  delayHours?: number; // For immediate strategy
  avoidWeekends?: boolean; // Skip weekends
  spreadPosts?: boolean; // Spread posts across different times
  minGapMinutes?: number; // Minimum gap between posts
}

export interface PlatformSchedule {
  platform: Platform;
  scheduledTime: Date;
  strategy: ScheduleStrategy;
  reasoning: string;
}

/**
 * Advanced scheduling service with multiple strategies
 * Based on 2024-2025 research from analyzing 2.7B social media engagements
 */
export class SchedulerService {
  private timezone: string;

  constructor(timezone: string = 'UTC') {
    this.timezone = timezone;
  }

  /**
   * Optimal posting times based on extensive research
   * Source: Analysis of 2.7B engagements across 463K profiles
   */
  private readonly OPTIMAL_TIMES = {
    youtube: {
      // Best: 2-4pm weekdays, 9-11am weekends
      weekday: [
        { start: 14, end: 16 }, // 2-4pm
        { start: 9, end: 11 },  // 9-11am
      ],
      weekend: [
        { start: 9, end: 11 },  // 9-11am
        { start: 14, end: 16 }, // 2-4pm
      ],
      bestDays: [0], // Sunday
      goodDays: [1, 2, 3, 4, 5], // Weekdays
    },
    tiktok: {
      // Best: Evening times, 10am-12pm on Tue/Thu
      weekday: [
        { start: 10, end: 12 }, // 10am-12pm
        { start: 18, end: 21 }, // 6-9pm (evening peak)
      ],
      weekend: [
        { start: 19, end: 21 }, // 7-9pm
      ],
      bestDays: [2, 4], // Tuesday, Thursday
      goodDays: [1, 2, 3, 4, 5], // Weekdays
    },
    instagram: {
      // Best: Mon-Thu 10am-3pm, 7-9am, 11pm-2am
      weekday: [
        { start: 7, end: 9 },   // 7-9am
        { start: 10, end: 15 }, // 10am-3pm
        { start: 23, end: 24 }, // 11pm-midnight
      ],
      weekend: [
        { start: 9, end: 11 },  // 9-11am
        { start: 19, end: 21 }, // 7-9pm
      ],
      bestDays: [1, 2, 3, 4], // Mon-Thu
      goodDays: [1, 2, 3, 4, 5], // Weekdays
    },
    facebook: {
      // Best: Wed/Thu 7-9am, 1-3pm, 7-9pm
      weekday: [
        { start: 7, end: 9 },   // 7-9am
        { start: 13, end: 15 }, // 1-3pm
        { start: 19, end: 21 }, // 7-9pm
      ],
      weekend: [
        { start: 9, end: 11 },  // 9-11am
        { start: 12, end: 14 }, // 12-2pm
      ],
      bestDays: [3, 4], // Wednesday, Thursday
      goodDays: [1, 2, 3, 4, 5], // Weekdays
    },
    twitter: {
      // Best: Wed/Thu 9-11am, 1pm
      weekday: [
        { start: 9, end: 11 },  // 9-11am
        { start: 13, end: 14 }, // 1pm
        { start: 15, end: 16 }, // 3pm
      ],
      weekend: [
        { start: 10, end: 12 }, // 10am-12pm
      ],
      bestDays: [3, 4], // Wednesday, Thursday
      goodDays: [1, 2, 3, 4, 5], // Weekdays
    },
    linkedin: {
      // Best: Tue 10am, Thu 10am-6pm
      weekday: [
        { start: 10, end: 12 }, // 10am-12pm
        { start: 13, end: 15 }, // 1-3pm
        { start: 17, end: 18 }, // 5-6pm
      ],
      weekend: [
        // LinkedIn is business-focused, weekends not optimal
        { start: 10, end: 11 }, // 10-11am
      ],
      bestDays: [2, 4], // Tuesday, Thursday
      goodDays: [1, 2, 3, 4, 5], // Weekdays
    },
  };

  /**
   * Schedules posts across multiple platforms using specified strategy
   */
  async schedulePosts(
    platforms: Platform[],
    options: ScheduleOptions
  ): Promise<PlatformSchedule[]> {
    const schedules: PlatformSchedule[] = [];
    let baseTime = new Date();

    switch (options.strategy) {
      case 'optimal':
        schedules.push(...this.scheduleOptimal(platforms, options));
        break;
      case 'random':
        schedules.push(...this.scheduleRandom(platforms, options));
        break;
      case 'manual':
        schedules.push(...this.scheduleManual(platforms, options));
        break;
      case 'smart':
        schedules.push(...this.scheduleSmart(platforms, options));
        break;
      case 'immediate':
        schedules.push(...this.scheduleImmediate(platforms, options));
        break;
    }

    // Sort by scheduled time
    schedules.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

    return schedules;
  }

  /**
   * OPTIMAL STRATEGY: Uses research-backed best times
   */
  private scheduleOptimal(
    platforms: Platform[],
    options: ScheduleOptions
  ): PlatformSchedule[] {
    const schedules: PlatformSchedule[] = [];
    const now = new Date();

    for (const platform of platforms) {
      const optimalTime = this.getOptimalTimeForPlatform(platform, options);

      schedules.push({
        platform,
        scheduledTime: optimalTime,
        strategy: 'optimal',
        reasoning: this.getOptimalReasoning(platform),
      });
    }

    // Spread posts if requested
    if (options.spreadPosts) {
      return this.spreadPostsAcrossDays(schedules, options);
    }

    return schedules;
  }

  /**
   * RANDOM STRATEGY: Random time within optimal windows
   */
  private scheduleRandom(
    platforms: Platform[],
    options: ScheduleOptions
  ): PlatformSchedule[] {
    const schedules: PlatformSchedule[] = [];
    const now = new Date();

    for (const platform of platforms) {
      const randomTime = this.getRandomOptimalTime(platform, options);

      schedules.push({
        platform,
        scheduledTime: randomTime,
        strategy: 'random',
        reasoning: `Random time within optimal windows for ${platform}`,
      });
    }

    return this.ensureMinimumGap(schedules, options.minGapMinutes || 15);
  }

  /**
   * MANUAL STRATEGY: User-specified time for all platforms
   */
  private scheduleManual(
    platforms: Platform[],
    options: ScheduleOptions
  ): PlatformSchedule[] {
    if (!options.manualTime) {
      throw new Error('Manual time must be specified for manual strategy');
    }

    const schedules: PlatformSchedule[] = [];
    let currentTime = new Date(options.manualTime);

    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];

      // Add gap between platforms if requested
      if (i > 0 && options.minGapMinutes) {
        currentTime = addMinutes(currentTime, options.minGapMinutes);
      }

      schedules.push({
        platform,
        scheduledTime: new Date(currentTime),
        strategy: 'manual',
        reasoning: 'User-specified time',
      });
    }

    return schedules;
  }

  /**
   * SMART STRATEGY: Combines optimal times with conflict avoidance
   */
  private scheduleSmart(
    platforms: Platform[],
    options: ScheduleOptions
  ): PlatformSchedule[] {
    const schedules: PlatformSchedule[] = [];
    const usedTimes = new Set<string>();

    for (const platform of platforms) {
      let optimalTime = this.getOptimalTimeForPlatform(platform, options);

      // Avoid scheduling conflicts (same hour)
      let attempts = 0;
      while (usedTimes.has(this.getTimeKey(optimalTime)) && attempts < 10) {
        optimalTime = addMinutes(optimalTime, 30);
        attempts++;
      }

      usedTimes.add(this.getTimeKey(optimalTime));

      schedules.push({
        platform,
        scheduledTime: optimalTime,
        strategy: 'smart',
        reasoning: `Optimal time with conflict avoidance for ${platform}`,
      });
    }

    return schedules;
  }

  /**
   * IMMEDIATE STRATEGY: Schedule ASAP with optional delay
   */
  private scheduleImmediate(
    platforms: Platform[],
    options: ScheduleOptions
  ): PlatformSchedule[] {
    const schedules: PlatformSchedule[] = [];
    let currentTime = addHours(new Date(), options.delayHours || 0);

    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];

      // Add small gap between platforms
      if (i > 0) {
        currentTime = addMinutes(currentTime, options.minGapMinutes || 5);
      }

      schedules.push({
        platform,
        scheduledTime: new Date(currentTime),
        strategy: 'immediate',
        reasoning: 'Immediate posting with minimal delay',
      });
    }

    return schedules;
  }

  /**
   * Gets optimal time for a specific platform
   */
  private getOptimalTimeForPlatform(
    platform: Platform,
    options: ScheduleOptions
  ): Date {
    const platformTimes = this.OPTIMAL_TIMES[platform];
    if (!platformTimes) {
      return this.getDefaultTime(options);
    }

    let targetDate = new Date();

    // Find next best day
    const currentDay = targetDate.getDay();
    if (platformTimes.bestDays.includes(currentDay)) {
      // Today is a best day
    } else if (platformTimes.goodDays.includes(currentDay)) {
      // Today is a good day
    } else if (options.avoidWeekends && (currentDay === 0 || currentDay === 6)) {
      // Skip to Monday
      targetDate = nextDay(targetDate, 1);
    } else {
      // Find next best day
      const nextBestDay = this.findNextBestDay(currentDay, platformTimes.bestDays);
      targetDate = nextDay(targetDate, nextBestDay);
    }

    // Get time windows for the day
    const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
    const timeWindows = isWeekend ? platformTimes.weekend : platformTimes.weekday;

    // Pick first optimal window
    const firstWindow = timeWindows[0];
    targetDate = setHours(targetDate, firstWindow.start);
    targetDate = setMinutes(targetDate, 0);

    // If time is in the past, move to next occurrence
    if (isBefore(targetDate, new Date())) {
      targetDate = addHours(targetDate, 24);
    }

    return targetDate;
  }

  /**
   * Gets random time within optimal windows
   */
  private getRandomOptimalTime(
    platform: Platform,
    options: ScheduleOptions
  ): Date {
    const platformTimes = this.OPTIMAL_TIMES[platform];
    if (!platformTimes) {
      return this.getRandomTime();
    }

    let targetDate = new Date();

    // Random day from best/good days
    const allGoodDays = [...platformTimes.bestDays, ...platformTimes.goodDays];
    const randomDay = allGoodDays[Math.floor(Math.random() * allGoodDays.length)];

    if (targetDate.getDay() !== randomDay) {
      targetDate = nextDay(targetDate, randomDay);
    }

    // Random time window
    const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
    const timeWindows = isWeekend ? platformTimes.weekend : platformTimes.weekday;
    const randomWindow = timeWindows[Math.floor(Math.random() * timeWindows.length)];

    // Random hour within window
    const randomHour = randomWindow.start + Math.floor(Math.random() * (randomWindow.end - randomWindow.start));
    const randomMinute = Math.floor(Math.random() * 60);

    targetDate = setHours(targetDate, randomHour);
    targetDate = setMinutes(targetDate, randomMinute);

    return targetDate;
  }

  /**
   * Spreads posts across multiple days
   */
  private spreadPostsAcrossDays(
    schedules: PlatformSchedule[],
    options: ScheduleOptions
  ): PlatformSchedule[] {
    const spread: PlatformSchedule[] = [];

    schedules.forEach((schedule, index) => {
      const daysToAdd = Math.floor(index / 2); // 2 posts per day max
      const newTime = addHours(schedule.scheduledTime, daysToAdd * 24);

      spread.push({
        ...schedule,
        scheduledTime: newTime,
        reasoning: `${schedule.reasoning} (spread across multiple days)`,
      });
    });

    return spread;
  }

  /**
   * Ensures minimum gap between posts
   */
  private ensureMinimumGap(
    schedules: PlatformSchedule[],
    minGapMinutes: number
  ): PlatformSchedule[] {
    const sorted = [...schedules].sort(
      (a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime()
    );

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].scheduledTime;
      const current = sorted[i].scheduledTime;

      const gapMinutes = (current.getTime() - prev.getTime()) / (1000 * 60);

      if (gapMinutes < minGapMinutes) {
        sorted[i].scheduledTime = addMinutes(prev, minGapMinutes);
      }
    }

    return sorted;
  }

  /**
   * Gets reasoning for optimal time
   */
  private getOptimalReasoning(platform: Platform): string {
    const reasons: Record<Platform, string> = {
      youtube: 'Best engagement 2-4pm weekdays, 9-11am weekends (Sundays optimal)',
      tiktok: 'Peak engagement evenings + 10am-12pm Tue/Thu',
      instagram: 'Best Mon-Thu 10am-3pm, with strong 7-9am window',
      facebook: 'Optimal Wed/Thu during meal times: 7-9am, 1-3pm, 7-9pm',
      twitter: 'Peak engagement Wed/Thu mornings 9-11am, lunch hour 1pm',
      linkedin: 'Best Tue/Thu business hours 10am-6pm (professional audience)',
    };

    return reasons[platform] || 'Based on engagement research';
  }

  /**
   * Finds next best day from current day
   */
  private findNextBestDay(currentDay: number, bestDays: number[]): number {
    for (const day of bestDays) {
      if (day > currentDay) {
        return day;
      }
    }
    return bestDays[0];
  }

  /**
   * Gets time key for conflict detection
   */
  private getTimeKey(date: Date): string {
    return format(date, 'yyyy-MM-dd-HH');
  }

  /**
   * Gets default time (8am Wednesday - overall best time)
   */
  private getDefaultTime(options: ScheduleOptions): Date {
    let date = new Date();

    // Move to next Wednesday
    while (date.getDay() !== 3) {
      date = addHours(date, 24);
    }

    date = setHours(date, 8);
    date = setMinutes(date, 0);

    return date;
  }

  /**
   * Gets completely random time
   */
  private getRandomTime(): Date {
    const date = new Date();
    const randomDays = Math.floor(Math.random() * 7);
    const randomHours = Math.floor(Math.random() * 24);
    const randomMinutes = Math.floor(Math.random() * 60);

    return addMinutes(addHours(date, randomDays * 24 + randomHours), randomMinutes);
  }

  /**
   * Formats schedule for display
   */
  formatSchedule(schedule: PlatformSchedule): string {
    const time = format(schedule.scheduledTime, 'EEEE, MMMM do, yyyy - h:mm a');
    return `${schedule.platform}: ${time} (${schedule.reasoning})`;
  }

  /**
   * Exports schedule to CSV
   */
  exportScheduleToCSV(schedules: PlatformSchedule[]): string {
    const header = 'Platform,Scheduled Time,Day,Hour,Strategy,Reasoning\n';
    const rows = schedules.map(s => {
      const day = format(s.scheduledTime, 'EEEE');
      const hour = format(s.scheduledTime, 'h:mm a');
      const fullTime = format(s.scheduledTime, 'yyyy-MM-dd HH:mm:ss');
      return `${s.platform},${fullTime},${day},${hour},${s.strategy},"${s.reasoning}"`;
    }).join('\n');

    return header + rows;
  }

  /**
   * Analyzes schedule distribution
   */
  analyzeSchedule(schedules: PlatformSchedule[]): {
    totalPosts: number;
    averageGap: number;
    dayDistribution: Map<string, number>;
    hourDistribution: Map<number, number>;
    platformCount: Map<Platform, number>;
  } {
    const dayDist = new Map<string, number>();
    const hourDist = new Map<number, number>();
    const platformCount = new Map<Platform, number>();
    let totalGap = 0;

    schedules.forEach((schedule, i) => {
      // Day distribution
      const day = format(schedule.scheduledTime, 'EEEE');
      dayDist.set(day, (dayDist.get(day) || 0) + 1);

      // Hour distribution
      const hour = schedule.scheduledTime.getHours();
      hourDist.set(hour, (hourDist.get(hour) || 0) + 1);

      // Platform count
      platformCount.set(schedule.platform, (platformCount.get(schedule.platform) || 0) + 1);

      // Calculate gap
      if (i > 0) {
        const gap = (schedule.scheduledTime.getTime() - schedules[i - 1].scheduledTime.getTime()) / (1000 * 60);
        totalGap += gap;
      }
    });

    return {
      totalPosts: schedules.length,
      averageGap: schedules.length > 1 ? totalGap / (schedules.length - 1) : 0,
      dayDistribution: dayDist,
      hourDistribution: hourDist,
      platformCount,
    };
  }
}
