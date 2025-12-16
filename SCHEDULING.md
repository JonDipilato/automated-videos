# 📅 Advanced Scheduling System

The automated video generation system includes a sophisticated scheduling engine with **5 different strategies** based on extensive social media research.

---

## 🔬 Research-Backed Posting Times

Our scheduling is based on analyzing **2.7 billion social media engagements** across **463,000 profiles** (2024-2025 data).

### Platform-Specific Optimal Times

| Platform | Best Days | Best Times | Peak Engagement |
|----------|-----------|------------|-----------------|
| **YouTube** | Sunday | 2-4pm (weekdays)<br>9-11am (weekends) | Weekend mornings |
| **TikTok** | Tuesday, Thursday | 10am-12pm<br>6-9pm (evening) | Evening hours |
| **Instagram** | Mon-Thu | 7-9am, 10am-3pm<br>11pm-2am | Mid-week, business hours |
| **Facebook** | Wednesday, Thursday | 7-9am, 1-3pm<br>7-9pm | Meal times |
| **Twitter/X** | Wednesday, Thursday | 9-11am<br>1pm | Morning, lunch hour |
| **LinkedIn** | Tuesday, Thursday | 10am-12pm<br>1-3pm, 5-6pm | Business hours |

### Overall Best Time
**8 AM on Wednesdays** - Highest average engagement across all platforms

---

## 🎯 Scheduling Strategies

### 1. **Optimal Strategy** (Recommended)
Uses research-backed best times for maximum engagement.

```env
SCHEDULE_STRATEGY=optimal
```

**How it works:**
- Selects the best day of week for each platform
- Chooses optimal time windows based on engagement data
- Automatically avoids poor performing times
- Prioritizes platform-specific best practices

**Example Output:**
```
YouTube: Sunday, January 28th, 2025 - 2:00 PM
TikTok: Tuesday, January 23rd, 2025 - 6:30 PM
Instagram: Wednesday, January 24th, 2025 - 10:15 AM
```

---

### 2. **Random Strategy**
Randomizes within optimal windows to avoid predictable patterns.

```env
SCHEDULE_STRATEGY=random
```

**How it works:**
- Picks random day from best/good days for each platform
- Chooses random time within optimal windows
- Maintains minimum gaps between posts
- Useful for appearing more "organic"

**Benefits:**
- Looks less automated
- Tests different time slots
- Avoids algorithm pattern detection

---

### 3. **Manual Strategy**
You specify exact posting time for all platforms.

```env
SCHEDULE_STRATEGY=manual
SCHEDULE_MANUAL_TIME=2025-01-25T14:00:00Z
```

**How it works:**
- All platforms scheduled at (or near) specified time
- Respects minimum gap settings between platforms
- Full control over posting schedule

**Use cases:**
- Time-sensitive content
- Coordinated campaigns
- Special events

---

### 4. **Smart Strategy**
Optimal times with automatic conflict avoidance.

```env
SCHEDULE_STRATEGY=smart
```

**How it works:**
- Uses optimal times as base
- Automatically adjusts if multiple platforms want same time slot
- Prevents scheduling conflicts
- Maintains engagement optimization

**Example:**
```
If YouTube and Instagram both want 2:00 PM:
- YouTube: 2:00 PM (kept)
- Instagram: 2:30 PM (adjusted)
```

---

### 5. **Immediate Strategy**
Post ASAP with optional delay.

```env
SCHEDULE_STRATEGY=immediate
SCHEDULE_DELAY_HOURS=2
```

**How it works:**
- Schedules for immediate (or near-immediate) posting
- Optional delay in hours
- Small gaps between platforms to avoid spam detection

**Use cases:**
- Breaking news
- Urgent announcements
- Testing content

---

## ⚙️ Advanced Configuration Options

### Timezone Support
```env
SCHEDULE_TIMEZONE=America/New_York
```

Supported timezones:
- `UTC` (default)
- `America/New_York` (EST/EDT)
- `America/Los_Angeles` (PST/PDT)
- `America/Chicago` (CST/CDT)
- `Europe/London` (GMT/BST)
- `Europe/Paris` (CET/CEST)
- `Asia/Tokyo` (JST)
- `Australia/Sydney` (AEDT/AEST)

### Avoid Weekends
```env
SCHEDULE_AVOID_WEEKENDS=true
```

Skips Saturday and Sunday posting (useful for B2B content).

### Spread Posts Across Days
```env
SCHEDULE_SPREAD_POSTS=true
```

Distributes posts across multiple days instead of posting all at once.

**Example:**
```
Without spreading:
- All 6 platforms: Wednesday, Jan 24th

With spreading:
- YouTube, TikTok: Wednesday, Jan 24th
- Instagram, Facebook: Thursday, Jan 25th
- Twitter, LinkedIn: Friday, Jan 26th
```

### Minimum Gap Between Posts
```env
SCHEDULE_MIN_GAP_MINUTES=15
```

Ensures minimum time between posts to avoid spam detection.

---

## 📊 Usage Examples

### Example 1: Maximum Engagement (Default)
```bash
SCHEDULE_STRATEGY=optimal
SCHEDULE_TIMEZONE=America/New_York
SCHEDULE_AVOID_WEEKENDS=false
SCHEDULE_SPREAD_POSTS=false
```

**Result:** Each platform posted at its optimal time for maximum engagement.

---

### Example 2: Organic-Looking Schedule
```bash
SCHEDULE_STRATEGY=random
SCHEDULE_TIMEZONE=UTC
SCHEDULE_AVOID_WEEKENDS=false
SCHEDULE_SPREAD_POSTS=true
SCHEDULE_MIN_GAP_MINUTES=30
```

**Result:** Posts spread across days with randomized times, looks more natural.

---

### Example 3: Business-Focused
```bash
SCHEDULE_STRATEGY=optimal
SCHEDULE_TIMEZONE=America/Chicago
SCHEDULE_AVOID_WEEKENDS=true
SCHEDULE_SPREAD_POSTS=true
```

**Result:** Only weekday posting, spread across optimal business days.

---

### Example 4: Product Launch
```bash
SCHEDULE_STRATEGY=manual
SCHEDULE_MANUAL_TIME=2025-01-25T09:00:00Z
SCHEDULE_MIN_GAP_MINUTES=5
```

**Result:** All platforms post at 9 AM on launch day with 5-minute gaps.

---

### Example 5: Testing Content
```bash
SCHEDULE_STRATEGY=immediate
SCHEDULE_DELAY_HOURS=0
SCHEDULE_MIN_GAP_MINUTES=10
```

**Result:** Posts immediately with 10-minute gaps between platforms.

---

## 🎛️ Command Line Override

You can override environment settings via command line:

```bash
npm start generate -- \
  --portrait=./assets/portraits/me.jpg \
  --topic="AI Tips" \
  --platforms=youtube,tiktok,instagram \
  --schedule-strategy=optimal \
  --timezone=America/Los_Angeles
```

---

## 📈 Schedule Analysis

The system provides detailed schedule analysis:

```javascript
{
  totalPosts: 6,
  averageGap: 45.5, // minutes
  dayDistribution: {
    'Tuesday': 2,
    'Wednesday': 2,
    'Thursday': 2
  },
  hourDistribution: {
    10: 2, // 10 AM
    14: 2, // 2 PM
    19: 2  // 7 PM
  },
  platformCount: {
    'youtube': 1,
    'tiktok': 1,
    'instagram': 1,
    'facebook': 1,
    'twitter': 1,
    'linkedin': 1
  }
}
```

---

## 🔄 Rescheduling

If you need to reschedule after generation:

```bash
npm start reschedule -- \
  --video-id=<job-id> \
  --strategy=optimal \
  --spread=true
```

*(Feature to be implemented)*

---

## 📤 Export Schedule

Export schedule to CSV for external calendar tools:

```bash
npm start export-schedule -- \
  --video-id=<job-id> \
  --format=csv
```

**CSV Output:**
```csv
Platform,Scheduled Time,Day,Hour,Strategy,Reasoning
youtube,2025-01-28 14:00:00,Sunday,2:00 PM,optimal,"Best engagement 2-4pm weekdays, 9-11am weekends (Sundays optimal)"
tiktok,2025-01-23 18:30:00,Tuesday,6:30 PM,optimal,"Peak engagement evenings + 10am-12pm Tue/Thu"
...
```

---

## 🎓 Best Practices

### 1. **Know Your Audience**
While our data is research-backed, YOUR specific audience might behave differently:
- Monitor your analytics
- Track which times work best for YOU
- Adjust strategy based on results

### 2. **Content Type Matters**
- **Educational**: Optimal strategy, business hours
- **Entertainment**: Random/Smart strategy, evenings
- **News/Updates**: Immediate strategy
- **Evergreen**: Optimal + spread posts

### 3. **Platform Priority**
Focus on platforms where your audience is most active:
```bash
# If YouTube is priority, post there first
--platforms=youtube,instagram,tiktok
```

### 4. **Consistency**
- Use `optimal` or `smart` for regular content
- Post at similar times to build audience expectations
- Use `random` occasionally to test new time slots

### 5. **Avoid Spam Detection**
- Always set `SCHEDULE_MIN_GAP_MINUTES` (15-30 minutes recommended)
- Don't post identical content simultaneously
- Spread posts across days for larger volumes

---

## 📊 A/B Testing

Test different strategies to find what works best:

**Week 1: Optimal Strategy**
```env
SCHEDULE_STRATEGY=optimal
```

**Week 2: Random Strategy**
```env
SCHEDULE_STRATEGY=random
```

**Week 3: Smart Strategy**
```env
SCHEDULE_STRATEGY=smart
SCHEDULE_SPREAD_POSTS=true
```

Compare engagement metrics to determine winner.

---

## 🚨 Common Issues

### Issue: Posts scheduled in the past
**Solution:** Check timezone setting matches your location

### Issue: All posts at same time
**Solution:** Set `SCHEDULE_MIN_GAP_MINUTES` higher

### Issue: Scheduling conflicts
**Solution:** Use `smart` strategy for automatic conflict resolution

### Issue: Poor engagement
**Solution:** Use `optimal` strategy and check your audience analytics

---

## 🔮 Future Enhancements

Planned features:
- [ ] Machine learning based on YOUR engagement data
- [ ] Auto-adjust based on historical performance
- [ ] Integration with analytics APIs
- [ ] Multi-timezone audience optimization
- [ ] Seasonal adjustments (holidays, events)
- [ ] A/B test scheduling built-in

---

## 📚 Research Sources

Our scheduling is based on:
- Sprout Social's 2024-2025 engagement study (2.7B posts)
- Buffer's optimal posting times research
- Hootsuite's social media trends report
- Platform-specific engagement patterns
- Cross-platform analysis from 463K profiles

**Data updated:** January 2025

---

## 💡 Pro Tips

1. **Wednesday is King**: When in doubt, schedule for Wednesday morning
2. **Evening for TikTok**: TikTok engagement peaks in evenings
3. **Business Hours for LinkedIn**: B2B content performs best 10am-6pm
4. **Weekend YouTube**: Sundays work great for YouTube
5. **Avoid Monday Mornings**: Generally lower engagement across platforms
6. **Test, Test, Test**: Data is general - find YOUR optimal times

---

## 🎯 Quick Reference

| Goal | Strategy | Settings |
|------|----------|----------|
| Maximum Engagement | `optimal` | `SPREAD_POSTS=false` |
| Organic Look | `random` | `SPREAD_POSTS=true` |
| Coordinated Launch | `manual` | Set specific time |
| Avoid Conflicts | `smart` | `MIN_GAP_MINUTES=30` |
| ASAP Posting | `immediate` | `DELAY_HOURS=0` |
| Business Content | `optimal` | `AVOID_WEEKENDS=true` |
| Testing | `random` | Vary settings weekly |

---

**Remember:** These are guidelines, not rules. Your specific audience behavior should always take priority. Use the scheduler as a starting point, then optimize based on YOUR analytics!
