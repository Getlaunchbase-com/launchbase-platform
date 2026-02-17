/**
 * Weather Intelligence Service
 *
 * Fetches weather data and generates business-context-aware intelligence.
 * Uses Open-Meteo (free, no API key) as the weather data source.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeatherCondition {
  temperature: number;
  humidity: number;
  description: string;
  windSpeed: number;
  icon: string;
}

// ---------------------------------------------------------------------------
// getWeatherIntelligence
// ---------------------------------------------------------------------------

export async function getWeatherIntelligence(input: {
  latitude: number;
  longitude: number;
  businessType?: string;
  businessName?: string;
}): Promise<{
  temperature: number;
  conditions: string;
  recommendation: string;
  forecast: any[];
  current?: WeatherCondition;
  businessInsights?: string[];
  postingSuggestions?: string[];
  postType?: string;
  location?: { latitude: number; longitude: number };
  queriedAt?: string;
  safetyGate?: boolean;
  urgency?: string;
}> {
  const { latitude, longitude, businessType, businessName } = input;

  let current: WeatherCondition = {
    temperature: 72,
    humidity: 45,
    description: "Partly cloudy",
    windSpeed: 8,
    icon: "partly-cloudy",
  };

  let forecast: any[] = [];

  // Attempt to fetch real weather data from Open-Meteo
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=5`;

    const response = await fetch(url);

    if (response.ok) {
      const data = (await response.json()) as any;
      const cur = data.current || {};

      current = {
        temperature: cur.temperature_2m ?? 72,
        humidity: cur.relative_humidity_2m ?? 45,
        description: weatherCodeToCondition(cur.weathercode ?? 0),
        windSpeed: cur.windspeed_10m ?? 8,
        icon: weatherCodeToIcon(cur.weathercode ?? 0),
      };

      const daily = data.daily || {};
      const dates = daily.time || [];
      const maxTemps = daily.temperature_2m_max || [];
      const minTemps = daily.temperature_2m_min || [];
      const codes = daily.weathercode || [];

      forecast = dates.map((date: string, i: number) => ({
        date,
        high: maxTemps[i],
        low: minTemps[i],
        conditions: weatherCodeToCondition(codes[i] ?? 0),
        description: weatherCodeToCondition(codes[i] ?? 0),
        icon: weatherCodeToIcon(codes[i] ?? 0),
      }));
    }
  } catch (err) {
    console.error("[weather-intelligence] API fetch error, using defaults:", err);
  }

  // Generate business-specific insights
  const businessInsights: string[] = [];
  const postingSuggestions: string[] = [];

  if (businessType) {
    const type = businessType.toLowerCase();

    if (type.includes("restaurant") || type.includes("food")) {
      if (current.temperature > 80) {
        businessInsights.push("Hot weather: consider promoting cold beverages and light meals");
        postingSuggestions.push("Beat the heat with our refreshing summer menu!");
      } else if (current.temperature < 50) {
        businessInsights.push("Cold weather: highlight warm comfort foods and hot drinks");
        postingSuggestions.push("Warm up with our hearty winter specials!");
      }
    }

    if (type.includes("trades") || type.includes("contractor") || type.includes("roofing") || type.includes("hvac")) {
      if (current.windSpeed > 25 || current.description.toLowerCase().includes("storm")) {
        businessInsights.push("Storm conditions: emergency service demand likely to increase");
        postingSuggestions.push(`Storm alert! ${businessName || "We"} are ready for emergency service calls.`);
      } else if (current.description.toLowerCase().includes("clear") || current.description.toLowerCase().includes("sunny")) {
        businessInsights.push("Clear weather: great conditions for outdoor projects");
        postingSuggestions.push(`Beautiful weather for outdoor projects! Schedule your free estimate with ${businessName || "us"} today.`);
      }
    }

    if (type.includes("fitness") || type.includes("gym")) {
      if (current.temperature >= 60 && current.temperature <= 80) {
        businessInsights.push("Perfect outdoor workout weather; promote outdoor classes");
        postingSuggestions.push("Perfect weather for our outdoor boot camp! Join us today.");
      }
    }

    if (type.includes("retail") || type.includes("shop")) {
      if (current.description.toLowerCase().includes("rain")) {
        businessInsights.push("Rainy weather may reduce foot traffic; boost online promotions");
        postingSuggestions.push("Shop from the comfort of home -- free shipping today!");
      } else if (current.description.toLowerCase().includes("clear") || current.description.toLowerCase().includes("sunny")) {
        businessInsights.push("Good weather increases foot traffic; staff accordingly");
        postingSuggestions.push("Beautiful day to stop by and check out our latest arrivals!");
      }
    }
  }

  if (businessInsights.length === 0) {
    businessInsights.push(
      `Current conditions at (${latitude.toFixed(2)}, ${longitude.toFixed(2)}): ${current.description}, ${current.temperature}F`,
    );
  }

  if (postingSuggestions.length === 0) {
    postingSuggestions.push(
      `It's a ${current.description.toLowerCase()} day${businessName ? ` at ${businessName}` : ""}!`,
    );
  }

  // Determine post type from weather severity
  const postType = getPostType(current);

  // Build recommendation
  const recommendation = postingSuggestions[0] || `${current.description} and ${Math.round(current.temperature)}F today.`;

  return {
    temperature: current.temperature,
    conditions: current.description,
    recommendation,
    forecast,
    current,
    businessInsights,
    postingSuggestions,
    postType,
    location: { latitude, longitude },
    queriedAt: new Date().toISOString(),
    safetyGate: postType === "ACTIVE_STORM",
    urgency: postType === "ACTIVE_STORM" ? "critical" : postType === "MONITORING" ? "high" : "normal",
  };
}

// ---------------------------------------------------------------------------
// formatFacebookPost
// ---------------------------------------------------------------------------

export function formatFacebookPost(data: any, opts?: Record<string, unknown>): string {
  if (!data) return "";

  // Handle structured data with headline/body/etc
  if (data.headline || data.body) {
    const parts: string[] = [];
    if (data.headline) parts.push(data.headline);
    if (data.body) parts.push(data.body);
    if (data.weatherNote) parts.push(data.weatherNote);
    if (data.callToAction) parts.push(data.callToAction);
    if (data.hashtags && Array.isArray(data.hashtags)) {
      parts.push(data.hashtags.map((tag: string) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" "));
    }
    return parts.join("\n\n");
  }

  // Handle weather intelligence data
  const temp = data.temperature ?? data.current?.temperature ?? 72;
  const conditions = data.conditions ?? data.current?.description ?? "Clear";
  const businessName = data.businessName || opts?.businessName || "";
  const includeEmoji = opts?.includeEmoji ?? true;
  const includePoweredBy = opts?.includePoweredBy ?? false;

  const postType = data.postType || "ALL_CLEAR";

  let post = "";
  if (postType === "ACTIVE_STORM") {
    post = includeEmoji
      ? `Storm Alert! ${conditions} conditions in our area. ${businessName ? `${businessName} is` : "We are"} here to help - stay safe and call us if you need emergency service.`
      : `Storm Alert - ${conditions} conditions in our area. ${businessName ? `${businessName} is` : "We are"} here to help. Stay safe and call us if you need emergency service.`;
  } else if (postType === "MONITORING") {
    post = includeEmoji
      ? `Weather Update: ${conditions} expected today (${Math.round(temp)}F). ${businessName ? `${businessName} is` : "We are"} monitoring conditions and ready to respond. Stay prepared!`
      : `Weather Update: ${conditions} expected today (${Math.round(temp)}F). ${businessName ? `${businessName} is` : "We are"} monitoring conditions and ready to respond.`;
  } else {
    const suggestion = data.recommendation || data.postingSuggestions?.[0] || "";
    post = suggestion || `${conditions} and ${Math.round(temp)}F today. ${businessName ? `Great day to connect with ${businessName}!` : "Great day!"}`;
  }

  if (includePoweredBy) {
    post += "\n\nPowered by LaunchBase Intelligence";
  }

  return post;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function weatherCodeToCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return conditions[code] || "Clear";
}

function weatherCodeToIcon(code: number): string {
  if (code === 0) return "clear";
  if (code <= 2) return "partly-cloudy";
  if (code === 3) return "cloudy";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain-showers";
  if (code <= 86) return "snow-showers";
  return "thunderstorm";
}

function getPostType(current: WeatherCondition): string {
  if (current.windSpeed > 50 || current.description.toLowerCase().includes("thunderstorm")) {
    return "ACTIVE_STORM";
  }
  if (current.windSpeed > 30 || current.description.toLowerCase().includes("heavy")) {
    return "MONITORING";
  }
  if (current.description.toLowerCase().includes("rain") || current.description.toLowerCase().includes("snow")) {
    return "WEATHER_UPDATE";
  }
  return "ALL_CLEAR";
}
