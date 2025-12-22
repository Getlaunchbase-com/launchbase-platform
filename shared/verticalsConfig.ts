/**
 * LaunchBase Vertical Categories Configuration
 * 
 * Defines all supported business verticals, their industries,
 * and which Suite intelligence layers are most relevant.
 */

export type VerticalCategory = 
  | 'trades'
  | 'health'
  | 'beauty'
  | 'food'
  | 'cannabis'
  | 'professional'
  | 'fitness'
  | 'automotive';

export interface Industry {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  description: string;
}

export interface VerticalConfig {
  id: VerticalCategory;
  name: string;
  tagline: string;
  icon: string;
  industries: Industry[];
  suiteRelevance: {
    weather: 'high' | 'medium' | 'low';
    sports: 'high' | 'medium' | 'low';
    community: 'high' | 'medium' | 'low';
    trends: 'high' | 'medium' | 'low';
  };
  weatherExamples: string[];
}

export const VERTICALS: Record<VerticalCategory, VerticalConfig> = {
  trades: {
    id: 'trades',
    name: 'Trades & Home Services',
    tagline: 'Weather-aware marketing for the businesses that keep homes running',
    icon: 'Wrench',
    industries: [
      { id: 'plumbing', name: 'Plumbing', icon: 'Droplets', description: 'Plumbers & drain services' },
      { id: 'hvac', name: 'HVAC', icon: 'Thermometer', description: 'Heating & cooling' },
      { id: 'electrical', name: 'Electrical', icon: 'Zap', description: 'Electricians & wiring' },
      { id: 'roofing', name: 'Roofing', icon: 'Home', description: 'Roofing & gutters' },
      { id: 'landscaping', name: 'Landscaping', icon: 'Trees', description: 'Lawn care & landscaping' },
      { id: 'snow_removal', name: 'Snow Removal', icon: 'Snowflake', description: 'Snow plowing & ice management' },
      { id: 'pest_control', name: 'Pest Control', icon: 'Bug', description: 'Exterminators & pest management' },
      { id: 'cleaning', name: 'Cleaning', icon: 'Sparkles', description: 'House cleaning & janitorial' },
      { id: 'general_contractor', name: 'General Contractor', icon: 'HardHat', description: 'Construction & remodeling' },
      { id: 'painting', name: 'Painting', icon: 'Paintbrush', description: 'Interior & exterior painting' },
    ],
    suiteRelevance: {
      weather: 'high',
      sports: 'medium',
      community: 'medium',
      trends: 'low',
    },
    weatherExamples: [
      'Storm coming? Remind customers to check their sump pump.',
      'First freeze alert? Time to talk about pipe insulation.',
      'Heavy snow forecast? Let them know you\'re ready.',
    ],
  },

  health: {
    id: 'health',
    name: 'Health & Wellness',
    tagline: 'Build trust with patients who need you',
    icon: 'Heart',
    industries: [
      { id: 'dentist', name: 'Dentist', icon: 'Smile', description: 'Dental practices' },
      { id: 'chiropractor', name: 'Chiropractor', icon: 'Activity', description: 'Chiropractic care' },
      { id: 'med_spa', name: 'Med Spa', icon: 'Sparkles', description: 'Medical aesthetics' },
      { id: 'physical_therapy', name: 'Physical Therapy', icon: 'Dumbbell', description: 'PT & rehabilitation' },
      { id: 'optometrist', name: 'Optometrist', icon: 'Eye', description: 'Eye care & glasses' },
      { id: 'mental_health', name: 'Mental Health', icon: 'Brain', description: 'Therapy & counseling' },
      { id: 'veterinarian', name: 'Veterinarian', icon: 'Dog', description: 'Pet care & animal hospital' },
      { id: 'pharmacy', name: 'Pharmacy', icon: 'Pill', description: 'Independent pharmacies' },
    ],
    suiteRelevance: {
      weather: 'low',
      sports: 'low',
      community: 'high',
      trends: 'medium',
    },
    weatherExamples: [
      'Allergy season starting? Remind patients about checkups.',
      'Cold & flu season? Promote preventive care.',
    ],
  },

  beauty: {
    id: 'beauty',
    name: 'Beauty & Personal Care',
    tagline: 'Keep your chairs full and your reviews glowing',
    icon: 'Scissors',
    industries: [
      { id: 'hair_salon', name: 'Hair Salon', icon: 'Scissors', description: 'Hair styling & cuts' },
      { id: 'barber', name: 'Barber Shop', icon: 'Scissors', description: 'Men\'s grooming' },
      { id: 'nail_salon', name: 'Nail Salon', icon: 'Sparkles', description: 'Manicures & pedicures' },
      { id: 'spa', name: 'Day Spa', icon: 'Flower2', description: 'Massage & relaxation' },
      { id: 'tattoo', name: 'Tattoo Studio', icon: 'Pen', description: 'Tattoos & body art' },
      { id: 'lashes', name: 'Lash & Brow', icon: 'Eye', description: 'Lash extensions & brows' },
      { id: 'skincare', name: 'Skincare', icon: 'Droplet', description: 'Facials & esthetics' },
    ],
    suiteRelevance: {
      weather: 'low',
      sports: 'medium',
      community: 'high',
      trends: 'high',
    },
    weatherExamples: [
      'Rainy weekend? Perfect time for self-care.',
      'Summer heat? Promote refreshing treatments.',
    ],
  },

  food: {
    id: 'food',
    name: 'Food & Beverage',
    tagline: 'Fill tables and build regulars',
    icon: 'UtensilsCrossed',
    industries: [
      { id: 'restaurant', name: 'Restaurant', icon: 'UtensilsCrossed', description: 'Dining establishments' },
      { id: 'bar', name: 'Bar & Pub', icon: 'Beer', description: 'Bars & nightlife' },
      { id: 'cafe', name: 'Café', icon: 'Coffee', description: 'Coffee shops & cafes' },
      { id: 'bakery', name: 'Bakery', icon: 'Croissant', description: 'Bakeries & pastry shops' },
      { id: 'catering', name: 'Catering', icon: 'ChefHat', description: 'Event catering' },
      { id: 'food_truck', name: 'Food Truck', icon: 'Truck', description: 'Mobile food service' },
      { id: 'brewery', name: 'Brewery', icon: 'Beer', description: 'Craft breweries & taprooms' },
      { id: 'winery', name: 'Winery', icon: 'Wine', description: 'Wineries & tasting rooms' },
    ],
    suiteRelevance: {
      weather: 'medium',
      sports: 'high',
      community: 'high',
      trends: 'high',
    },
    weatherExamples: [
      'Game day? Promote your watch party specials.',
      'Beautiful patio weather? Let them know you\'re open.',
      'Cold night? Comfort food time.',
    ],
  },

  cannabis: {
    id: 'cannabis',
    name: 'Cannabis',
    tagline: 'Compliant marketing that builds your customer base',
    icon: 'Leaf',
    industries: [
      { id: 'dispensary', name: 'Dispensary', icon: 'Store', description: 'Retail cannabis' },
      { id: 'delivery', name: 'Cannabis Delivery', icon: 'Truck', description: 'Delivery services' },
      { id: 'cultivation', name: 'Cultivation', icon: 'Sprout', description: 'Growing operations' },
      { id: 'cbd', name: 'CBD & Hemp', icon: 'Leaf', description: 'CBD products & stores' },
    ],
    suiteRelevance: {
      weather: 'medium',
      sports: 'high',
      community: 'medium',
      trends: 'high',
    },
    weatherExamples: [
      'Rainy day? Perfect for staying in.',
      'Game day weekend? Stock up.',
    ],
  },

  professional: {
    id: 'professional',
    name: 'Professional Services',
    tagline: 'Turn expertise into clients',
    icon: 'Briefcase',
    industries: [
      { id: 'lawyer', name: 'Law Firm', icon: 'Scale', description: 'Legal services' },
      { id: 'accountant', name: 'Accountant', icon: 'Calculator', description: 'Accounting & tax' },
      { id: 'insurance', name: 'Insurance Agent', icon: 'Shield', description: 'Insurance services' },
      { id: 'real_estate', name: 'Real Estate', icon: 'Home', description: 'Realtors & brokers' },
      { id: 'financial_advisor', name: 'Financial Advisor', icon: 'TrendingUp', description: 'Wealth management' },
      { id: 'consultant', name: 'Consultant', icon: 'Lightbulb', description: 'Business consulting' },
      { id: 'photographer', name: 'Photographer', icon: 'Camera', description: 'Photography services' },
      { id: 'marketing', name: 'Marketing Agency', icon: 'Megaphone', description: 'Marketing & advertising' },
    ],
    suiteRelevance: {
      weather: 'low',
      sports: 'low',
      community: 'high',
      trends: 'medium',
    },
    weatherExamples: [
      'Tax season approaching? Time to remind clients.',
      'End of year? Financial planning posts.',
    ],
  },

  fitness: {
    id: 'fitness',
    name: 'Fitness & Recreation',
    tagline: 'Keep members engaged and classes full',
    icon: 'Dumbbell',
    industries: [
      { id: 'gym', name: 'Gym', icon: 'Dumbbell', description: 'Fitness centers' },
      { id: 'personal_trainer', name: 'Personal Trainer', icon: 'User', description: 'Personal training' },
      { id: 'yoga', name: 'Yoga Studio', icon: 'Flower2', description: 'Yoga & meditation' },
      { id: 'martial_arts', name: 'Martial Arts', icon: 'Swords', description: 'Martial arts schools' },
      { id: 'dance', name: 'Dance Studio', icon: 'Music', description: 'Dance classes' },
      { id: 'crossfit', name: 'CrossFit', icon: 'Dumbbell', description: 'CrossFit boxes' },
      { id: 'pilates', name: 'Pilates', icon: 'Activity', description: 'Pilates studios' },
      { id: 'swimming', name: 'Swimming', icon: 'Waves', description: 'Pools & swim schools' },
    ],
    suiteRelevance: {
      weather: 'medium',
      sports: 'medium',
      community: 'high',
      trends: 'medium',
    },
    weatherExamples: [
      'Too cold to run outside? Indoor workout time.',
      'New Year? Resolution season is here.',
    ],
  },

  automotive: {
    id: 'automotive',
    name: 'Automotive',
    tagline: 'Be there when they need you most',
    icon: 'Car',
    industries: [
      { id: 'auto_repair', name: 'Auto Repair', icon: 'Wrench', description: 'Mechanics & repair shops' },
      { id: 'auto_detailing', name: 'Auto Detailing', icon: 'Sparkles', description: 'Car wash & detailing' },
      { id: 'towing', name: 'Towing', icon: 'Truck', description: 'Towing services' },
      { id: 'tire_shop', name: 'Tire Shop', icon: 'Circle', description: 'Tires & alignment' },
      { id: 'body_shop', name: 'Body Shop', icon: 'Car', description: 'Collision repair' },
      { id: 'oil_change', name: 'Oil Change', icon: 'Droplet', description: 'Quick lube services' },
      { id: 'car_dealer', name: 'Car Dealer', icon: 'Car', description: 'Auto sales' },
    ],
    suiteRelevance: {
      weather: 'high',
      sports: 'low',
      community: 'medium',
      trends: 'low',
    },
    weatherExamples: [
      'Winter storm coming? Time for winter tires.',
      'Salt on the roads? Remind them about undercarriage wash.',
      'Summer road trip season? Pre-trip inspections.',
    ],
  },
};

// Helper functions
export function getVerticalById(id: VerticalCategory): VerticalConfig {
  return VERTICALS[id];
}

export function getAllVerticals(): VerticalConfig[] {
  return Object.values(VERTICALS);
}

export function getIndustriesByVertical(verticalId: VerticalCategory): Industry[] {
  return VERTICALS[verticalId]?.industries || [];
}

export function findIndustryById(industryId: string): { vertical: VerticalConfig; industry: Industry } | null {
  for (const vertical of Object.values(VERTICALS)) {
    const industry = vertical.industries.find(i => i.id === industryId);
    if (industry) {
      return { vertical, industry };
    }
  }
  return null;
}

export function getRecommendedLayers(verticalId: VerticalCategory): string[] {
  const vertical = VERTICALS[verticalId];
  if (!vertical) return ['weather'];
  
  const layers: string[] = ['weather']; // Always included
  
  if (vertical.suiteRelevance.sports === 'high') layers.push('sports');
  if (vertical.suiteRelevance.community === 'high') layers.push('community');
  if (vertical.suiteRelevance.trends === 'high') layers.push('trends');
  
  return layers;
}

// For display on homepage
export const FEATURED_VERTICALS: VerticalCategory[] = [
  'trades',
  'health',
  'beauty',
  'food',
  'fitness',
  'automotive',
];

// Copy for homepage
export const VERTICAL_HERO_EXAMPLES = [
  'plumbers',
  'dentists',
  'salons',
  'restaurants',
  'gyms',
  'auto shops',
];
