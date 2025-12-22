/**
 * Weather Intelligence Service
 * 
 * Fetches weather data from NWS API and classifies conditions
 * for intelligent social media posting decisions.
 * 
 * NWS API is free, no API key required.
 * Docs: https://www.weather.gov/documentation/services-web-api
 */

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "LaunchBase/1.0 (contact@getlaunchbase.com)";

// Post type classification
export type PostType = 
  | "ALL_CLEAR"      // Normal conditions, safe to post anything
  | "MONITORING"     // Something to watch, mention weather casually
  | "ACTIVE_STORM"   // Active weather event, weather-focused post
  | "EXTREME_COLD"   // Dangerous cold, safety-focused
  | "EXTREME_HEAT"   // Dangerous heat, safety-focused
  | "FLASH_FREEZE"   // Rapid temperature drop, urgent
  | "SEVERE_WEATHER" // Tornado, severe thunderstorm, etc.
  | "WINTER_STORM"   // Snow, ice, blizzard
  | "FLOODING";      // Flood warnings

export type Urgency = "low" | "medium" | "high";

export interface IntelligenceResult {
  postType: PostType;
  urgency: Urgency;
  summary: string;           // 1-2 sentence readable summary
  bullets: string[];         // Actionable items for the business
  suggestedCTA: string;      // Call to action for the post
  safetyGate: boolean;       // If true, do NOT mention events/soft topics
  rawConditions?: {
    temperature: number;
    temperatureUnit: string;
    shortForecast: string;
    windSpeed: string;
    windDirection: string;
  };
  alerts?: Array<{
    event: string;
    severity: string;
    headline: string;
  }>;
}

export interface WeatherInput {
  latitude: number;
  longitude: number;
  businessType?: string;     // e.g., "plumbing", "hvac", "landscaping"
  businessName?: string;
}

/**
 * Get grid point for coordinates (required for NWS API)
 */
async function getGridPoint(lat: number, lon: number): Promise<{
  gridId: string;
  gridX: number;
  gridY: number;
  forecastUrl: string;
  forecastHourlyUrl: string;
} | null> {
  try {
    const response = await fetch(`${NWS_API_BASE}/points/${lat},${lon}`, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      gridId: data.properties.gridId,
      gridX: data.properties.gridX,
      gridY: data.properties.gridY,
      forecastUrl: data.properties.forecast,
      forecastHourlyUrl: data.properties.forecastHourly,
    };
  } catch {
    return null;
  }
}

/**
 * Get current conditions from NWS
 */
async function getCurrentConditions(forecastHourlyUrl: string): Promise<{
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  windSpeed: string;
  windDirection: string;
} | null> {
  try {
    const response = await fetch(forecastHourlyUrl, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const current = data.properties.periods[0];

    return {
      temperature: current.temperature,
      temperatureUnit: current.temperatureUnit,
      shortForecast: current.shortForecast,
      windSpeed: current.windSpeed,
      windDirection: current.windDirection,
    };
  } catch {
    return null;
  }
}

/**
 * Get active alerts for a location
 */
async function getActiveAlerts(lat: number, lon: number): Promise<Array<{
  event: string;
  severity: string;
  headline: string;
  description: string;
}>> {
  try {
    const response = await fetch(`${NWS_API_BASE}/alerts/active?point=${lat},${lon}`, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.features || []).map((f: any) => ({
      event: f.properties.event,
      severity: f.properties.severity,
      headline: f.properties.headline,
      description: f.properties.description,
    }));
  } catch {
    return [];
  }
}

/**
 * Classify weather conditions into post type (deterministic rules)
 */
function classifyConditions(
  conditions: { temperature: number; temperatureUnit: string; shortForecast: string },
  alerts: Array<{ event: string; severity: string }>
): { postType: PostType; urgency: Urgency; safetyGate: boolean } {
  const temp = conditions.temperature;
  const forecast = conditions.shortForecast.toLowerCase();

  // Check alerts first (highest priority)
  const severeAlerts = alerts.filter(a => 
    a.severity === "Extreme" || a.severity === "Severe"
  );

  if (severeAlerts.length > 0) {
    const alertEvent = severeAlerts[0].event.toLowerCase();
    
    if (alertEvent.includes("tornado") || alertEvent.includes("severe thunderstorm")) {
      return { postType: "SEVERE_WEATHER", urgency: "high", safetyGate: true };
    }
    if (alertEvent.includes("flood")) {
      return { postType: "FLOODING", urgency: "high", safetyGate: true };
    }
    if (alertEvent.includes("blizzard") || alertEvent.includes("winter storm") || alertEvent.includes("ice storm")) {
      return { postType: "WINTER_STORM", urgency: "high", safetyGate: true };
    }
    if (alertEvent.includes("heat")) {
      return { postType: "EXTREME_HEAT", urgency: "high", safetyGate: true };
    }
    if (alertEvent.includes("cold") || alertEvent.includes("freeze") || alertEvent.includes("wind chill")) {
      return { postType: "EXTREME_COLD", urgency: "high", safetyGate: true };
    }
  }

  // Temperature-based classification
  if (temp <= 10) {
    return { postType: "EXTREME_COLD", urgency: "high", safetyGate: true };
  }
  if (temp <= 25) {
    return { postType: "FLASH_FREEZE", urgency: "medium", safetyGate: false };
  }
  if (temp >= 100) {
    return { postType: "EXTREME_HEAT", urgency: "high", safetyGate: true };
  }
  if (temp >= 90) {
    return { postType: "EXTREME_HEAT", urgency: "medium", safetyGate: false };
  }

  // Forecast-based classification
  if (forecast.includes("snow") || forecast.includes("blizzard") || forecast.includes("ice")) {
    return { postType: "WINTER_STORM", urgency: "medium", safetyGate: false };
  }
  if (forecast.includes("thunderstorm") || forecast.includes("severe")) {
    return { postType: "ACTIVE_STORM", urgency: "medium", safetyGate: false };
  }
  if (forecast.includes("rain") || forecast.includes("shower")) {
    return { postType: "MONITORING", urgency: "low", safetyGate: false };
  }

  // Default: all clear
  return { postType: "ALL_CLEAR", urgency: "low", safetyGate: false };
}

/**
 * Generate business-specific bullets and CTA
 */
function generateBusinessContent(
  postType: PostType,
  businessType: string = "service"
): { bullets: string[]; suggestedCTA: string } {
  const businessLower = businessType.toLowerCase();

  // Plumbing-specific content
  if (businessLower.includes("plumb")) {
    switch (postType) {
      case "EXTREME_COLD":
      case "FLASH_FREEZE":
        return {
          bullets: [
            "Let faucets drip to prevent frozen pipes",
            "Know where your main water shutoff is",
            "Insulate exposed pipes in unheated areas",
          ],
          suggestedCTA: "Frozen pipe emergency? Call us 24/7.",
        };
      case "WINTER_STORM":
        return {
          bullets: [
            "Clear snow from outdoor drains",
            "Check sump pump is working",
            "Keep cabinet doors open to warm pipes",
          ],
          suggestedCTA: "We're here if you need us.",
        };
      default:
        return {
          bullets: ["Regular maintenance prevents emergencies"],
          suggestedCTA: "Schedule your checkup today.",
        };
    }
  }

  // HVAC-specific content
  if (businessLower.includes("hvac") || businessLower.includes("heating") || businessLower.includes("cooling")) {
    switch (postType) {
      case "EXTREME_COLD":
        return {
          bullets: [
            "Don't set thermostat below 55°F",
            "Change filters for maximum efficiency",
            "Check for cold drafts around windows",
          ],
          suggestedCTA: "Furnace acting up? We're on call.",
        };
      case "EXTREME_HEAT":
        return {
          bullets: [
            "Set AC to 78°F when away",
            "Close blinds on sunny windows",
            "Check air filter monthly",
          ],
          suggestedCTA: "AC not keeping up? Call us.",
        };
      default:
        return {
          bullets: ["Seasonal tune-ups save money"],
          suggestedCTA: "Book your maintenance visit.",
        };
    }
  }

  // Snow removal / landscaping
  if (businessLower.includes("snow") || businessLower.includes("plow") || businessLower.includes("landscape")) {
    switch (postType) {
      case "WINTER_STORM":
        return {
          bullets: [
            "Storm expected — we're ready",
            "Priority service for contract customers",
            "Salt and sand supplies stocked",
          ],
          suggestedCTA: "Not on our list? Sign up now.",
        };
      case "FLASH_FREEZE":
        return {
          bullets: [
            "Black ice risk tonight",
            "Salting services available",
            "Stay safe on driveways and walkways",
          ],
          suggestedCTA: "Need salting? Call us.",
        };
      default:
        return {
          bullets: ["Seasonal contracts available"],
          suggestedCTA: "Get a quote for the season.",
        };
    }
  }

  // Generic service business
  return {
    bullets: ["We're monitoring conditions", "Your safety is our priority"],
    suggestedCTA: "Questions? Give us a call.",
  };
}

/**
 * Generate summary text based on conditions
 */
function generateSummary(
  postType: PostType,
  conditions: { temperature: number; temperatureUnit: string; shortForecast: string },
  businessName?: string
): string {
  const name = businessName || "We";
  const temp = conditions.temperature;
  const unit = conditions.temperatureUnit === "F" ? "°F" : "°C";

  switch (postType) {
    case "EXTREME_COLD":
      return `Cold snap hitting the area — ${temp}${unit} and dropping. ${name}'re here if you need us.`;
    case "FLASH_FREEZE":
      return `Temperatures dropping fast to ${temp}${unit}. Time to prepare.`;
    case "EXTREME_HEAT":
      return `Heat advisory in effect — ${temp}${unit} today. Stay cool and hydrated.`;
    case "WINTER_STORM":
      return `Winter weather moving in. ${conditions.shortForecast}. ${name}'re ready.`;
    case "ACTIVE_STORM":
      return `Storms in the forecast. ${conditions.shortForecast}. Stay safe out there.`;
    case "SEVERE_WEATHER":
      return `⚠️ Severe weather alert. Stay safe and follow local guidance.`;
    case "FLOODING":
      return `⚠️ Flood warning in effect. Avoid low-lying areas.`;
    case "MONITORING":
      return `${conditions.shortForecast} expected. ${name}'re keeping an eye on conditions.`;
    default:
      return `Looking good out there — ${temp}${unit} and ${conditions.shortForecast.toLowerCase()}.`;
  }
}

/**
 * Main function: Get weather intelligence for a location
 */
export async function getWeatherIntelligence(input: WeatherInput): Promise<IntelligenceResult> {
  // Get grid point
  const gridPoint = await getGridPoint(input.latitude, input.longitude);
  
  if (!gridPoint) {
    // Return safe default if API fails
    return {
      postType: "ALL_CLEAR",
      urgency: "low",
      summary: "Weather data temporarily unavailable. Proceeding with caution.",
      bullets: ["Check local forecasts"],
      suggestedCTA: "Contact us anytime.",
      safetyGate: false,
    };
  }

  // Fetch conditions and alerts in parallel
  const [conditions, alerts] = await Promise.all([
    getCurrentConditions(gridPoint.forecastHourlyUrl),
    getActiveAlerts(input.latitude, input.longitude),
  ]);

  if (!conditions) {
    return {
      postType: "ALL_CLEAR",
      urgency: "low",
      summary: "Weather data temporarily unavailable.",
      bullets: ["Check local forecasts"],
      suggestedCTA: "Contact us anytime.",
      safetyGate: false,
    };
  }

  // Classify conditions
  const classification = classifyConditions(conditions, alerts);

  // Generate business-specific content
  const content = generateBusinessContent(classification.postType, input.businessType);

  // Generate summary
  const summary = generateSummary(classification.postType, conditions, input.businessName);

  return {
    postType: classification.postType,
    urgency: classification.urgency,
    summary,
    bullets: content.bullets,
    suggestedCTA: content.suggestedCTA,
    safetyGate: classification.safetyGate,
    rawConditions: conditions,
    alerts: alerts.map(a => ({
      event: a.event,
      severity: a.severity,
      headline: a.headline,
    })),
  };
}

/**
 * Format intelligence result into a Facebook post
 */
export function formatFacebookPost(
  result: IntelligenceResult,
  options: { includeEmoji?: boolean; includePoweredBy?: boolean } = {}
): string {
  const { includeEmoji = true, includePoweredBy = false } = options;

  let post = "";

  // Add emoji prefix based on post type
  if (includeEmoji) {
    const emojiMap: Record<PostType, string> = {
      ALL_CLEAR: "☀️",
      MONITORING: "🌤️",
      ACTIVE_STORM: "⛈️",
      EXTREME_COLD: "🥶",
      EXTREME_HEAT: "🥵",
      FLASH_FREEZE: "❄️",
      SEVERE_WEATHER: "⚠️",
      WINTER_STORM: "🌨️",
      FLOODING: "🌊",
    };
    post += emojiMap[result.postType] + " ";
  }

  // Add summary
  post += result.summary + "\n\n";

  // Add bullets
  if (result.bullets.length > 0) {
    post += result.bullets.map(b => `• ${b}`).join("\n");
    post += "\n\n";
  }

  // Add CTA
  post += result.suggestedCTA;

  // Add powered by line
  if (includePoweredBy) {
    post += "\n\n—\nPowered by LaunchBase";
  }

  return post;
}
