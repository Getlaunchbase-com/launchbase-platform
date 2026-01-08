export type Language = "en" | "es" | "pl";
export type Audience = "biz" | "org";

type HeroBlock = {
  h1: string;
  p: string;
  badge: string;
  ctaPrimary: string;
  ctaSecondary: string;
};

export const heroCopy: Record<Language, Record<Audience, HeroBlock>> = {
  en: {
    biz: {
      h1: "Stop carrying the system\nin your head.",
      p:
        "Your website exists. Your tools work. But no one owns the system.\n" +
        "LaunchBase takes ongoing responsibility — so you stop thinking about it.",
      badge: "See your real site before you pay. Always see what we're doing.",
      ctaPrimary: "Hand It Off",
      ctaSecondary: "See how it works",
    },
    org: {
      h1: "Stop coordinating everything\nyourself.",
      p:
        "Your team uses tools. Your processes exist. But ownership is fragmented.\n" +
        "LaunchBase becomes the system owner — execution without chaos.",
      badge: "Transparent execution. No lock-in. Full visibility.",
      ctaPrimary: "Streamline Operations",
      ctaSecondary: "See the system",
    },
  },

  es: {
    biz: {
      h1: "Deja de cargar el sistema\nen tu cabeza.",
      p:
        "Tu sitio web existe. Tus herramientas funcionan. Pero nadie es responsable del sistema.\n" +
        "LaunchBase asume la responsabilidad continua — para que dejes de pensar en ello.",
      badge: "Mira tu sitio real antes de pagar. Siempre ves lo que hacemos.",
      ctaPrimary: "Entrégalo",
      ctaSecondary: "Ver cómo funciona",
    },
    org: {
      h1: "Deja de coordinarlo todo\npor tu cuenta.",
      p:
        "Tu equipo usa herramientas. Tus procesos existen. Pero la responsabilidad está fragmentada.\n" +
        "LaunchBase se convierte en el dueño del sistema — ejecución sin fricción.",
      badge: "Ejecución transparente. Sin bloqueos. Visibilidad total.",
      ctaPrimary: "Optimizar Operaciones",
      ctaSecondary: "Ver el sistema",
    },
  },

  pl: {
    biz: {
      h1: "Przestań nosić cały system\nw swojej głowie.",
      p:
        "Twoja strona istnieje. Narzędzia działają. Ale nikt nie odpowiada za całość.\n" +
        "LaunchBase przejmuje stałą odpowiedzialność — żebyś nie musiał o tym myśleć.",
      badge: "Zobacz prawdziwą stronę przed zapłatą. Zawsze wiesz, co robimy.",
      ctaPrimary: "Przekaż to nam",
      ctaSecondary: "Zobacz jak to działa",
    },
    org: {
      h1: "Przestań wszystkim\nzarządzać samodzielnie.",
      p:
        "Zespół korzysta z narzędzi. Procesy istnieją. Ale odpowiedzialność jest rozproszona.\n" +
        "LaunchBase staje się właścicielem systemu — realizacja bez chaosu.",
      badge: "Pełna przejrzystość. Bez uzależnień. Pełna kontrola.",
      ctaPrimary: "Usprawnij operacje",
      ctaSecondary: "Zobacz system",
    },
  },
};
