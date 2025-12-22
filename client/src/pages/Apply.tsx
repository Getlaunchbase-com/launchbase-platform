import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Check, Loader2, Globe, Wrench, Heart, Scissors, UtensilsCrossed, Leaf, Briefcase, Dumbbell, Car } from "lucide-react";
import { Link } from "wouter";

// Supported languages
type Language = "en" | "es" | "pl";

// Vertical categories matching our config
type VerticalCategory = 
  | "trades"
  | "health"
  | "beauty"
  | "food"
  | "cannabis"
  | "professional"
  | "fitness"
  | "automotive";

type Cadence = "LOW" | "MEDIUM" | "HIGH";
type Mode = "AUTO" | "GUIDED" | "CUSTOM";
type StartTiming = "NOW" | "TWO_WEEKS" | "EXPLORING";

type Layers = {
  weather: true;
  sports: boolean;
  community: boolean;
  trends: boolean;
};

type ApplyForm = {
  language: Language;
  vertical: VerticalCategory | null;
  industry: string;
  cityZip: string;
  radiusMiles: number;
  cadence: Cadence;
  layers: Layers;
  mode: Mode;
  startTiming: StartTiming | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  termsAccepted: boolean;
};

const STORAGE_KEY = "launchbase_apply_draft_v2";

// Translations
const translations: Record<Language, {
  badge: string;
  title: string;
  subtitle: string;
  steps: { language: string; business: string; location: string; cadence: string; context: string; control: string; start: string; contact: string; review: string };
  languageStep: { title: string; subtitle: string };
  businessStep: { title: string; subtitle: string };
  locationStep: { title: string; subtitle: string; cityLabel: string; cityPlaceholder: string; radiusLabel: string };
  cadenceStep: { title: string; subtitle: string };
  layersStep: { title: string; subtitle: string };
  modeStep: { title: string; subtitle: string };
  timingStep: { title: string; subtitle: string };
  contactStep: { title: string; subtitle: string; nameLabel: string; emailLabel: string; phoneLabel: string };
  reviewStep: { title: string; subtitle: string; termsLabel: string };
  buttons: { back: string; continue: string; submit: string };
  pricing: { monthly: string; setup: string; cadence: string; layers: string; total: string };
}> = {
  en: {
    badge: "Founder pricing locks for 12 months",
    title: "Apply for LaunchBase",
    subtitle: "3–5 minutes. You'll preview what LaunchBase would run for your business before anything goes live.",
    steps: { language: "Language", business: "Business", location: "Location", cadence: "Cadence", context: "Context", control: "Control", start: "Start", contact: "Contact", review: "Review" },
    languageStep: { title: "Choose your language", subtitle: "Select the language you're most comfortable with. Your website will be built in English to reach local customers." },
    businessStep: { title: "What type of business?", subtitle: "This helps LaunchBase choose the right context signals for your industry." },
    locationStep: { title: "Location & locality", subtitle: "LaunchBase observes what's happening around your business.", cityLabel: "City or ZIP", cityPlaceholder: "e.g. Chicago, IL or 60614", radiusLabel: "Service radius (miles)" },
    cadenceStep: { title: "How visible do you want to be?", subtitle: "Cadence controls how often LaunchBase posts on your behalf." },
    layersStep: { title: "What local context matters?", subtitle: "Add intelligence layers to make your posts more relevant." },
    modeStep: { title: "How hands-on do you want to be?", subtitle: "Choose how much control you want over each post." },
    timingStep: { title: "When do you want to start?", subtitle: "We'll build your website and set up your workflows." },
    contactStep: { title: "Contact information", subtitle: "We'll reach out to finalize your setup.", nameLabel: "Your name", emailLabel: "Email", phoneLabel: "Phone" },
    reviewStep: { title: "Review & apply", subtitle: "Make sure everything looks right.", termsLabel: "I agree to the Terms of Service and Privacy Policy" },
    buttons: { back: "Back", continue: "Continue", submit: "Submit Application" },
    pricing: { monthly: "Monthly", setup: "Setup", cadence: "Cadence", layers: "Layers", total: "Total" },
  },
  es: {
    badge: "Precio de fundador bloqueado por 12 meses",
    title: "Solicitar LaunchBase",
    subtitle: "3–5 minutos. Verás una vista previa de lo que LaunchBase haría para tu negocio antes de que nada salga en vivo.",
    steps: { language: "Idioma", business: "Negocio", location: "Ubicación", cadence: "Frecuencia", context: "Contexto", control: "Control", start: "Inicio", contact: "Contacto", review: "Revisar" },
    languageStep: { title: "Elige tu idioma", subtitle: "Selecciona el idioma con el que te sientas más cómodo. Tu sitio web se construirá en inglés para llegar a clientes locales." },
    businessStep: { title: "¿Qué tipo de negocio?", subtitle: "Esto ayuda a LaunchBase a elegir las señales de contexto adecuadas para tu industria." },
    locationStep: { title: "Ubicación y localidad", subtitle: "LaunchBase observa lo que está pasando alrededor de tu negocio.", cityLabel: "Ciudad o código postal", cityPlaceholder: "ej. Chicago, IL o 60614", radiusLabel: "Radio de servicio (millas)" },
    cadenceStep: { title: "¿Qué tan visible quieres ser?", subtitle: "La frecuencia controla qué tan seguido LaunchBase publica en tu nombre." },
    layersStep: { title: "¿Qué contexto local importa?", subtitle: "Agrega capas de inteligencia para hacer tus publicaciones más relevantes." },
    modeStep: { title: "¿Qué tan involucrado quieres estar?", subtitle: "Elige cuánto control quieres sobre cada publicación." },
    timingStep: { title: "¿Cuándo quieres empezar?", subtitle: "Construiremos tu sitio web y configuraremos tus flujos de trabajo." },
    contactStep: { title: "Información de contacto", subtitle: "Nos comunicaremos para finalizar tu configuración.", nameLabel: "Tu nombre", emailLabel: "Correo electrónico", phoneLabel: "Teléfono" },
    reviewStep: { title: "Revisar y aplicar", subtitle: "Asegúrate de que todo se vea bien.", termsLabel: "Acepto los Términos de Servicio y la Política de Privacidad" },
    buttons: { back: "Atrás", continue: "Continuar", submit: "Enviar Solicitud" },
    pricing: { monthly: "Mensual", setup: "Configuración", cadence: "Frecuencia", layers: "Capas", total: "Total" },
  },
  pl: {
    badge: "Cena założycielska zablokowana na 12 miesięcy",
    title: "Aplikuj do LaunchBase",
    subtitle: "3–5 minut. Zobaczysz podgląd tego, co LaunchBase zrobi dla Twojej firmy, zanim cokolwiek zostanie opublikowane.",
    steps: { language: "Język", business: "Firma", location: "Lokalizacja", cadence: "Częstotliwość", context: "Kontekst", control: "Kontrola", start: "Start", contact: "Kontakt", review: "Przegląd" },
    languageStep: { title: "Wybierz swój język", subtitle: "Wybierz język, w którym czujesz się najlepiej. Twoja strona internetowa zostanie zbudowana po angielsku, aby dotrzeć do lokalnych klientów." },
    businessStep: { title: "Jaki typ firmy?", subtitle: "To pomaga LaunchBase wybrać odpowiednie sygnały kontekstowe dla Twojej branży." },
    locationStep: { title: "Lokalizacja i okolica", subtitle: "LaunchBase obserwuje, co dzieje się wokół Twojej firmy.", cityLabel: "Miasto lub kod pocztowy", cityPlaceholder: "np. Chicago, IL lub 60614", radiusLabel: "Promień usług (mile)" },
    cadenceStep: { title: "Jak widoczny chcesz być?", subtitle: "Częstotliwość kontroluje, jak często LaunchBase publikuje w Twoim imieniu." },
    layersStep: { title: "Jaki lokalny kontekst ma znaczenie?", subtitle: "Dodaj warstwy inteligencji, aby Twoje posty były bardziej trafne." },
    modeStep: { title: "Jak bardzo chcesz być zaangażowany?", subtitle: "Wybierz, ile kontroli chcesz mieć nad każdym postem." },
    timingStep: { title: "Kiedy chcesz zacząć?", subtitle: "Zbudujemy Twoją stronę internetową i skonfigurujemy Twoje przepływy pracy." },
    contactStep: { title: "Informacje kontaktowe", subtitle: "Skontaktujemy się, aby sfinalizować konfigurację.", nameLabel: "Twoje imię", emailLabel: "Email", phoneLabel: "Telefon" },
    reviewStep: { title: "Przegląd i aplikacja", subtitle: "Upewnij się, że wszystko wygląda dobrze.", termsLabel: "Zgadzam się z Warunkami Usługi i Polityką Prywatności" },
    buttons: { back: "Wstecz", continue: "Kontynuuj", submit: "Wyślij Aplikację" },
    pricing: { monthly: "Miesięcznie", setup: "Konfiguracja", cadence: "Częstotliwość", layers: "Warstwy", total: "Razem" },
  },
};

// Vertical categories with icons and descriptions
const VERTICALS: { id: VerticalCategory; icon: typeof Wrench; name: Record<Language, string>; desc: Record<Language, string>; industries: { id: string; name: Record<Language, string> }[]; suiteRelevance: { weather: "high" | "medium" | "low"; sports: "high" | "medium" | "low"; community: "high" | "medium" | "low"; trends: "high" | "medium" | "low" } }[] = [
  {
    id: "trades",
    icon: Wrench,
    name: { en: "Trades & Home Services", es: "Oficios y Servicios del Hogar", pl: "Usługi Domowe i Rzemiosło" },
    desc: { en: "Plumbing, HVAC, electrical, roofing, carpentry, landscaping", es: "Plomería, HVAC, electricidad, techos, carpintería, jardinería", pl: "Hydraulika, HVAC, elektryka, dachy, stolarstwo, ogrodnictwo" },
    industries: [
      { id: "plumbing", name: { en: "Plumbing", es: "Plomería", pl: "Hydraulika" } },
      { id: "hvac", name: { en: "HVAC", es: "HVAC", pl: "HVAC" } },
      { id: "electrical", name: { en: "Electrical", es: "Electricidad", pl: "Elektryka" } },
      { id: "roofing", name: { en: "Roofing", es: "Techos", pl: "Dachy" } },
      { id: "landscaping", name: { en: "Landscaping", es: "Jardinería", pl: "Ogrodnictwo" } },
      { id: "snow_removal", name: { en: "Snow Removal", es: "Remoción de Nieve", pl: "Odśnieżanie" } },
      { id: "cleaning", name: { en: "Cleaning", es: "Limpieza", pl: "Sprzątanie" } },
      { id: "general_contractor", name: { en: "General Contractor", es: "Contratista General", pl: "Generalny Wykonawca" } },
      { id: "carpenter_finish", name: { en: "Finish Carpenter", es: "Carpintero de Acabados", pl: "Stolarz Wykończeniowy" } },
      { id: "carpenter_cabinetry", name: { en: "Custom Cabinetry", es: "Ebanistería Personalizada", pl: "Meble na Wymiar" } },
      { id: "carpenter_trim", name: { en: "Trim & Molding", es: "Molduras y Acabados", pl: "Listwy i Wykończenia" } },
      { id: "carpenter_furniture", name: { en: "Furniture Maker", es: "Fabricante de Muebles", pl: "Producent Mebli" } },
      { id: "carpenter_general", name: { en: "General Carpentry", es: "Carpintería General", pl: "Stolarstwo Ogólne" } },
    ],
    suiteRelevance: { weather: "high", sports: "medium", community: "medium", trends: "low" },
  },
  {
    id: "health",
    icon: Heart,
    name: { en: "Health & Wellness", es: "Salud y Bienestar", pl: "Zdrowie i Wellness" },
    desc: { en: "Dentists, chiropractors, med spas, physical therapy", es: "Dentistas, quiroprácticos, spas médicos, fisioterapia", pl: "Dentyści, kręgarze, spa medyczne, fizjoterapia" },
    industries: [
      { id: "dentist", name: { en: "Dentist", es: "Dentista", pl: "Dentysta" } },
      { id: "chiropractor", name: { en: "Chiropractor", es: "Quiropráctico", pl: "Kręgarz" } },
      { id: "med_spa", name: { en: "Med Spa", es: "Spa Médico", pl: "Spa Medyczne" } },
      { id: "physical_therapy", name: { en: "Physical Therapy", es: "Fisioterapia", pl: "Fizjoterapia" } },
      { id: "veterinarian", name: { en: "Veterinarian", es: "Veterinario", pl: "Weterynarz" } },
    ],
    suiteRelevance: { weather: "low", sports: "low", community: "high", trends: "medium" },
  },
  {
    id: "beauty",
    icon: Scissors,
    name: { en: "Beauty & Personal Care", es: "Belleza y Cuidado Personal", pl: "Uroda i Pielęgnacja" },
    desc: { en: "Hair salons, barbers, nail salons, spas, tattoo studios", es: "Salones de belleza, barberías, salones de uñas, spas, estudios de tatuajes", pl: "Salony fryzjerskie, fryzjerzy, salony paznokci, spa, studia tatuażu" },
    industries: [
      { id: "hair_salon", name: { en: "Hair Salon", es: "Salón de Belleza", pl: "Salon Fryzjerski" } },
      { id: "barber", name: { en: "Barber Shop", es: "Barbería", pl: "Fryzjer Męski" } },
      { id: "nail_salon", name: { en: "Nail Salon", es: "Salón de Uñas", pl: "Salon Paznokci" } },
      { id: "spa", name: { en: "Day Spa", es: "Spa", pl: "Spa" } },
      { id: "tattoo", name: { en: "Tattoo Studio", es: "Estudio de Tatuajes", pl: "Studio Tatuażu" } },
    ],
    suiteRelevance: { weather: "low", sports: "medium", community: "high", trends: "high" },
  },
  {
    id: "food",
    icon: UtensilsCrossed,
    name: { en: "Food & Beverage", es: "Comida y Bebidas", pl: "Jedzenie i Napoje" },
    desc: { en: "Restaurants, bars, cafés, bakeries, catering, food trucks", es: "Restaurantes, bares, cafés, panaderías, catering, food trucks", pl: "Restauracje, bary, kawiarnie, piekarnie, catering, food trucki" },
    industries: [
      { id: "restaurant", name: { en: "Restaurant", es: "Restaurante", pl: "Restauracja" } },
      { id: "bar", name: { en: "Bar & Pub", es: "Bar y Pub", pl: "Bar i Pub" } },
      { id: "cafe", name: { en: "Café", es: "Café", pl: "Kawiarnia" } },
      { id: "bakery", name: { en: "Bakery", es: "Panadería", pl: "Piekarnia" } },
      { id: "catering", name: { en: "Catering", es: "Catering", pl: "Catering" } },
      { id: "food_truck", name: { en: "Food Truck", es: "Food Truck", pl: "Food Truck" } },
    ],
    suiteRelevance: { weather: "medium", sports: "high", community: "high", trends: "high" },
  },
  {
    id: "cannabis",
    icon: Leaf,
    name: { en: "Cannabis", es: "Cannabis", pl: "Konopie" },
    desc: { en: "Dispensaries, delivery services, CBD stores", es: "Dispensarios, servicios de entrega, tiendas de CBD", pl: "Apteki, usługi dostawy, sklepy CBD" },
    industries: [
      { id: "dispensary", name: { en: "Dispensary", es: "Dispensario", pl: "Apteka" } },
      { id: "delivery", name: { en: "Cannabis Delivery", es: "Entrega de Cannabis", pl: "Dostawa Konopi" } },
      { id: "cbd", name: { en: "CBD & Hemp", es: "CBD y Cáñamo", pl: "CBD i Konopie" } },
    ],
    suiteRelevance: { weather: "medium", sports: "high", community: "medium", trends: "high" },
  },
  {
    id: "professional",
    icon: Briefcase,
    name: { en: "Professional Services", es: "Servicios Profesionales", pl: "Usługi Profesjonalne" },
    desc: { en: "Lawyers, accountants, insurance, real estate, consultants", es: "Abogados, contadores, seguros, bienes raíces, consultores", pl: "Prawnicy, księgowi, ubezpieczenia, nieruchomości, konsultanci" },
    industries: [
      { id: "lawyer", name: { en: "Law Firm", es: "Firma de Abogados", pl: "Kancelaria Prawna" } },
      { id: "accountant", name: { en: "Accountant", es: "Contador", pl: "Księgowy" } },
      { id: "insurance", name: { en: "Insurance Agent", es: "Agente de Seguros", pl: "Agent Ubezpieczeniowy" } },
      { id: "real_estate", name: { en: "Real Estate", es: "Bienes Raíces", pl: "Nieruchomości" } },
      { id: "consultant", name: { en: "Consultant", es: "Consultor", pl: "Konsultant" } },
    ],
    suiteRelevance: { weather: "low", sports: "low", community: "high", trends: "medium" },
  },
  {
    id: "fitness",
    icon: Dumbbell,
    name: { en: "Fitness & Recreation", es: "Fitness y Recreación", pl: "Fitness i Rekreacja" },
    desc: { en: "Gyms, personal trainers, yoga studios, martial arts, dance", es: "Gimnasios, entrenadores personales, estudios de yoga, artes marciales, danza", pl: "Siłownie, trenerzy personalni, studia jogi, sztuki walki, taniec" },
    industries: [
      { id: "gym", name: { en: "Gym", es: "Gimnasio", pl: "Siłownia" } },
      { id: "personal_trainer", name: { en: "Personal Trainer", es: "Entrenador Personal", pl: "Trener Personalny" } },
      { id: "yoga", name: { en: "Yoga Studio", es: "Estudio de Yoga", pl: "Studio Jogi" } },
      { id: "martial_arts", name: { en: "Martial Arts", es: "Artes Marciales", pl: "Sztuki Walki" } },
      { id: "dance", name: { en: "Dance Studio", es: "Estudio de Danza", pl: "Studio Tańca" } },
    ],
    suiteRelevance: { weather: "medium", sports: "medium", community: "high", trends: "medium" },
  },
  {
    id: "automotive",
    icon: Car,
    name: { en: "Automotive", es: "Automotriz", pl: "Motoryzacja" },
    desc: { en: "Auto repair, detailing, towing, tire shops, body shops", es: "Reparación de autos, detallado, grúas, tiendas de llantas, talleres de carrocería", pl: "Naprawa samochodów, detailing, holowanie, sklepy oponiarskie, blacharnie" },
    industries: [
      { id: "auto_repair", name: { en: "Auto Repair", es: "Reparación de Autos", pl: "Naprawa Samochodów" } },
      { id: "auto_detailing", name: { en: "Auto Detailing", es: "Detallado de Autos", pl: "Detailing Samochodowy" } },
      { id: "towing", name: { en: "Towing", es: "Grúas", pl: "Holowanie" } },
      { id: "tire_shop", name: { en: "Tire Shop", es: "Tienda de Llantas", pl: "Sklep Oponiarski" } },
      { id: "body_shop", name: { en: "Body Shop", es: "Taller de Carrocería", pl: "Blacharnia" } },
    ],
    suiteRelevance: { weather: "high", sports: "low", community: "medium", trends: "low" },
  },
];

const CADENCE_MONTHLY: Record<Cadence, number> = {
  LOW: 79,
  MEDIUM: 129,
  HIGH: 199,
};

const LAYER_MONTHLY = {
  sports: 29,
  community: 39,
  trends: 49,
};

const BASE_SETUP_FEE = 249;
const PER_LAYER_SETUP_FEE = 99;

function formatMoney(n: number) {
  return `$${n.toFixed(0)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computePricing(form: ApplyForm) {
  const cadenceMonthly = CADENCE_MONTHLY[form.cadence];
  const enabledLayerKeys = (["sports", "community", "trends"] as const).filter(
    (k) => form.layers[k]
  );
  const layersMonthly = enabledLayerKeys.reduce((sum, k) => sum + LAYER_MONTHLY[k], 0);
  const monthlyTotal = cadenceMonthly + layersMonthly;
  const setupFee = BASE_SETUP_FEE + enabledLayerKeys.length * PER_LAYER_SETUP_FEE;

  return {
    cadenceMonthly,
    enabledLayerKeys,
    layersMonthly,
    monthlyTotal,
    setupFee,
  };
}

const steps = [
  { id: "language", label: "language" },
  { id: "business", label: "business" },
  { id: "location", label: "location" },
  { id: "cadence", label: "cadence" },
  { id: "layers", label: "context" },
  { id: "mode", label: "control" },
  { id: "timing", label: "start" },
  { id: "contact", label: "contact" },
  { id: "review", label: "review" },
] as const;

type StepId = (typeof steps)[number]["id"];

export default function ApplyPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState<ApplyForm>(() => {
    const base: ApplyForm = {
      language: "en",
      vertical: null,
      industry: "",
      cityZip: "",
      radiusMiles: 15,
      cadence: "MEDIUM",
      layers: { weather: true, sports: true, community: false, trends: false },
      mode: "GUIDED",
      startTiming: null,
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      termsAccepted: false,
    };
    if (typeof window === "undefined") return base;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...base, ...JSON.parse(stored) };
    } catch {}
    return base;
  });

  const t = translations[form.language];
  const currentStep = steps[stepIndex].id;
  const pricing = useMemo(() => computePricing(form), [form]);

  // Persist draft
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {}
  }, [form]);

  // Auto-set recommended layers based on vertical
  useEffect(() => {
    if (form.vertical) {
      const vertical = VERTICALS.find(v => v.id === form.vertical);
      if (vertical) {
        setForm(f => ({
          ...f,
          layers: {
            weather: true,
            sports: vertical.suiteRelevance.sports === "high",
            community: vertical.suiteRelevance.community === "high",
            trends: vertical.suiteRelevance.trends === "high",
          }
        }));
      }
    }
  }, [form.vertical]);

  const submitMutation = trpc.suiteApply.submit.useMutation({
    onSuccess: () => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = "/apply/success";
    },
    onError: (err) => {
      setSubmitError(err.message || "Something went wrong. Please try again.");
    },
  });

  function next() {
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
  }
  function back() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }
  function gotoStep(id: StepId) {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx >= 0 && idx <= stepIndex) setStepIndex(idx);
  }

  const canContinue = useMemo(() => {
    switch (currentStep) {
      case "language":
        return !!form.language;
      case "business":
        return !!form.vertical;
      case "location":
        return form.cityZip.trim().length >= 3 && form.radiusMiles >= 5;
      case "timing":
        return !!form.startTiming;
      case "contact":
        return (
          form.contactName.trim().length >= 2 &&
          form.contactEmail.includes("@") &&
          form.contactPhone.trim().length >= 7
        );
      case "review":
        return form.termsAccepted;
      default:
        return true;
    }
  }, [currentStep, form]);

  async function submit() {
    if (!form.vertical || !form.startTiming) return;
    
    setSubmitError(null);
    
    submitMutation.mutate({
      language: form.language,
      vertical: form.vertical,
      industry: form.industry,
      location: { cityZip: form.cityZip.trim(), radiusMiles: form.radiusMiles },
      module: {
        name: "SOCIAL_MEDIA_INTELLIGENCE" as const,
        cadence: form.cadence,
        mode: form.mode,
        layers: form.layers,
      },
      startTiming: form.startTiming,
      contact: {
        name: form.contactName.trim(),
        email: form.contactEmail.trim(),
        phone: form.contactPhone.trim(),
      },
      pricing: {
        cadenceMonthly: pricing.cadenceMonthly,
        layersMonthly: pricing.layersMonthly,
        monthlyTotal: pricing.monthlyTotal,
        setupFee: pricing.setupFee,
        enabledLayers: pricing.enabledLayerKeys,
      },
      termsAccepted: form.termsAccepted as true,
    });
  }

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            <img src="/logo-cropped.png" alt="LaunchBase" className="h-8 w-auto" />
          </Link>
          
          {/* Language indicator */}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Globe className="w-4 h-4" />
            <span>{form.language === "es" ? "Español" : form.language === "pl" ? "Polski" : "English"}</span>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-32 lg:pb-12">
        <div className="mx-auto max-w-[1120px] px-4">
          {/* Page Header */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
              <span className="h-2 w-2 rounded-full bg-[#FF6A00]" />
              {t.badge}
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              {t.title}
            </h1>
            <p className="mt-2 max-w-2xl text-white/70">
              {t.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
            {/* Main Form */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:p-7">
              <Stepper stepIndex={stepIndex} onGoto={gotoStep} language={form.language} />

              <div className="mt-6">
                {currentStep === "language" && (
                  <StepLanguage
                    value={form.language}
                    onChange={(v) => setForm((f) => ({ ...f, language: v }))}
                    t={t}
                  />
                )}

                {currentStep === "business" && (
                  <StepBusiness
                    vertical={form.vertical}
                    industry={form.industry}
                    language={form.language}
                    onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                    t={t}
                  />
                )}

                {currentStep === "location" && (
                  <StepLocation
                    cityZip={form.cityZip}
                    radiusMiles={form.radiusMiles}
                    onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                    t={t}
                  />
                )}

                {currentStep === "cadence" && (
                  <StepCadence
                    value={form.cadence}
                    onChange={(v) => setForm((f) => ({ ...f, cadence: v }))}
                    t={t}
                    language={form.language}
                  />
                )}

                {currentStep === "layers" && (
                  <StepLayers
                    layers={form.layers}
                    onChange={(l) => setForm((f) => ({ ...f, layers: l }))}
                    t={t}
                    language={form.language}
                  />
                )}

                {currentStep === "mode" && (
                  <StepMode
                    value={form.mode}
                    onChange={(v) => setForm((f) => ({ ...f, mode: v }))}
                    t={t}
                    language={form.language}
                  />
                )}

                {currentStep === "timing" && (
                  <StepTiming
                    value={form.startTiming}
                    onChange={(v) => setForm((f) => ({ ...f, startTiming: v }))}
                    t={t}
                    language={form.language}
                  />
                )}

                {currentStep === "contact" && (
                  <StepContact
                    name={form.contactName}
                    email={form.contactEmail}
                    phone={form.contactPhone}
                    onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                    t={t}
                  />
                )}

                {currentStep === "review" && (
                  <StepReview
                    form={form}
                    pricing={pricing}
                    termsAccepted={form.termsAccepted}
                    onToggleTerms={(v) => setForm((f) => ({ ...f, termsAccepted: v }))}
                    t={t}
                    language={form.language}
                  />
                )}
              </div>

              {/* Navigation */}
              <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
                <button
                  onClick={back}
                  disabled={stepIndex === 0}
                  className="flex items-center gap-2 text-sm text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t.buttons.back}
                </button>

                {currentStep === "review" ? (
                  <button
                    onClick={submit}
                    disabled={!canContinue || submitMutation.isPending}
                    className="flex items-center gap-2 rounded-xl bg-[#FF6A00] px-6 py-3 font-medium text-white hover:bg-[#FF6A00]/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {submitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t.buttons.submit}
                  </button>
                ) : (
                  <button
                    onClick={next}
                    disabled={!canContinue}
                    className="flex items-center gap-2 rounded-xl bg-[#FF6A00] px-6 py-3 font-medium text-white hover:bg-[#FF6A00]/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {t.buttons.continue}
                  </button>
                )}
              </div>

              {submitError && (
                <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
                  {submitError}
                </div>
              )}
            </div>

            {/* Pricing Rail */}
            <PricingRail form={form} pricing={pricing} t={t} language={form.language} />
          </div>
        </div>
      </div>

      {/* Mobile Summary Bar */}
      <MobileSummaryBar pricing={pricing} t={t} />
    </div>
  );
}

/* ----------------------- UI COMPONENTS ----------------------- */

function Stepper({
  stepIndex,
  onGoto,
  language,
}: {
  stepIndex: number;
  onGoto: (id: StepId) => void;
  language: Language;
}) {
  const t = translations[language];
  const pct = Math.round(((stepIndex + 1) / steps.length) * 100);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/70">
          Step {stepIndex + 1} of {steps.length}
        </div>
        <div className="text-sm text-white/50">{pct}%</div>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#FF6A00] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {steps.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => idx <= stepIndex && onGoto(s.id)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              idx === stepIndex
                ? "bg-[#FF6A00]/20 text-[#FF6A00] border border-[#FF6A00]/50"
                : idx < stepIndex
                ? "bg-white/5 text-white/70 hover:bg-white/10"
                : "bg-white/5 text-white/30 cursor-not-allowed"
            }`}
            disabled={idx > stepIndex}
          >
            {idx < stepIndex && <Check className="w-3 h-3 inline mr-1" />}
            {t.steps[s.label as keyof typeof t.steps]}
          </button>
        ))}
      </div>
    </div>
  );
}

function CardOption({
  title,
  desc,
  selected,
  onClick,
  badge,
  icon: Icon,
}: {
  title: string;
  desc?: string;
  selected: boolean;
  onClick: () => void;
  badge?: string;
  icon?: typeof Wrench;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-[#FF6A00] bg-[#FF6A00]/10"
          : "border-white/10 bg-white/5 hover:bg-white/10"
      }`}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected ? "bg-[#FF6A00]/20" : "bg-white/10"}`}>
            <Icon className={`w-5 h-5 ${selected ? "text-[#FF6A00]" : "text-white/60"}`} />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="font-medium">{title}</div>
            {badge && (
              <span className="rounded-full bg-[#FF6A00]/20 text-[#FF6A00] px-2 py-0.5 text-xs">
                {badge}
              </span>
            )}
          </div>
          {desc && <div className="mt-1 text-sm text-white/60">{desc}</div>}
        </div>
      </div>
    </button>
  );
}

function StepLanguage({
  value,
  onChange,
  t,
}: {
  value: Language;
  onChange: (v: Language) => void;
  t: typeof translations["en"];
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{t.languageStep.title}</h2>
      <p className="mt-1 text-sm text-white/60">
        {t.languageStep.subtitle}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <CardOption
          title="English"
          desc="Continue in English"
          selected={value === "en"}
          onClick={() => onChange("en")}
          icon={Globe}
        />
        <CardOption
          title="Español"
          desc="Continuar en español"
          selected={value === "es"}
          onClick={() => onChange("es")}
          icon={Globe}
        />
        <CardOption
          title="Polski"
          desc="Kontynuuj po polsku"
          selected={value === "pl"}
          onClick={() => onChange("pl")}
          icon={Globe}
        />
      </div>
    </div>
  );
}

function StepBusiness({
  vertical,
  industry,
  language,
  onChange,
  t,
}: {
  vertical: VerticalCategory | null;
  industry: string;
  language: Language;
  onChange: (patch: Partial<Pick<ApplyForm, "vertical" | "industry">>) => void;
  t: typeof translations["en"];
}) {
  const selectedVertical = VERTICALS.find(v => v.id === vertical);

  return (
    <div>
      <h2 className="text-xl font-semibold">{t.businessStep.title}</h2>
      <p className="mt-1 text-sm text-white/60">
        {t.businessStep.subtitle}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {VERTICALS.map((v) => (
          <CardOption
            key={v.id}
            title={v.name[language]}
            desc={v.desc[language]}
            selected={vertical === v.id}
            onClick={() => onChange({ vertical: v.id, industry: "" })}
            icon={v.icon}
          />
        ))}
      </div>

      {/* Industry sub-selection */}
      {selectedVertical && (
        <div className="mt-6">
          <div className="text-sm text-white/70 mb-3">
            {language === "es" ? "¿Qué tipo específicamente?" : language === "pl" ? "Jaki konkretnie typ?" : "What type specifically?"}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedVertical.industries.map((ind) => (
              <button
                key={ind.id}
                onClick={() => onChange({ industry: ind.id })}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  industry === ind.id
                    ? "bg-[#FF6A00] text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {ind.name[language]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepLocation({
  cityZip,
  radiusMiles,
  onChange,
  t,
}: {
  cityZip: string;
  radiusMiles: number;
  onChange: (patch: Partial<Pick<ApplyForm, "cityZip" | "radiusMiles">>) => void;
  t: typeof translations["en"];
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{t.locationStep.title}</h2>
      <p className="mt-1 text-sm text-white/60">
        {t.locationStep.subtitle}
      </p>

      <div className="mt-5 grid gap-4">
        <label className="block">
          <div className="text-sm text-white/70">{t.locationStep.cityLabel}</div>
          <input
            value={cityZip}
            onChange={(e) => onChange({ cityZip: e.target.value })}
            placeholder={t.locationStep.cityPlaceholder}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-[#FF6A00] focus:outline-none transition"
          />
        </label>

        <label className="block">
          <div className="text-sm text-white/70">{t.locationStep.radiusLabel}</div>
          <div className="mt-2 flex items-center gap-4">
            <input
              type="range"
              min={5}
              max={50}
              value={radiusMiles}
              onChange={(e) => onChange({ radiusMiles: clamp(Number(e.target.value), 5, 50) })}
              className="flex-1 accent-[#FF6A00]"
            />
            <div className="w-16 text-center text-white font-medium">{radiusMiles} mi</div>
          </div>
        </label>
      </div>
    </div>
  );
}

function StepCadence({
  value,
  onChange,
  t,
  language,
}: {
  value: Cadence;
  onChange: (v: Cadence) => void;
  t: typeof translations["en"];
  language: Language;
}) {
  const cadenceLabels: Record<Cadence, Record<Language, { title: string; desc: string }>> = {
    LOW: {
      en: { title: "Low", desc: "1–2 posts/week. Stay visible without noise." },
      es: { title: "Bajo", desc: "1–2 publicaciones/semana. Mantente visible sin ruido." },
      pl: { title: "Niski", desc: "1–2 posty/tydzień. Bądź widoczny bez szumu." },
    },
    MEDIUM: {
      en: { title: "Medium", desc: "2–3 posts/week. Balanced, timely presence." },
      es: { title: "Medio", desc: "2–3 publicaciones/semana. Presencia equilibrada y oportuna." },
      pl: { title: "Średni", desc: "2–3 posty/tydzień. Zrównoważona, terminowa obecność." },
    },
    HIGH: {
      en: { title: "High", desc: "4–6 posts/week. High visibility during important moments." },
      es: { title: "Alto", desc: "4–6 publicaciones/semana. Alta visibilidad en momentos importantes." },
      pl: { title: "Wysoki", desc: "4–6 postów/tydzień. Wysoka widoczność w ważnych momentach." },
    },
  };

  return (
    <div>
      <h2 className="text-xl font-semibold">{t.cadenceStep.title}</h2>
      <p className="mt-1 text-sm text-white/60">
        {t.cadenceStep.subtitle}
      </p>

      <div className="mt-4 grid gap-3">
        {(["LOW", "MEDIUM", "HIGH"] as Cadence[]).map((c) => (
          <CardOption
            key={c}
            title={`${cadenceLabels[c][language].title} — ${formatMoney(CADENCE_MONTHLY[c])}/mo`}
            desc={cadenceLabels[c][language].desc}
            selected={value === c}
            onClick={() => onChange(c)}
            badge={c === "MEDIUM" ? (language === "es" ? "Recomendado" : language === "pl" ? "Zalecane" : "Recommended") : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function StepLayers({
  layers,
  onChange,
  t,
  language,
}: {
  layers: Layers;
  onChange: (l: Layers) => void;
  t: typeof translations["en"];
  language: Language;
}) {
  const layerLabels: Record<string, Record<Language, { title: string; desc: string }>> = {
    weather: {
      en: { title: "Weather", desc: "Always on. Storm alerts, temperature changes, seasonal shifts." },
      es: { title: "Clima", desc: "Siempre activo. Alertas de tormentas, cambios de temperatura, cambios estacionales." },
      pl: { title: "Pogoda", desc: "Zawsze włączone. Alerty burzowe, zmiany temperatury, zmiany sezonowe." },
    },
    sports: {
      en: { title: "Sports & Events", desc: "Game days, local events, community happenings." },
      es: { title: "Deportes y Eventos", desc: "Días de juego, eventos locales, acontecimientos comunitarios." },
      pl: { title: "Sport i Wydarzenia", desc: "Dni meczowe, lokalne wydarzenia, wydarzenia społeczne." },
    },
    community: {
      en: { title: "Community & Schools", desc: "School schedules, local news, neighborhood updates." },
      es: { title: "Comunidad y Escuelas", desc: "Horarios escolares, noticias locales, actualizaciones del vecindario." },
      pl: { title: "Społeczność i Szkoły", desc: "Harmonogramy szkolne, lokalne wiadomości, aktualizacje sąsiedztwa." },
    },
    trends: {
      en: { title: "Local Trends", desc: "Google Trends, local buzz, what people are searching for." },
      es: { title: "Tendencias Locales", desc: "Google Trends, tendencias locales, lo que la gente está buscando." },
      pl: { title: "Lokalne Trendy", desc: "Google Trends, lokalne trendy, czego ludzie szukają." },
    },
  };

  return (
    <div>
      <h2 className="text-xl font-semibold">{t.layersStep.title}</h2>
      <p className="mt-1 text-sm text-white/60">
        {t.layersStep.subtitle}
      </p>

      <div className="mt-4 space-y-3">
        {/* Weather - always on */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{layerLabels.weather[language].title}</span>
                <span className="rounded-full bg-[#1ED760]/20 text-[#1ED760] px-2 py-0.5 text-xs">
                  {language === "es" ? "Incluido" : language === "pl" ? "Wliczone" : "Included"}
                </span>
              </div>
              <div className="mt-1 text-sm text-white/60">{layerLabels.weather[language].desc}</div>
            </div>
            <div className="text-white/40">
              <Check className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Optional layers */}
        {(["sports", "community", "trends"] as const).map((key) => (
          <button
            key={key}
            onClick={() => onChange({ ...layers, [key]: !layers[key] })}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              layers[key]
                ? "border-[#FF6A00] bg-[#FF6A00]/10"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{layerLabels[key][language].title}</span>
                  <span className="text-sm text-white/50">+{formatMoney(LAYER_MONTHLY[key])}/mo</span>
                </div>
                <div className="mt-1 text-sm text-white/60">{layerLabels[key][language].desc}</div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                layers[key] ? "border-[#FF6A00] bg-[#FF6A00]" : "border-white/30"
              }`}>
                {layers[key] && <Check className="w-4 h-4 text-white" />}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepMode({
  value,
  onChange,
  t,
  language,
}: {
  value: Mode;
  onChange: (v: Mode) => void;
  t: typeof translations["en"];
  language: Language;
}) {
  const modeLabels: Record<Mode, Record<Language, { title: string; desc: string }>> = {
    AUTO: {
      en: { title: "Auto", desc: "Set it and forget it. We post when it makes sense." },
      es: { title: "Automático", desc: "Configúralo y olvídalo. Publicamos cuando tiene sentido." },
      pl: { title: "Automatyczny", desc: "Ustaw i zapomnij. Publikujemy, gdy ma to sens." },
    },
    GUIDED: {
      en: { title: "Guided", desc: "We advise, you decide. Preview and approve each post." },
      es: { title: "Guiado", desc: "Nosotros aconsejamos, tú decides. Vista previa y aprueba cada publicación." },
      pl: { title: "Prowadzony", desc: "My doradzamy, Ty decydujesz. Podgląd i zatwierdzenie każdego posta." },
    },
    CUSTOM: {
      en: { title: "Custom", desc: "Full control with guardrails. Edit, schedule, customize." },
      es: { title: "Personalizado", desc: "Control total con protecciones. Edita, programa, personaliza." },
      pl: { title: "Niestandardowy", desc: "Pełna kontrola z zabezpieczeniami. Edytuj, planuj, dostosowuj." },
    },
  };

  return (
    <div>
      <h2 className="text-xl font-semibold">{t.modeStep.title}</h2>
      <p className="mt-1 text-sm text-white/60">
        {t.modeStep.subtitle}
      </p>

      <div className="mt-4 grid gap-3">
        {(["AUTO", "GUIDED", "CUSTOM"] as Mode[]).map((m) => (
          <CardOption
            key={m}
            title={modeLabels[m][language].title}
            desc={modeLabels[m][language].desc}
            selected={value === m}
            onClick={() => onChange(m)}
            badge={m === "GUIDED" ? (language === "es" ? "Popular" : language === "pl" ? "Popularne" : "Popular") : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function StepTiming({
  value,
  onChange,
  t,
  language,
}: {
  value: StartTiming | null;
  onChange: (v: StartTiming) => void;
  t: typeof translations["en"];
  language: Language;
}) {
  const timingLabels: Record<StartTiming, Record<Language, { title: string; desc: string }>> = {
    NOW: {
      en: { title: "As soon as possible", desc: "We'll start building your website today." },
      es: { title: "Lo antes posible", desc: "Comenzaremos a construir tu sitio web hoy." },
      pl: { title: "Jak najszybciej", desc: "Zaczniemy budować Twoją stronę już dziś." },
    },
    TWO_WEEKS: {
      en: { title: "In the next 2 weeks", desc: "We'll reach out to schedule your kickoff." },
      es: { title: "En las próximas 2 semanas", desc: "Nos comunicaremos para programar tu inicio." },
      pl: { title: "W ciągu 2 tygodni", desc: "Skontaktujemy się, aby umówić rozpoczęcie." },
    },
    EXPLORING: {
      en: { title: "Just exploring", desc: "No pressure. We'll send you more info." },
      es: { title: "Solo explorando", desc: "Sin presión. Te enviaremos más información." },
      pl: { title: "Tylko rozglądam się", desc: "Bez presji. Wyślemy Ci więcej informacji." },
    },
  };

  return (
    <div>
      <h2 className="text-xl font-semibold">{t.timingStep.title}</h2>
      <p className="mt-1 text-sm text-white/60">
        {t.timingStep.subtitle}
      </p>

      <div className="mt-4 grid gap-3">
        {(["NOW", "TWO_WEEKS", "EXPLORING"] as StartTiming[]).map((timing) => (
          <CardOption
            key={timing}
            title={timingLabels[timing][language].title}
            desc={timingLabels[timing][language].desc}
            selected={value === timing}
            onClick={() => onChange(timing)}
          />
        ))}
      </div>
    </div>
  );
}

function StepContact({
  name,
  email,
  phone,
  onChange,
  t,
}: {
  name: string;
  email: string;
  phone: string;
  onChange: (patch: Partial<Pick<ApplyForm, "contactName" | "contactEmail" | "contactPhone">>) => void;
  t: typeof translations["en"];
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{t.contactStep.title}</h2>
      <p className="mt-1 text-sm text-white/60">
        {t.contactStep.subtitle}
      </p>

      <div className="mt-5 grid gap-4">
        <label className="block">
          <div className="text-sm text-white/70">{t.contactStep.nameLabel}</div>
          <input
            value={name}
            onChange={(e) => onChange({ contactName: e.target.value })}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-[#FF6A00] focus:outline-none transition"
          />
        </label>

        <label className="block">
          <div className="text-sm text-white/70">{t.contactStep.emailLabel}</div>
          <input
            type="email"
            value={email}
            onChange={(e) => onChange({ contactEmail: e.target.value })}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-[#FF6A00] focus:outline-none transition"
          />
        </label>

        <label className="block">
          <div className="text-sm text-white/70">{t.contactStep.phoneLabel}</div>
          <input
            type="tel"
            value={phone}
            onChange={(e) => onChange({ contactPhone: e.target.value })}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-[#FF6A00] focus:outline-none transition"
          />
        </label>
      </div>
    </div>
  );
}

function StepReview({
  form,
  pricing,
  termsAccepted,
  onToggleTerms,
  t,
  language,
}: {
  form: ApplyForm;
  pricing: ReturnType<typeof computePricing>;
  termsAccepted: boolean;
  onToggleTerms: (v: boolean) => void;
  t: typeof translations["en"];
  language: Language;
}) {
  const vertical = VERTICALS.find(v => v.id === form.vertical);
  const industry = vertical?.industries.find(i => i.id === form.industry);

  return (
    <div>
      <h2 className="text-xl font-semibold">{t.reviewStep.title}</h2>
      <p className="mt-1 text-sm text-white/60">
        {t.reviewStep.subtitle}
      </p>

      <div className="mt-5 space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/50 mb-2">
            {language === "es" ? "Negocio" : language === "pl" ? "Firma" : "Business"}
          </div>
          <div className="font-medium">{vertical?.name[language]}</div>
          {industry && <div className="text-sm text-white/60">{industry.name[language]}</div>}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/50 mb-2">
            {language === "es" ? "Ubicación" : language === "pl" ? "Lokalizacja" : "Location"}
          </div>
          <div className="font-medium">{form.cityZip}</div>
          <div className="text-sm text-white/60">{form.radiusMiles} mile radius</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/50 mb-2">
            {language === "es" ? "Contacto" : language === "pl" ? "Kontakt" : "Contact"}
          </div>
          <div className="font-medium">{form.contactName}</div>
          <div className="text-sm text-white/60">{form.contactEmail}</div>
          <div className="text-sm text-white/60">{form.contactPhone}</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/50 mb-2">
            {language === "es" ? "Precio" : language === "pl" ? "Cena" : "Pricing"}
          </div>
          <div className="flex justify-between">
            <span>{t.pricing.monthly}</span>
            <span className="font-medium">{formatMoney(pricing.monthlyTotal)}/mo</span>
          </div>
          <div className="flex justify-between text-sm text-white/60">
            <span>{t.pricing.setup}</span>
            <span>{formatMoney(pricing.setupFee)}</span>
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => onToggleTerms(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-white/30 bg-white/5 text-[#FF6A00] focus:ring-[#FF6A00]"
          />
          <span className="text-sm text-white/70">
            {t.reviewStep.termsLabel}
          </span>
        </label>
      </div>
    </div>
  );
}

function PricingRail({
  form,
  pricing,
  t,
  language,
}: {
  form: ApplyForm;
  pricing: ReturnType<typeof computePricing>;
  t: typeof translations["en"];
  language: Language;
}) {
  const vertical = VERTICALS.find(v => v.id === form.vertical);

  return (
    <div className="hidden lg:block">
      <div className="sticky top-24 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm text-white/50 mb-4">
          {language === "es" ? "Tu configuración" : language === "pl" ? "Twoja konfiguracja" : "Your configuration"}
        </div>

        <div className="space-y-3 text-sm">
          {vertical && (
            <div className="flex justify-between">
              <span className="text-white/70">{language === "es" ? "Negocio" : language === "pl" ? "Firma" : "Business"}</span>
              <span className="text-white">{vertical.name[language]}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-white/70">{t.pricing.cadence}</span>
            <span className="text-white">{form.cadence} — {formatMoney(pricing.cadenceMonthly)}/mo</span>
          </div>

          {pricing.enabledLayerKeys.length > 0 && (
            <div className="flex justify-between">
              <span className="text-white/70">{t.pricing.layers}</span>
              <span className="text-white">+{formatMoney(pricing.layersMonthly)}/mo</span>
            </div>
          )}

          <div className="border-t border-white/10 pt-3 mt-3">
            <div className="flex justify-between font-medium">
              <span>{t.pricing.monthly}</span>
              <span className="text-[#FF6A00]">{formatMoney(pricing.monthlyTotal)}/mo</span>
            </div>
            <div className="flex justify-between text-white/50 mt-1">
              <span>{t.pricing.setup}</span>
              <span>{formatMoney(pricing.setupFee)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <div className="w-2 h-2 rounded-full bg-[#1ED760]" />
            <span>{language === "es" ? "Precio de fundador bloqueado" : language === "pl" ? "Cena założycielska zablokowana" : "Founder pricing locked"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileSummaryBar({
  pricing,
  t,
}: {
  pricing: ReturnType<typeof computePricing>;
  t: typeof translations["en"];
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-[#151518] border-t border-white/10 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-white/50">{t.pricing.monthly}</div>
          <div className="text-lg font-semibold text-[#FF6A00]">{formatMoney(pricing.monthlyTotal)}/mo</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/50">{t.pricing.setup}</div>
          <div className="text-sm text-white/70">{formatMoney(pricing.setupFee)}</div>
        </div>
      </div>
    </div>
  );
}
