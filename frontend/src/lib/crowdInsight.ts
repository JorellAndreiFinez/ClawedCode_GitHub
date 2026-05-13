export type CrowdTrend = "surge" | "normal" | "low";

type CrowdInsightInput = {
  currentCount: number;
  serviceTime?: number;
  capacity?: number;
  now?: Date;
};

type UsualRange = {
  hour: number;
  low: number;
  high: number;
  label: string;
};

const HOURLY_DEMAND = [
  0.08, 0.05, 0.04, 0.04, 0.05, 0.08, 0.18, 0.35, 0.58, 0.72, 0.62, 0.52,
  0.34, 0.24, 0.28, 0.38, 0.56, 0.78, 0.88, 0.74, 0.52, 0.32, 0.2, 0.12,
];

const PERIOD_LABELS = [
  "overnight lull",
  "overnight lull",
  "overnight lull",
  "overnight lull",
  "early lull",
  "early lull",
  "morning pickup",
  "morning rush",
  "busy period",
  "busy period",
  "busy period",
  "midday easing",
  "lunch dip",
  "low period",
  "low period",
  "afternoon pickup",
  "after-work rush",
  "peak period",
  "peak period",
  "busy period",
  "evening easing",
  "evening lull",
  "late lull",
  "late lull",
];

function getUsualRange(hour: number, capacity = 50): UsualRange {
  const safeCapacity = Math.max(capacity, 1);
  const midpoint = Math.max(1, Math.round(safeCapacity * HOURLY_DEMAND[hour]));
  const spread = Math.max(3, Math.round(midpoint * 0.14));

  return {
    hour,
    low: Math.max(0, midpoint - spread),
    high: Math.max(1, midpoint + spread),
    label: PERIOD_LABELS[hour],
  };
}

function formatTime(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:00 ${suffix}`;
}

function getTrend(currentCount: number, usual: UsualRange): CrowdTrend {
  if (currentCount > usual.high) return "surge";
  if (currentCount < usual.low) return "low";
  return "normal";
}

function getTrendCopy(trend: CrowdTrend) {
  if (trend === "surge") {
    return {
      label: "Busier than usual",
      tone: "text-red-700 bg-red-50 border-red-200",
      text: "text-red-700",
      message: "Higher than normal for this time. Consider going later.",
    };
  }

  if (trend === "low") {
    return {
      label: "Quieter than usual",
      tone: "text-green-700 bg-green-50 border-green-200",
      text: "text-green-700",
      message: "Better than usual right now.",
    };
  }

  return {
    label: "Usual for this time",
    tone: "text-gray-700 bg-gray-50 border-gray-200",
    text: "text-gray-700",
    message: "Within the expected range for this time.",
  };
}

export function getCrowdInsight({
  currentCount,
  serviceTime = 3,
  capacity = 50,
  now = new Date(),
}: CrowdInsightInput) {
  const hour = now.getHours();
  const usual = getUsualRange(hour, capacity);
  const trend = getTrend(currentCount, usual);
  const trendCopy = getTrendCopy(trend);

  const remainingHours = Array.from({ length: 24 - hour }, (_, index) => hour + index);
  const bestRange = remainingHours
    .map((candidateHour) => getUsualRange(candidateHour, capacity))
    .sort((a, b) => a.low - b.low || a.high - b.high)[0];

  const bestCount = Math.round((bestRange.low + bestRange.high) / 2);
  const safeServiceTime = Math.max(serviceTime, 1);

  return {
    trend,
    label: trendCopy.label,
    message: trendCopy.message,
    tone: trendCopy.tone,
    text: trendCopy.text,
    currentWait: currentCount * safeServiceTime,
    usualLow: usual.low,
    usualHigh: usual.high,
    usualLabel: usual.label,
    bestTime: formatTime(bestRange.hour),
    bestCount,
    bestWait: bestCount * safeServiceTime,
  };
}
