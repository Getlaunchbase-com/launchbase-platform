import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { getLangFromUrlOrStorage, getAudienceFromUrlOrStorage, setLang, setAudience, type Audience } from "@/lib/prefs";
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

type StartTiming = "NOW" | "TWO_WEEKS" | "EXPLORING";
type InvolvementLevel = "HANDLE_IT" | "KEEP_ME_POSTED";

// What's weighing on them - burden categories
type BurdenCategory = 
  | "website"
  | "social_media"
  | "visibility"
  | "all_of_it"
  | "not_sure";

type ApplyForm = {
  audience: "biz" | "org";
  language: Language;
  websiteStatus: "none" | "existing" | "systems_only";
  vertical: VerticalCategory | null;
  industry: string;
  cityZip: string;
  radiusMiles: number;
  burdens: BurdenCategory[];
  involvement: InvolvementLevel;
  startTiming: StartTiming | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  termsAccepted: boolean;
};

const STORAGE_KEY = "launchbase_apply_draft_v3";

// Fixed founder pricing - no configuration needed
const FOUNDER_MONTHLY = 129;
const FOUNDER_SETUP = 249;

// Translations
const translations: Record<Language, {
  badge: string;
  title: string;
  subtitle: string;
  trustLine: string;
  formIntro: string;
  microCopy: { editLater: string; noPublish: string; approvalRequired: string };
  steps: { language: string; business: string; location: string; burden: string; involvement: string; start: string; contact: string; review: string };
  languageStep: { title: string; subtitle: string };
  websiteStatusOptions: { none: { title: string }; existing: { title: string }; systems_only: { title: string } };
  websiteStatusLabel: string;
  websiteStatusHelper: string;
  businessStep: { title: string; subtitle: string; websiteLabel: string };
  locationStep: { title: string; subtitle: string; cityLabel: string; cityPlaceholder: string; radiusLabel: string };
  burdenStep: { title: string; subtitle: string };
  involvementStep: { title: string; subtitle: string };
  timingStep: { title: string; subtitle: string };
  contactStep: { title: string; subtitle: string; nameLabel: string; emailLabel: string; phoneLabel: string };
  reviewStep: { title: string; subtitle: string; termsLabel: string; submitNote: string };
  buttons: { back: string; continue: string; submit: string };
  pricing: { monthly: string; setup: string; total: string; founderLocked: string };
}> = {
  en: {
    badge: "Founder pricing locks for 12 months",
    title: "You're not signing up for software.",
    subtitle: "You're handing off responsibility. LaunchBase is an operating system that builds your website, manages visibility, and stays on — so you don't have to.",
    trustLine: "See your real site before you pay. You can always see what LaunchBase is doing.",
    formIntro: "Answer naturally. You don't need perfect wording — LaunchBase translates intent into professional output.",
    microCopy: { editLater: "You can edit this later.", noPublish: "This does not publish anything.", approvalRequired: "Nothing goes live without approval." },
    steps: { language: "Language", business: "Business", location: "Location", burden: "Burden", involvement: "Involvement", start: "Start", contact: "Contact", review: "Review" },
    languageStep: { title: "Choose your language", subtitle: "Select the language you're most comfortable with. Your website will be built in English to reach local customers." },
    websiteStatusOptions: {
      systems_only: { title: "I already have a website — keep it, just integrate everything." },
      existing: { title: "Refresh my website — modernize it and integrate everything." },
      none: { title: "I need a new website — build it from scratch and integrate everything." },
    },
    websiteStatusLabel: "Which best describes your website situation?",
    websiteStatusHelper: "So we know whether to build, refresh, or just plug into what you already have.",
    businessStep: { title: "What type of business?", subtitle: "This helps us understand your business — not configure tools.", websiteLabel: "Website" },
    locationStep: { title: "Where are you located?", subtitle: "We'll use this to understand your local market.", cityLabel: "City or ZIP", cityPlaceholder: "e.g. Chicago, IL or 60614", radiusLabel: "Service radius (miles)" },
    burdenStep: { title: "What's weighing on you?", subtitle: "Select everything you don't want to think about anymore." },
    involvementStep: { title: "How involved do you want to be?", subtitle: "This is about communication, not control. You'll always have visibility." },
    timingStep: { title: "When do you want to start?", subtitle: "We'll build your website and set everything up." },
    contactStep: { title: "Contact information", subtitle: "We'll reach out to get started.", nameLabel: "Your name", emailLabel: "Email", phoneLabel: "Phone" },
    reviewStep: { title: "Review & apply", subtitle: "Make sure everything looks right.", termsLabel: "I agree to the Terms of Service and Privacy Policy", submitNote: "By applying, you're asking LaunchBase to take responsibility — safely and transparently." },
    buttons: { back: "Back", continue: "Continue", submit: "Hand It Off" },
    pricing: { monthly: "Monthly", setup: "One-time setup", total: "Total", founderLocked: "Founder pricing locked for 12 months" },
  },
  es: {
    badge: "Precio de fundador bloqueado por 12 meses",
    title: "No te estás registrando para un software.",
    subtitle: "Estás delegando responsabilidad. LaunchBase es un sistema operativo que construye tu sitio web, gestiona tu visibilidad y se mantiene activo — para que tú no tengas que hacerlo.",
    trustLine: "Ve tu sitio real antes de pagar. Siempre puedes ver lo que LaunchBase está haciendo.",
    formIntro: "Responde naturalmente. No necesitas palabras perfectas — LaunchBase traduce tu intención en resultados profesionales.",
    microCopy: { editLater: "Puedes editar esto después.", noPublish: "Esto no publica nada.", approvalRequired: "Nada sale en vivo sin tu aprobación." },
    steps: { language: "Idioma", business: "Negocio", location: "Ubicación", burden: "Carga", involvement: "Participación", start: "Inicio", contact: "Contacto", review: "Revisar" },
    languageStep: { title: "Elige tu idioma", subtitle: "Selecciona el idioma con el que te sientas más cómodo. Tu sitio web se construirá en inglés para llegar a clientes locales." },
    websiteStatusOptions: {
      systems_only: { title: "Ya tengo un sitio web — mantenlo y solo integra todo." },
      existing: { title: "Quiero renovar mi sitio web — modernízalo e integra todo." },
      none: { title: "Necesito un sitio web nuevo — créalo desde cero e integra todo." },
    },
    websiteStatusLabel: "¿Cuál describe mejor tu situación con tu sitio web?",
    websiteStatusHelper: "Así sabemos si hay que crear uno nuevo, renovarlo o simplemente integrarnos con el que ya tienes.",
    businessStep: { title: "¿Qué tipo de negocio?", subtitle: "Esto nos ayuda a entender tu negocio — no a configurar herramientas.", websiteLabel: "Sitio web" },
    locationStep: { title: "¿Dónde estás ubicado?", subtitle: "Usaremos esto para entender tu mercado local.", cityLabel: "Ciudad o código postal", cityPlaceholder: "ej. Chicago, IL o 60614", radiusLabel: "Radio de servicio (millas)" },
    burdenStep: { title: "¿Qué te está pesando?", subtitle: "Selecciona todo lo que no quieres pensar más." },
    involvementStep: { title: "¿Qué tan involucrado quieres estar?", subtitle: "Esto es sobre comunicación, no control. Siempre tendrás visibilidad." },
    timingStep: { title: "¿Cuándo quieres empezar?", subtitle: "Construiremos tu sitio web y configuraremos todo." },
    contactStep: { title: "Información de contacto", subtitle: "Nos comunicaremos para comenzar.", nameLabel: "Tu nombre", emailLabel: "Correo electrónico", phoneLabel: "Teléfono" },
    reviewStep: { title: "Revisar y aplicar", subtitle: "Asegúrate de que todo se vea bien.", termsLabel: "Acepto los Términos de Servicio y la Política de Privacidad", submitNote: "Al aplicar, estás pidiendo a LaunchBase que asuma la responsabilidad — de forma segura y transparente." },
    buttons: { back: "Atrás", continue: "Continuar", submit: "Delegar" },
    pricing: { monthly: "Mensual", setup: "Configuración única", total: "Total", founderLocked: "Precio de fundador bloqueado por 12 meses" },
  },
  pl: {
    badge: "Cena założycielska zablokowana na 12 miesięcy",
    title: "Nie rejestrujesz się na oprogramowanie.",
    subtitle: "Przekazujesz odpowiedzialność. LaunchBase to system operacyjny, który buduje Twoją stronę, zarządza widocznością i działa — abyś Ty nie musiał.",
    trustLine: "Zobacz swoją prawdziwą stronę przed płatnością. Zawsze możesz zobaczyć, co robi LaunchBase.",
    formIntro: "Odpowiadaj naturalnie. Nie potrzebujesz idealnych słów — LaunchBase przekłada intencję na profesjonalne rezultaty.",
    microCopy: { editLater: "Możesz to edytować później.", noPublish: "To nic nie publikuje.", approvalRequired: "Nic nie zostanie opublikowane bez Twojej zgody." },
    steps: { language: "Język", business: "Firma", location: "Lokalizacja", burden: "Obciążenie", involvement: "Zaangażowanie", start: "Start", contact: "Kontakt", review: "Przegląd" },
    languageStep: { title: "Wybierz swój język", subtitle: "Wybierz język, w którym czujesz się najlepiej. Twoja strona internetowa zostanie zbudowana po angielsku, aby dotrzeć do lokalnych klientów." },
    websiteStatusOptions: {
      systems_only: { title: "Mam już stronę — zostaw ją i po prostu zintegruj wszystko." },
      existing: { title: "Chcę odświeżyć stronę — unowocześnij ją i zintegruj wszystko." },
      none: { title: "Potrzebuję nowej strony — zbuduj ją od zera i zintegruj wszystko." },
    },
    websiteStatusLabel: "Która opcja najlepiej opisuje Twoją sytuację ze stroną internetową?",
    websiteStatusHelper: "Dzięki temu wiemy, czy mamy zbudować stronę od zera, odświeżyć obecną, czy tylko podłączyć integracje.",
    businessStep: { title: "Jaki typ firmy?", subtitle: "To pomaga nam zrozumieć Twoją firmę — nie konfigurować narzędzia.", websiteLabel: "Strona" },
    locationStep: { title: "Gdzie jesteś zlokalizowany?", subtitle: "Użyjemy tego, aby zrozumieć Twój lokalny rynek.", cityLabel: "Miasto lub kod pocztowy", cityPlaceholder: "np. Chicago, IL lub 60614", radiusLabel: "Promień usług (mile)" },
    burdenStep: { title: "Co Cię obciąża?", subtitle: "Wybierz wszystko, o czym nie chcesz już myśleć." },
    involvementStep: { title: "Jak bardzo chcesz być zaangażowany?", subtitle: "Chodzi o komunikację, nie kontrolę. Zawsze będziesz mieć wgląd." },
    timingStep: { title: "Kiedy chcesz zacząć?", subtitle: "Zbudujemy Twoją stronę i wszystko skonfigurujemy." },
    contactStep: { title: "Informacje kontaktowe", subtitle: "Skontaktujemy się, aby rozpocząć.", nameLabel: "Twoje imię", emailLabel: "Email", phoneLabel: "Telefon" },
    reviewStep: { title: "Przegląd i aplikacja", subtitle: "Upewnij się, że wszystko wygląda dobrze.", termsLabel: "Zgadzam się z Warunkami Usługi i Polityką Prywatności", submitNote: "Aplikując, prosisz LaunchBase o przejęcie odpowiedzialności — bezpiecznie i przejrzyście." },
    buttons: { back: "Wstecz", continue: "Kontynuuj", submit: "Przekaż" },
    pricing: { monthly: "Miesięcznie", setup: "Jednorazowa konfiguracja", total: "Razem", founderLocked: "Cena założycielska zablokowana na 12 miesięcy" },
  },
};

// Burden options with translations
const BURDEN_OPTIONS: { id: BurdenCategory; name: Record<Language, string>; desc: Record<Language, string> }[] = [
  {
    id: "website",
    name: { en: "My website", es: "Mi sitio web", pl: "Moja strona" },
    desc: { en: "Building it, updating it, making sure it works", es: "Construirlo, actualizarlo, asegurar que funcione", pl: "Budowanie, aktualizowanie, upewnianie się że działa" },
  },
  {
    id: "social_media",
    name: { en: "Social media", es: "Redes sociales", pl: "Media społecznościowe" },
    desc: { en: "Posting, scheduling, staying consistent", es: "Publicar, programar, mantener consistencia", pl: "Publikowanie, planowanie, utrzymanie spójności" },
  },
  {
    id: "visibility",
    name: { en: "Being visible locally", es: "Ser visible localmente", pl: "Bycie widocznym lokalnie" },
    desc: { en: "Getting found, staying relevant, reaching customers", es: "Ser encontrado, mantenerse relevante, llegar a clientes", pl: "Bycie znajdowanym, pozostawanie istotnym, docieranie do klientów" },
  },
  {
    id: "all_of_it",
    name: { en: "All of it", es: "Todo", pl: "Wszystko" },
    desc: { en: "I just want it handled", es: "Solo quiero que se encarguen", pl: "Po prostu chcę, żeby to było załatwione" },
  },
  {
    id: "not_sure",
    name: { en: "I'm not sure — it's just heavy", es: "No estoy seguro — solo es pesado", pl: "Nie jestem pewien — po prostu jest ciężko" },
    desc: { en: "That's okay. We'll figure it out together.", es: "Está bien. Lo resolveremos juntos.", pl: "W porządku. Rozwiążemy to razem." },
  },
];

// Involvement options with translations
const INVOLVEMENT_OPTIONS: { id: InvolvementLevel; name: Record<Language, string>; desc: Record<Language, string> }[] = [
  {
    id: "HANDLE_IT",
    name: { en: "Handle it for me", es: "Encárgate por mí", pl: "Zajmij się tym za mnie" },
    desc: { en: "I trust LaunchBase to make good decisions. Just keep me safe.", es: "Confío en que LaunchBase tome buenas decisiones. Solo mantenme seguro.", pl: "Ufam, że LaunchBase podejmie dobre decyzje. Po prostu dbaj o moje bezpieczeństwo." },
  },
  {
    id: "KEEP_ME_POSTED",
    name: { en: "Keep me in the loop", es: "Mantenme informado", pl: "Informuj mnie na bieżąco" },
    desc: { en: "I want to see what's happening, but I don't need to approve everything.", es: "Quiero ver lo que está pasando, pero no necesito aprobar todo.", pl: "Chcę widzieć co się dzieje, ale nie muszę wszystkiego zatwierdzać." },
  },
];

// Vertical categories with icons and descriptions
const VERTICALS: { id: VerticalCategory; icon: typeof Wrench; name: Record<Language, string>; desc: Record<Language, string>; industries: { id: string; name: Record<Language, string> }[] }[] = [
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
      { id: "mental_health", name: { en: "Mental Health", es: "Salud Mental", pl: "Zdrowie Psychiczne" } },
      { id: "optometry", name: { en: "Optometry", es: "Optometría", pl: "Optometria" } },
    ],
  },
  {
    id: "beauty",
    icon: Scissors,
    name: { en: "Beauty & Personal Care", es: "Belleza y Cuidado Personal", pl: "Uroda i Pielęgnacja" },
    desc: { en: "Hair salons, barbershops, nail salons, spas", es: "Salones de belleza, barberías, salones de uñas, spas", pl: "Salony fryzjerskie, barbershopy, salony paznokci, spa" },
    industries: [
      { id: "hair_salon", name: { en: "Hair Salon", es: "Salón de Belleza", pl: "Salon Fryzjerski" } },
      { id: "barbershop", name: { en: "Barbershop", es: "Barbería", pl: "Barbershop" } },
      { id: "nail_salon", name: { en: "Nail Salon", es: "Salón de Uñas", pl: "Salon Paznokci" } },
      { id: "spa", name: { en: "Spa", es: "Spa", pl: "Spa" } },
      { id: "esthetics", name: { en: "Esthetics", es: "Estética", pl: "Estetyka" } },
    ],
  },
  {
    id: "food",
    icon: UtensilsCrossed,
    name: { en: "Food & Beverage", es: "Alimentos y Bebidas", pl: "Gastronomia" },
    desc: { en: "Restaurants, cafes, bakeries, food trucks", es: "Restaurantes, cafeterías, panaderías, food trucks", pl: "Restauracje, kawiarnie, piekarnie, food trucki" },
    industries: [
      { id: "restaurant", name: { en: "Restaurant", es: "Restaurante", pl: "Restauracja" } },
      { id: "cafe", name: { en: "Cafe", es: "Cafetería", pl: "Kawiarnia" } },
      { id: "bakery", name: { en: "Bakery", es: "Panadería", pl: "Piekarnia" } },
      { id: "food_truck", name: { en: "Food Truck", es: "Food Truck", pl: "Food Truck" } },
      { id: "catering", name: { en: "Catering", es: "Catering", pl: "Catering" } },
    ],
  },
  {
    id: "cannabis",
    icon: Leaf,
    name: { en: "Cannabis", es: "Cannabis", pl: "Konopie" },
    desc: { en: "Dispensaries, delivery services, cultivation", es: "Dispensarios, servicios de entrega, cultivo", pl: "Apteki, usługi dostawy, uprawa" },
    industries: [
      { id: "dispensary", name: { en: "Dispensary", es: "Dispensario", pl: "Apteka" } },
      { id: "delivery", name: { en: "Delivery Service", es: "Servicio de Entrega", pl: "Usługa Dostawy" } },
      { id: "cultivation", name: { en: "Cultivation", es: "Cultivo", pl: "Uprawa" } },
    ],
  },
  {
    id: "professional",
    icon: Briefcase,
    name: { en: "Professional Services", es: "Servicios Profesionales", pl: "Usługi Profesjonalne" },
    desc: { en: "Law firms, accountants, consultants, real estate", es: "Bufetes de abogados, contadores, consultores, bienes raíces", pl: "Kancelarie prawne, księgowi, konsultanci, nieruchomości" },
    industries: [
      { id: "law_firm", name: { en: "Law Firm", es: "Bufete de Abogados", pl: "Kancelaria Prawna" } },
      { id: "accountant", name: { en: "Accountant", es: "Contador", pl: "Księgowy" } },
      { id: "consultant", name: { en: "Consultant", es: "Consultor", pl: "Konsultant" } },
      { id: "real_estate", name: { en: "Real Estate", es: "Bienes Raíces", pl: "Nieruchomości" } },
      { id: "insurance", name: { en: "Insurance", es: "Seguros", pl: "Ubezpieczenia" } },
    ],
  },
  {
    id: "fitness",
    icon: Dumbbell,
    name: { en: "Fitness & Recreation", es: "Fitness y Recreación", pl: "Fitness i Rekreacja" },
    desc: { en: "Gyms, personal trainers, yoga studios, sports facilities", es: "Gimnasios, entrenadores personales, estudios de yoga, instalaciones deportivas", pl: "Siłownie, trenerzy personalni, studia jogi, obiekty sportowe" },
    industries: [
      { id: "gym", name: { en: "Gym", es: "Gimnasio", pl: "Siłownia" } },
      { id: "personal_trainer", name: { en: "Personal Trainer", es: "Entrenador Personal", pl: "Trener Personalny" } },
      { id: "yoga_studio", name: { en: "Yoga Studio", es: "Estudio de Yoga", pl: "Studio Jogi" } },
      { id: "martial_arts", name: { en: "Martial Arts", es: "Artes Marciales", pl: "Sztuki Walki" } },
      { id: "dance_studio", name: { en: "Dance Studio", es: "Estudio de Baile", pl: "Studio Tańca" } },
    ],
  },
  {
    id: "automotive",
    icon: Car,
    name: { en: "Automotive", es: "Automotriz", pl: "Motoryzacja" },
    desc: { en: "Auto repair, detailing, dealerships, towing", es: "Reparación de autos, detallado, concesionarios, grúas", pl: "Naprawa samochodów, detailing, salony, holowanie" },
    industries: [
      { id: "auto_repair", name: { en: "Auto Repair", es: "Reparación de Autos", pl: "Naprawa Samochodów" } },
      { id: "detailing", name: { en: "Detailing", es: "Detallado", pl: "Detailing" } },
      { id: "dealership", name: { en: "Dealership", es: "Concesionario", pl: "Salon" } },
      { id: "towing", name: { en: "Towing", es: "Grúa", pl: "Holowanie" } },
      { id: "tire_shop", name: { en: "Tire Shop", es: "Tienda de Llantas", pl: "Sklep Opon" } },
    ],
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const steps = [
  { id: "language", label: "language" },
  { id: "business", label: "business" },
  { id: "location", label: "location" },
  { id: "burden", label: "burden" },
  { id: "involvement", label: "involvement" },
  { id: "timing", label: "start" },
  { id: "contact", label: "contact" },
  { id: "review", label: "review" },
] as const;

type StepId = (typeof steps)[number]["id"];

export default function ApplyPage() {
  // Read language and audience from URL or localStorage
  const preferredLang = getLangFromUrlOrStorage();
  const preferredAudience = getAudienceFromUrlOrStorage();

  const [stepIndex, setStepIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState<ApplyForm>(() => {
    const base: ApplyForm = {
      audience: "biz",
      language: "en",
      websiteStatus: "none",
      vertical: null,
      industry: "",
      cityZip: "",
      radiusMiles: 15,
      burdens: [],
      involvement: "HANDLE_IT",
      startTiming: null,
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      termsAccepted: false,
    };

    if (typeof window === "undefined") return base;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        return {
          ...base,
          ...parsed,
          // 🔒 FOREVER DEFAULT
          audience: parsed?.audience === "org" ? "org" : "biz",
        };
      }
    } catch {
      // ignore corrupted storage
    }

    // Initialize from homepage prefs if no saved draft
    return {
      ...base,
      language: preferredLang as Language,
      audience: preferredAudience,
    };
  });

  const t = translations[form.language];
  const currentStep = steps[stepIndex].id;

  // Persist draft
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {}
  }, [form]);

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
      case "burden":
        return form.burdens.length > 0;
      case "involvement":
        return !!form.involvement;
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
    
    // Map burden-based form to backend structure
    // The backend will determine the appropriate configuration based on burdens
    submitMutation.mutate({
      language: form.language,
      audience: form.audience,
      websiteStatus: form.websiteStatus,
      vertical: form.vertical,
      industry: form.industry,
      location: { cityZip: form.cityZip.trim(), radiusMiles: form.radiusMiles },
      module: {
        name: "SOCIAL_MEDIA_INTELLIGENCE" as const,
        cadence: "MEDIUM", // Default - system determines optimal
        mode: form.involvement === "HANDLE_IT" ? "AUTO" : "GUIDED",
        layers: { weather: true, sports: true, community: true, trends: true }, // All layers included
      },
      startTiming: form.startTiming,
      contact: {
        name: form.contactName.trim(),
        email: form.contactEmail.trim(),
        phone: form.contactPhone.trim(),
      },
      pricing: {
        cadenceMonthly: FOUNDER_MONTHLY,
        layersMonthly: 0,
        monthlyTotal: FOUNDER_MONTHLY,
        setupFee: FOUNDER_SETUP,
        enabledLayers: ["sports", "community", "trends"],
      },
      termsAccepted: form.termsAccepted as true,
      // Additional burden data for internal use
      burdens: form.burdens,
      involvement: form.involvement,
    });
  }

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to home</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {/* Language Toggle */}
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-400" />
              <select
                value={form.language}
                onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value as Language }))}
                className="bg-transparent border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#FF6A00]/50 cursor-pointer"
              >
                <option value="en" className="bg-[#0B0B0C]">EN</option>
                <option value="es" className="bg-[#0B0B0C]">ES</option>
                <option value="pl" className="bg-[#0B0B0C]">PL</option>
              </select>
            </div>
            
            <div className="text-sm text-[#FF6A00]">{t.badge}</div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-20 pb-32 lg:pb-20">
        <div className="container max-w-6xl mx-auto px-4">
          {/* Header Section */}
          <div className="max-w-2xl mx-auto text-center py-8">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">
              {t.title}
            </h1>
            <p className="mt-4 text-lg text-gray-400">
              {t.subtitle}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FF6A00]/10 border border-[#FF6A00]/30 px-4 py-2 text-sm text-[#FF6A00]">
              <Check className="w-4 h-4" />
              {t.trustLine}
            </div>
          </div>

          {/* Form Section */}
          <div className="grid lg:grid-cols-[1fr,320px] gap-8 max-w-5xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
              {/* Stepper */}
              <Stepper stepIndex={stepIndex} onGoto={gotoStep} language={form.language} />

              {/* Form Intro */}
              <div className="mt-6 text-sm text-white/50">
                {t.formIntro}
              </div>

              {/* Step Content */}
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
                    websiteStatus={form.websiteStatus}
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

                {currentStep === "burden" && (
                  <StepBurden
                    burdens={form.burdens}
                    onChange={(b) => setForm((f) => ({ ...f, burdens: b }))}
                    t={t}
                    language={form.language}
                  />
                )}

                {currentStep === "involvement" && (
                  <StepInvolvement
                    value={form.involvement}
                    onChange={(v) => setForm((f) => ({ ...f, involvement: v }))}
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
            <PricingRail t={t} language={form.language} />
          </div>
        </div>
      </div>

      {/* Mobile Summary Bar */}
      <MobileSummaryBar t={t} />
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
  websiteStatus,
  vertical,
  industry,
  language,
  onChange,
  t,
}: {
  websiteStatus: "none" | "existing" | "systems_only";
  vertical: VerticalCategory | null;
  industry: string;
  language: Language;
  onChange: (patch: Partial<Pick<ApplyForm, "websiteStatus" | "vertical" | "industry">>) => void;
  t: typeof translations["en"];
}) {
  const selectedVertical = VERTICALS.find(v => v.id === vertical);

  return (
    <div>
      {/* Website Status Section */}
      <div className="mb-8 pb-8 border-b border-white/10">
        <h3 className="text-base font-semibold mb-1">{t.websiteStatusLabel}</h3>
        <p className="text-sm text-white/60 mb-4">{t.websiteStatusHelper}</p>
        <div className="grid gap-3">
          {(Object.keys(t.websiteStatusOptions) as Array<keyof typeof t.websiteStatusOptions>).map((key) => {
            const option = t.websiteStatusOptions[key];
            return (
              <CardOption
                key={key}
                title={option.title}
                selected={websiteStatus === key}
                onClick={() => onChange({ websiteStatus: key as "none" | "existing" | "systems_only" })}
              />
            );
          })}
        </div>
      </div>

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

function StepBurden({
  burdens,
  onChange,
  t,
  language,
}: {
  burdens: BurdenCategory[];
  onChange: (b: BurdenCategory[]) => void;
  t: typeof translations["en"];
  language: Language;
}) {
  const toggleBurden = (id: BurdenCategory) => {
    // If selecting "all_of_it" or "not_sure", clear others and select only that
    if (id === "all_of_it" || id === "not_sure") {
      if (burdens.includes(id)) {
        onChange([]);
      } else {
        onChange([id]);
      }
      return;
    }
    
    // If selecting a specific burden, remove "all_of_it" and "not_sure"
    const filtered = burdens.filter(b => b !== "all_of_it" && b !== "not_sure");
    
    if (filtered.includes(id)) {
      onChange(filtered.filter(b => b !== id));
    } else {
      onChange([...filtered, id]);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold">{t.burdenStep.title}</h2>
      <p className="mt-1 text-sm text-white/60">
        {t.burdenStep.subtitle}
      </p>

      <div className="mt-4 space-y-3">
        {BURDEN_OPTIONS.map((option) => {
          const isSelected = burdens.includes(option.id);
          const isExclusive = option.id === "all_of_it" || option.id === "not_sure";
          
          return (
            <button
              key={option.id}
              onClick={() => toggleBurden(option.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? "border-[#FF6A00] bg-[#FF6A00]/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              } ${isExclusive ? "mt-4 border-dashed" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{option.name[language]}</div>
                  <div className="mt-1 text-sm text-white/60">{option.desc[language]}</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                  isSelected ? "border-[#FF6A00] bg-[#FF6A00]" : "border-white/30"
                }`}>
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepInvolvement({
  value,
  onChange,
  t,
  language,
}: {
  value: InvolvementLevel;
  onChange: (v: InvolvementLevel) => void;
  t: typeof translations["en"];
  language: Language;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{t.involvementStep.title}</h2>
      <p className="mt-1 text-sm text-white/60">
        {t.involvementStep.subtitle}
      </p>

      <div className="mt-4 grid gap-3">
        {INVOLVEMENT_OPTIONS.map((option) => (
          <CardOption
            key={option.id}
            title={option.name[language]}
            desc={option.desc[language]}
            selected={value === option.id}
            onClick={() => onChange(option.id)}
            badge={option.id === "HANDLE_IT" ? (language === "es" ? "Recomendado" : language === "pl" ? "Zalecane" : "Recommended") : undefined}
          />
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-white/5 border border-white/10 p-4">
        <p className="text-sm text-white/60">
          {language === "es" 
            ? "Independientemente de lo que elijas, siempre podrás ver lo que LaunchBase está haciendo. La no-acción siempre es segura. El cambio es reversible."
            : language === "pl"
            ? "Niezależnie od wyboru, zawsze będziesz mógł zobaczyć, co robi LaunchBase. Brak działania jest zawsze bezpieczny. Zmiana jest odwracalna."
            : "Regardless of what you choose, you'll always be able to see what LaunchBase is doing. Non-action is always safe. Change is reversible."
          }
        </p>
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
  termsAccepted,
  onToggleTerms,
  t,
  language,
}: {
  form: ApplyForm;
  termsAccepted: boolean;
  onToggleTerms: (v: boolean) => void;
  t: typeof translations["en"];
  language: Language;
}) {
  const vertical = VERTICALS.find(v => v.id === form.vertical);
  const industry = vertical?.industries.find(i => i.id === form.industry);
  
  // Get burden labels
  const burdenLabels = form.burdens.map(b => {
    const option = BURDEN_OPTIONS.find(o => o.id === b);
    return option?.name[language] || b;
  });

  // Get involvement label
  const involvementLabel = INVOLVEMENT_OPTIONS.find(o => o.id === form.involvement)?.name[language];

  return (
    <div>
      <h2 className="text-xl font-semibold">{t.reviewStep.title}</h2>
      <p className="mt-1 text-sm text-white/60">
        {t.reviewStep.subtitle}
      </p>

      <div className="mt-5 space-y-4">
        {/* Business */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/50 mb-2">
            {language === "es" ? "Negocio" : language === "pl" ? "Firma" : "Business"}
          </div>
          <div className="font-medium">{vertical?.name[language]}</div>
          {industry && <div className="text-sm text-white/60">{industry.name[language]}</div>}
        </div>

        {/* Location */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/50 mb-2">
            {language === "es" ? "Ubicación" : language === "pl" ? "Lokalizacja" : "Location"}
          </div>
          <div className="font-medium">{form.cityZip}</div>
          <div className="text-sm text-white/60">{form.radiusMiles} mile radius</div>
        </div>

        {/* What you're handing off */}
        <div className="rounded-xl border border-[#FF6A00]/30 bg-[#FF6A00]/5 p-4">
          <div className="text-sm text-[#FF6A00]/70 mb-2">
            {language === "es" ? "Lo que estás delegando" : language === "pl" ? "Co przekazujesz" : "What you're handing off"}
          </div>
          <div className="font-medium">{burdenLabels.join(", ")}</div>
          <div className="mt-2 text-sm text-white/60">
            {involvementLabel}
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/50 mb-2">
            {language === "es" ? "Contacto" : language === "pl" ? "Kontakt" : "Contact"}
          </div>
          <div className="font-medium">{form.contactName}</div>
          <div className="text-sm text-white/60">{form.contactEmail}</div>
          <div className="text-sm text-white/60">{form.contactPhone}</div>
        </div>

        {/* Pricing */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/50 mb-2">
            {language === "es" ? "Precio de fundador" : language === "pl" ? "Cena założycielska" : "Founder pricing"}
          </div>
          <div className="flex justify-between">
            <span>{t.pricing.monthly}</span>
            <span className="font-medium text-[#FF6A00]">${FOUNDER_MONTHLY}/mo</span>
          </div>
          <div className="flex justify-between text-sm text-white/60">
            <span>{t.pricing.setup}</span>
            <span>${FOUNDER_SETUP}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50">
            {t.pricing.founderLocked}
          </div>
        </div>

        {/* Terms */}
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

        {/* Submit note */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <p className="text-sm text-white/60">
            {t.reviewStep.submitNote}
          </p>
        </div>
      </div>
    </div>
  );
}

function PricingRail({
  t,
  language,
}: {
  t: typeof translations["en"];
  language: Language;
}) {
  return (
    <div className="hidden lg:block">
      <div className="sticky top-24 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm text-white/50 mb-4">
          {language === "es" ? "Precio de fundador" : language === "pl" ? "Cena założycielska" : "Founder pricing"}
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-white/70">{t.pricing.monthly}</span>
            <span className="text-[#FF6A00] font-semibold">${FOUNDER_MONTHLY}/mo</span>
          </div>

          <div className="flex justify-between">
            <span className="text-white/70">{t.pricing.setup}</span>
            <span className="text-white">${FOUNDER_SETUP}</span>
          </div>

          <div className="border-t border-white/10 pt-3 mt-3">
            <div className="text-xs text-white/50">
              {language === "es" 
                ? "Incluye todo: sitio web, visibilidad, monitoreo continuo"
                : language === "pl"
                ? "Zawiera wszystko: stronę, widoczność, ciągłe monitorowanie"
                : "Includes everything: website, visibility, ongoing monitoring"
              }
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <div className="w-2 h-2 rounded-full bg-[#1ED760]" />
            <span>{t.pricing.founderLocked}</span>
          </div>
        </div>

        {/* Trust elements */}
        <div className="mt-6 space-y-2 text-xs text-white/40">
          <div className="flex items-center gap-2">
            <Check className="w-3 h-3 text-[#1ED760]" />
            <span>{language === "es" ? "Ve tu sitio antes de pagar" : language === "pl" ? "Zobacz stronę przed płatnością" : "See your site before you pay"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-3 h-3 text-[#1ED760]" />
            <span>{language === "es" ? "Nada sale sin tu aprobación" : language === "pl" ? "Nic nie wychodzi bez zgody" : "Nothing goes live without approval"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-3 h-3 text-[#1ED760]" />
            <span>{language === "es" ? "Siempre visible, siempre seguro" : language === "pl" ? "Zawsze widoczne, zawsze bezpieczne" : "Always visible, always safe"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileSummaryBar({
  t,
}: {
  t: typeof translations["en"];
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-[#151518] border-t border-white/10 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-white/50">{t.pricing.monthly}</div>
          <div className="text-lg font-semibold text-[#FF6A00]">${FOUNDER_MONTHLY}/mo</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/50">{t.pricing.setup}</div>
          <div className="text-sm text-white/70">${FOUNDER_SETUP}</div>
        </div>
      </div>
    </div>
  );
}
