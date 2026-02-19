import { useState, useEffect } from 'react';

/**
 * Time period ranges (24-hour format):
 * - Morning:    05:00 - 11:59
 * - Afternoon:  12:00 - 16:59
 * - Evening:    17:00 - 20:59
 * - Night:      21:00 - 04:59
 */
const PERIODS = [
  { id: 'night', greeting: 'Good night', start: 21, end: 4 },
  { id: 'morning', greeting: 'Good morning', start: 5, end: 11 },
  { id: 'afternoon', greeting: 'Good afternoon', start: 12, end: 16 },
  { id: 'evening', greeting: 'Good evening', start: 17, end: 20 },
];

function getPeriodForHour(hour) {
  for (const period of PERIODS) {
    if (period.start <= period.end) {
      if (hour >= period.start && hour <= period.end) return period;
    } else {
      if (hour >= period.start || hour <= period.end) return period;
    }
  }
  return PERIODS[1];
}

/**
 * Hook that returns dynamic greeting and time-of-day data based on current time.
 * Updates once per minute so the greeting can change (e.g. afternoon -> evening).
 *
 * @returns {{ greeting: string, period: string, hour: number, timeLabel: string }}
 */
export function useTime() {
  const [data, setData] = useState(() => {
    const now = new Date();
    const hour = now.getHours();
    const period = getPeriodForHour(hour);
    return {
      greeting: period.greeting,
      period: period.id,
      hour,
      timeLabel: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hour = now.getHours();
      const period = getPeriodForHour(hour);
      setData({
        greeting: period.greeting,
        period: period.id,
        hour,
        timeLabel: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    };

    update();
    const interval = setInterval(update, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return data;
}

export default useTime;
