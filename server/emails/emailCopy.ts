/**
 * LaunchBase Email Copy Map
 * Single source of truth for all customer-facing email content
 * Supports: EN, ES, PL × Business, Organization
 */

export type Language = "en" | "es" | "pl";
export type Audience = "biz" | "org";
export type WebsiteStatus = "none" | "existing" | "systems_only";

export type EmailType =
  | "intake_confirmation"
  | "in_progress"
  | "ready_for_review"
  | "review_nudge"
  | "deployment_started"
  | "site_live"
  | "preview_followup"
  | "testimonial_request"
  | "founding_client_lockin"
  | "founder_welcome"
  | "day7_checkin"
  | "day30_value"
  | "contact_form_confirmation"
  | "ops_alert";

interface EmailBlock {
  subject: string;
  previewText: string;
  body: string;
}

// Helper type for emails that vary by websiteStatus
type WebsiteStatusVariants<T> = {
  none: T;
  existing: T;
  systems_only: T;
};

// Union type for either normal email block or variant block
type EmailBlockOrVariants = EmailBlock | WebsiteStatusVariants<EmailBlock>;

// Email copy map - some emails have variants, others don't
type EmailCopyMap = Record<Language, Record<Audience, Record<EmailType, EmailBlockOrVariants>>>;

// websiteStatus controls messaging ONLY.
// Pricing, eligibility, and cadence are invariant.
// This prevents expectation drift without fragmenting the product.

export const emailCopy: EmailCopyMap = {
  en: {
    biz: {
      intake_confirmation: {
        none: {
          subject: "We're building your site from scratch — here's the plan",
          previewText: "Your LaunchBase site is officially in progress.",
          body: `Hi {{firstName}},

Thanks for completing your LaunchBase intake.

You don't currently have a website — so we'll be building one from scratch, then integrating everything needed to run it smoothly.

Here's what happens next:

• We design and build your website
• We connect the systems it needs (forms, tracking, posting, etc.)
• A real human reviews everything for quality
• You receive a private preview link to review and approve

No payment is required to review your site.

Once you approve, we'll handle deployment and ongoing updates so you don't have to think about it.

Estimated turnaround: 24–72 hours

If you have questions at any point, just reply to this email.

—
LaunchBase
The operating system for running your business`,
        },
        existing: {
          subject: "We're refreshing your site — next steps inside",
          previewText: "We'll refresh and modernize your existing site.",
          body: `Hi {{firstName}},

Thanks for completing your LaunchBase intake.

You already have a website — so our job is to refresh and modernize it, then integrate the systems that keep it running smoothly.

What we'll do next:

• Review your existing site
• Update structure, clarity, and flow where needed
• Integrate the systems behind it (forms, tracking, posting, etc.)
• Have a human review everything before you see it

You'll receive a private preview link to review and approve before anything goes live.

No payment is required to review.

Estimated turnaround: 24–72 hours

If you want us to preserve or avoid anything specific from your current site, just reply here.

—
LaunchBase
The operating system for running your business`,
        },
        systems_only: {
          subject: "We'll integrate your existing site — here's what happens next",
          previewText: "We'll integrate systems without changing your site design.",
          body: `Hi {{firstName}},

Thanks for completing your LaunchBase intake.

You already have a website you want to keep — so we'll leave the site itself alone and focus on integrating the systems around it.

Here's what happens next:

• We review how your current site works
• We connect the systems it needs (forms, tracking, posting, etc.)
• We verify everything works cleanly together
• A human reviews it before you see the result

You'll receive a preview link showing how everything connects — without changing your site's design.

No payment is required to review.

Estimated turnaround: 24–72 hours

If there's anything specific we should not touch, reply and let us know.

—
LaunchBase
The operating system for running your business`,
        },
      },
      in_progress: {
        subject: "👷 Your site is in progress",
        previewText: "Just a quick update — everything is on track.",
        body: `Hi {{firstName}},

Just a quick update — your website is currently being built.

Nothing is needed from you right now. We're assembling the layout, copy, and features based on your intake and reviewing everything before it's ready.

You'll receive another email as soon as your preview is available.

—
LaunchBase`,
      },
      ready_for_review: {
        subject: "Your site preview is ready",
        previewText: "Nothing is published yet — review your preview and let us know.",
        body: `Hi {{firstName}},

Your LaunchBase preview is ready to review.

Nothing is published yet — this is your chance to confirm everything looks right.

👉 Review your preview:
{{previewUrl}}

If you want changes, reply to this email and we'll adjust it before launch.

—
LaunchBase
Workflows that give you back your life.`,
      },
      review_nudge: {
        subject: "Just checking in — your site is ready",
        previewText: "No rush, just making sure you saw it.",
        body: `Hi {{firstName}},

Just checking in to make sure you saw your site preview.

👉 {{previewUrl}}

There's no rush — we just want to be sure everything looks right before launch.

If you have questions or want changes, reply here and we'll take care of it.

—
LaunchBase`,
      },
      deployment_started: {
        subject: "We received payment — deployment has started",
        previewText: "Your site is being deployed now.",
        body: `Hi {{firstName}},

We received your payment — thank you.

Your site is now being deployed. Here's what's happening:

1. Provisioning your template
2. Applying your branding
3. Publishing to the web
4. Connecting your domain (if applicable)

You'll receive another email as soon as your site is live.

{{serviceSummaryText}}

If you need any changes or have questions, reply to this email. We're here.

—
LaunchBase
Workflows that give you back your life.`,
      },
      site_live: {
        subject: "Your site is live — and you don't need to manage it",
        previewText: "LaunchBase has taken over. Here's what that means.",
        body: `Hi {{firstName}},

Your site is live — and you don't need to manage it.

👉 View your site:
{{liveUrl}}

From this moment, LaunchBase is carrying:

• Monitoring — we're watching uptime, performance, and availability
• Decisions — we determine when action is safe and relevant
• Waiting — sometimes the right move is no move at all
• Protecting — safety rules are always enforced, without exception

Nothing happens silently.
Every action is visible in your dashboard.
Non-action is always safe.

You can stop thinking about this.

If you ever need changes or have questions, reply to this email. We're here.

—
LaunchBase
Workflows that give you back your life.`,
      },
      preview_followup: {
        subject: "Just checking in — happy to make changes",
        previewText: "Take a look when you have a moment.",
        body: `Hi {{firstName}},

Just checking in to see if you had a chance to review your site.

👉 {{previewUrl}}

If you'd like any tweaks or changes, just reply here — happy to adjust anything before launch.

No rush at all.

—
LaunchBase`,
      },
      testimonial_request: {
        subject: "Quick question (2 minutes)",
        previewText: "Would love your feedback.",
        body: `Hi {{firstName}},

Quick question — if LaunchBase saved you time or helped you get online faster, would you be open to sharing a short testimonial?

A sentence or two is perfect. Nothing formal.

It really helps as we open this up to more businesses.

Thanks either way — and let us know if you need anything.

—
LaunchBase`,
      },
      founding_client_lockin: {
        subject: "You're officially a LaunchBase founding client",
        previewText: "Your pricing is locked in.",
        body: `Hi {{firstName}},

Quick note to say thank you.

As we prepare to open LaunchBase publicly, you're officially locked in as a Founding Client.

That means:
• Your pricing never changes
• You keep priority support
• Your feedback continues to shape the platform

We appreciate you trusting us early.

—
LaunchBase`,
      },
      day7_checkin: {
        subject: "Everything looking good?",
        previewText: "Just checking in on your site.",
        body: `Hi {{firstName}},

Just checking in to make sure everything looks good with your site.

If you want any small tweaks or changes, feel free to reply here.

—
LaunchBase`,
      },
      day30_value: {
        subject: "Quick note from LaunchBase",
        previewText: "Your subscription covers hosting, updates, and support.",
        body: `Hi {{firstName}},

Just a quick note — your LaunchBase subscription covers hosting, updates, and ongoing support for your site.

If you ever need changes or improvements, just reply here.

Thanks again for trusting us.

—
LaunchBase`,
      },
      contact_form_confirmation: {
        subject: "We received your message 👍",
        previewText: "Thanks for reaching out — we'll get back to you within 24 hours.",
        body: `Hi {{firstName}},

Thanks for reaching out to {{businessName}}.

We've received your message and will get back to you within 24 hours.

If this is urgent, you can reply directly to this email.

—
{{businessName}}`,
      },
      ops_alert: {
        subject: "{{subject}}",
        previewText: "LaunchBase ops alert",
        body: `{{text}}`,
      },
      founder_welcome: {
        subject: "Welcome, Founder #{{founderNumber}} — you're locked in",
        previewText: "Your LaunchBase Founder spot is confirmed.",
        body: `Hi {{firstName}},

Your LaunchBase Founder spot is confirmed — Founder #{{founderNumber}}.

Here's what's now locked in for you:

• $300 build (Founder setup)
• 50% off your first 3 months of service
• 15% off ongoing service in perpetuity (our thank-you to the O.G.'s)

What happens next:

1. We begin building based on your intake
2. A human reviews everything for quality
3. You'll get a preview link to approve (no surprise charges)

If anything changes or you want to add details, just reply to this email.

—
LaunchBase Support`,
      },
    },
    org: {
      intake_confirmation: {
        none: {
          subject: "We're building your site from scratch — here's the plan",
          previewText: "LaunchBase is assembling your operational system.",
          body: `Hi {{firstName}},

Thanks for submitting your LaunchBase intake.

You don't currently have a website — so we'll be building one from scratch, then integrating everything needed to run it smoothly.

Here's what happens next:

• We design and build your website
• We connect the systems it needs (forms, tracking, posting, etc.)
• A real human reviews everything for quality
• You receive a private preview link to review and approve

No payment is required to review your site.

Once you approve, we'll handle deployment and ongoing updates so you don't have to think about it.

Estimated turnaround: 24–72 hours

If you have questions at any point, just reply to this email.

—
LaunchBase
Workflows that give you back your life.`,
        },
        existing: {
          subject: "We're refreshing your site — next steps inside",
          previewText: "We'll refresh and modernize your existing site.",
          body: `Hi {{firstName}},

Thanks for submitting your LaunchBase intake.

You already have a website — so our job is to refresh and modernize it, then integrate the systems that keep it running smoothly.

What we'll do next:

• Review your existing site
• Update structure, clarity, and flow where needed
• Integrate the systems behind it (forms, tracking, posting, etc.)
• Have a human review everything before you see it

You'll receive a private preview link to review and approve before anything goes live.

No payment is required to review.

Estimated turnaround: 24–72 hours

If you want us to preserve or avoid anything specific from your current site, just reply here.

—
LaunchBase
Workflows that give you back your life.`,
        },
        systems_only: {
          subject: "We'll integrate your existing site — here's what happens next",
          previewText: "We'll integrate systems without changing your site design.",
          body: `Hi {{firstName}},

Thanks for submitting your LaunchBase intake.

You already have a website you want to keep — so we'll leave the site itself alone and focus on integrating the systems around it.

Here's what happens next:

• We review how your current site works
• We connect the systems it needs (forms, tracking, posting, etc.)
• We verify everything works cleanly together
• A human reviews it before you see the result

You'll receive a preview link showing how everything connects — without changing your site's design.

No payment is required to review.

Estimated turnaround: 24–72 hours

If there's anything specific we should not touch, reply and let us know.

—
LaunchBase
Workflows that give you back your life.`,
        },
      },

      in_progress: {
        subject: "👷 System build in progress",
        previewText: "Everything is on track.",
        body: `Hi {{firstName}},

Quick update — your system is currently being assembled.

Nothing needed from you right now. We're configuring workflows and reviewing everything before it's ready.

You'll receive another email when your preview is available.

—
LaunchBase`,
      },
      ready_for_review: {
        subject: "Your system preview is ready",
        previewText: "Nothing is live yet — review and approve when ready.",
        body: `Hi {{firstName}},

Your LaunchBase system preview is ready.

Nothing is live yet — this is your chance to confirm everything is configured correctly.

👉 Review your preview:
{{previewUrl}}

If adjustments are needed, reply to this email.

—
LaunchBase
Workflows that give you back your life.`,
      },
      review_nudge: {
        subject: "Checking in — your system is ready",
        previewText: "No rush, just making sure you saw it.",
        body: `Hi {{firstName}},

Just checking in to make sure you saw your system preview.

👉 {{previewUrl}}

No rush — we just want to confirm everything is configured correctly before deployment.

Questions or changes? Reply here.

—
LaunchBase`,
      },
      deployment_started: {
        subject: "Payment received — deployment underway",
        previewText: "Your system is being deployed.",
        body: `Hi {{firstName}},

Payment received — thank you.

Your system is now being deployed:

1. Provisioning infrastructure
2. Applying configuration
3. Publishing workflows
4. Connecting integrations (if applicable)

You'll receive confirmation when deployment is complete.

—
LaunchBase
Workflows that give you back your life.`,
      },
      site_live: {
        subject: "Your system is live — LaunchBase is now carrying it",
        previewText: "Execution without chaos. Here's what that means.",
        body: `Hi {{firstName}},

Your system is live — and LaunchBase is now carrying it.

👉 View your system:
{{liveUrl}}

From this moment, LaunchBase handles:

• Monitoring — uptime, performance, availability
• Decisions — determining when action is safe and relevant
• Waiting — sometimes the right move is no move
• Protection — safety rules enforced without exception

Nothing happens silently.
Every action is visible.
Non-action is always safe.

You can stop coordinating this yourself.

Questions or changes? Reply to this email.

—
LaunchBase
Workflows that give you back your life.`,
      },
      preview_followup: {
        subject: "Checking in — happy to make adjustments",
        previewText: "Review when convenient.",
        body: `Hi {{firstName}},

Checking in to see if you've had a chance to review your system.

👉 {{previewUrl}}

If adjustments are needed, just reply — we'll handle it before deployment.

No rush.

—
LaunchBase`,
      },
      testimonial_request: {
        subject: "Quick question (2 minutes)",
        previewText: "Would value your feedback.",
        body: `Hi {{firstName}},

Quick question — if LaunchBase helped streamline operations or reduce coordination overhead, would you be open to sharing a brief testimonial?

A sentence or two is perfect. Nothing formal.

It helps as we expand to more organizations.

Thanks either way.

—
LaunchBase`,
      },
      founding_client_lockin: {
        subject: "You're officially a LaunchBase founding client",
        previewText: "Your pricing is locked in.",
        body: `Hi {{firstName}},

Quick note to say thank you.

As we prepare for public launch, you're officially locked in as a Founding Client.

That means:
• Your pricing never changes
• Priority support continues
• Your feedback shapes the platform

We appreciate your early trust.

—
LaunchBase`,
      },
      day7_checkin: {
        subject: "Everything running smoothly?",
        previewText: "Just checking in.",
        body: `Hi {{firstName}},

Just checking in to make sure everything is running smoothly.

If adjustments are needed, feel free to reply.

—
LaunchBase`,
      },
      day30_value: {
        subject: "Quick note from LaunchBase",
        previewText: "Your subscription covers hosting, updates, and support.",
        body: `Hi {{firstName}},

Quick note — your LaunchBase subscription covers hosting, updates, and ongoing support.

If you need changes or improvements, just reply.

Thanks again.

—
LaunchBase`,
      },
      contact_form_confirmation: {
        subject: "We received your message 👍",
        previewText: "Thanks for reaching out — we'll get back to you within 24 hours.",
        body: `Hi {{firstName}},

Thanks for reaching out to {{businessName}}.

We've received your message and will get back to you within 24 hours.

If this is urgent, you can reply directly to this email.

—
{{businessName}}`,
      },
      ops_alert: {
        subject: "{{subject}}",
        previewText: "LaunchBase ops alert",
        body: `{{text}}`,
      },
      founder_welcome: {
        subject: "Welcome, Founder #{{founderNumber}} — you're locked in",
        previewText: "Your LaunchBase Founder spot is confirmed.",
        body: `Hi {{firstName}},

Your LaunchBase Founder spot is confirmed — Founder #{{founderNumber}}.

Here's what's now locked in for you:

• $300 build (Founder setup)
• 50% off your first 3 months of service
• 15% off ongoing service in perpetuity (our thank-you to the O.G.'s)

What happens next:

1. We begin building based on your intake
2. A human reviews everything for quality
3. You'll get a preview link to approve (no surprise charges)

If anything changes or you want to add details, just reply to this email.

—
LaunchBase Support`,
      },
    },
  },
  
  es: {
    biz: {
      intake_confirmation: {
        none: {
          subject: "Construimos tu sitio desde cero — aquí está el plan",
          previewText: "Tu sitio LaunchBase está oficialmente en progreso.",
          body: `Hola {{firstName}},

Gracias por completar tu formulario en LaunchBase.

No tienes un sitio web actualmente, así que vamos a crear uno desde cero y conectar todo lo necesario para que funcione sin que tengas que pensar en ello.

Qué sigue:

• Diseñamos y construimos tu sitio web
• Conectamos los sistemas que necesita (formularios, seguimiento, publicación, etc.)
• Una persona real revisa todo por calidad
• Recibes un enlace privado de vista previa para revisar y aprobar

No se requiere pago para revisar tu sitio.

Una vez que apruebes, nos encargamos del despliegue y las actualizaciones continuas para que no tengas que pensar en ello.

Tiempo estimado: 24–72 horas

Si tienes preguntas en cualquier momento, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para dirigir tu negocio`,
        },
        existing: {
          subject: "Actualizamos tu sitio — próximos pasos aquí",
          previewText: "Actualizaremos y modernizaremos tu sitio existente.",
          body: `Hola {{firstName}},

Gracias por completar tu formulario en LaunchBase.

Ya tienes un sitio web, así que nuestro trabajo es actualizarlo y modernizarlo, luego integrar los sistemas que lo mantienen funcionando sin problemas.

Qué haremos:

• Revisamos tu sitio existente
• Actualizamos estructura, claridad y flujo donde sea necesario
• Integramos los sistemas detrás de él (formularios, seguimiento, publicación, etc.)
• Una persona revisa todo antes de que lo veas

Recibirás un enlace privado de vista previa para revisar y aprobar antes de que nada se publique.

No se requiere pago para revisar.

Una vez que apruebes, nos encargamos del despliegue y las actualizaciones continuas.

Tiempo estimado: 24–72 horas

Si tienes preguntas, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para dirigir tu negocio`,
        },
        systems_only: {
          subject: "Conectamos tus sistemas — aquí está el plan",
          previewText: "LaunchBase está integrando tus herramientas operacionales.",
          body: `Hola {{firstName}},

Gracias por completar tu formulario en LaunchBase.

Ya tienes un sitio web, así que nos enfocaremos en conectar los sistemas que lo mantienen funcionando sin problemas.

Qué haremos:

• Conectamos formularios, seguimiento, publicación y automatización
• Nos aseguramos de que todo funcione con tu sitio actual
• Una persona revisa todo por calidad
• Recibes un enlace de vista previa para revisar y aprobar

No se requiere pago para revisar.

Una vez que apruebes, nos encargamos del despliegue y las actualizaciones continuas.

Tiempo estimado: 24–72 horas

Si tienes preguntas, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para dirigir tu negocio`,
        },
      },
      in_progress: {
        subject: "Tu sitio está en progreso — aquí está el estado",
        previewText: "Estamos trabajando en tu sitio LaunchBase.",
        body: `Hola {{firstName}},

Solo un recordatorio rápido: tu sitio LaunchBase está en progreso.

Estamos construyendo tu sitio y conectando los sistemas que necesita para funcionar sin problemas.

Una persona real revisará todo antes de que lo veas.

Recibirás un enlace de vista previa para revisar y aprobar antes de que nada se publique.

Tiempo estimado: 24–72 horas desde el envío

Si tienes preguntas, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para dirigir tu negocio`,
      },
      ready_for_review: {
        subject: "¡Tu sitio está listo para revisar!",
        previewText: "Vista previa de tu sitio LaunchBase ahora.",
        body: `Hola {{firstName}},

¡Tu sitio LaunchBase está listo para revisar!

Hemos construido tu sitio y conectado los sistemas que necesita para funcionar sin problemas.

Una persona real revisó todo por calidad.

Ahora es tu turno:

Revisa tu sitio: {{previewUrl}}

Si te gusta, apruébalo y procede al pago.

Si quieres cambios, solícitalos directamente desde la página de vista previa.

No se requiere pago hasta que apruebes.

Si tienes preguntas, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para dirigir tu negocio`,
      },
      review_nudge: {
        subject: "¿Viste tu sitio? Está esperando tu aprobación",
        previewText: "Tu sitio LaunchBase está listo para revisar.",
        body: `Hola {{firstName}},

Solo un recordatorio rápido: tu sitio LaunchBase está listo para revisar.

Revisa tu sitio: {{previewUrl}}

Si te gusta, apruébalo y procede al pago.

Si quieres cambios, solícitalos directamente desde la página de vista previa.

No se requiere pago hasta que apruebes.

Si tienes preguntas, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para dirigir tu negocio`,
      },
      deployment_started: {
        subject: "Tu sitio se está desplegando ahora",
        previewText: "LaunchBase está lanzando tu sitio.",
        body: `Hola {{firstName}},

¡Buenas noticias! Tu sitio se está desplegando ahora.

Esto toma unos minutos.

Te notificaremos cuando esté en vivo.

Si tienes preguntas, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para dirigir tu negocio`,
      },
      site_live: {
        subject: "🎉 ¡Tu sitio está en vivo!",
        previewText: "Tu sitio LaunchBase está ahora en vivo.",
        body: `Hola {{firstName}},

¡Tu sitio está en vivo!

Ver tu sitio en vivo: {{liveUrl}}

LaunchBase ahora se encarga de las actualizaciones continuas y el mantenimiento para que no tengas que pensar en ello.

Si tienes preguntas, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para dirigir tu negocio`,
      },
      preview_followup: {
        subject: "¿Qué piensas de tu sitio?",
        previewText: "Nos encantaría saber tu opinión.",
        body: `Hola {{firstName}},

Solo queríamos ver qué piensas de tu sitio LaunchBase.

Revisa tu sitio: {{previewUrl}}

Si te gusta, apruébalo y procede al pago.

Si quieres cambios, solícitalos directamente desde la página de vista previa.

No se requiere pago hasta que apruebes.

Si tienes preguntas, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para dirigir tu negocio`,
      },
      testimonial_request: {
        subject: "¿Cómo va tu sitio LaunchBase?",
        previewText: "Nos encantaría saber cómo te está yendo.",
        body: `Hola {{firstName}},

Ha pasado una semana desde que tu sitio LaunchBase se lanzó.

Nos encantaría saber cómo te está yendo.

Si tienes un minuto, ¿podrías compartir tus comentarios?

Simplemente responde a este correo con tus pensamientos.

Si tienes preguntas o necesitas ayuda, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para dirigir tu negocio`,
      },
      founding_client_lockin: {
        subject: "Tu precio de cliente fundador está bloqueado",
        previewText: "Tu precio de cliente fundador está bloqueado para siempre.",
        body: `Hola {{firstName}},

Solo un recordatorio rápido: tu precio de cliente fundador está bloqueado para siempre.

Esto significa que nunca pagarás más de lo que pagas ahora.

LaunchBase se encarga de las actualizaciones continuas y el mantenimiento para que no tengas que pensar en ello.

Si tienes preguntas, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para dirigir tu negocio`,
      },
      day7_checkin: {
        subject: "¿Cómo va tu sitio LaunchBase?",
        previewText: "Nos encantaría saber cómo te está yendo.",
        body: `Hola {{firstName}},

Ha pasado una semana desde que tu sitio LaunchBase se lanzó.

Nos encantaría saber cómo te está yendo.

Si tienes preguntas o necesitas ayuda, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para dirigir tu negocio`,
      },
      day30_value: {
        subject: "Tu sitio LaunchBase: 30 días después",
        previewText: "Cómo LaunchBase te está ahorrando tiempo.",
        body: `Hola {{firstName}},

Ha pasado un mes desde que tu sitio LaunchBase se lanzó.

LaunchBase se encarga de las actualizaciones continuas y el mantenimiento para que no tengas que pensar en ello.

Si tienes preguntas o necesitas ayuda, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para dirigir tu negocio`,
      },
      contact_form_confirmation: {
        subject: "Recibimos tu mensaje",
        previewText: "Te responderemos pronto.",
        body: `Hola {{firstName}},

Recibimos tu mensaje y te responderemos pronto.

Si esto es urgente, puedes responder directamente a este correo.

—
{{businessName}}`,
      },
      ops_alert: {
        subject: "{{subject}}",
        previewText: "LaunchBase ops alert",
        body: `{{text}}`,
      },
      founder_welcome: {
        subject: "Bienvenido, Fundador #{{founderNumber}} — ya estás asegurado",
        previewText: "Tu lugar como fundador en LaunchBase está confirmado.",
        body: `Hola {{firstName}},

Tu lugar como fundador en LaunchBase está confirmado — Fundador #{{founderNumber}}.

Esto es lo que ya quedó bloqueado para ti:

• Construcción por $300 (setup de fundador)
• 50% de descuento en tus primeros 3 meses de servicio
• 15% de descuento para siempre en el servicio (nuestro agradecimiento a los O.G.'s)

Qué sigue:

1. Empezamos a construir con tu información del formulario
2. Una persona revisa todo por calidad
3. Recibirás un enlace de vista previa para aprobar (sin cargos sorpresa)

Si quieres agregar algo o cambiar detalles, responde a este correo.

—
Soporte de LaunchBase`,
      },
    },
    org: {
      intake_confirmation: {
        none: {
          subject: "Construimos tu sitio desde cero — aquí está el plan",
          previewText: "LaunchBase está ensamblando tu sistema operacional.",
          body: `Hola {{firstName}},

Gracias por completar tu formulario en LaunchBase.

Actualmente no tienes un sitio web — así que lo construiremos desde cero e integraremos todo lo necesario para que funcione sin problemas.

Qué sigue:

• Diseñamos y construimos tu sitio web
• Conectamos los sistemas que necesita (formularios, seguimiento, publicación, etc.)
• Un humano real revisa todo para asegurar calidad
• Recibes un enlace privado para revisar y aprobar

No se requiere pago para revisar tu sitio.

Una vez que apruebes, nos encargaremos del despliegue y las actualizaciones continuas para que no tengas que pensar en ello.

Tiempo estimado: 24–72 horas

Si tienes preguntas en cualquier momento, simplemente responde a este correo.

—
LaunchBase
El sistema operativo para administrar tu negocio`,
        },
        existing: {
          subject: "Renovamos tu sitio — próximos pasos dentro",
          previewText: "Renovaremos y modernizaremos tu sitio existente.",
          body: `Hola {{firstName}},

Gracias por completar tu registro en LaunchBase.

Ya tienes un sitio web — así que nuestro trabajo es renovarlo y modernizarlo, luego integrar los sistemas que lo mantienen funcionando sin problemas.

Qué haremos:

• Revisamos tu sitio actual
• Actualizamos la estructura, claridad y flujo donde sea necesario
• Integramos los sistemas detrás de él (formularios, seguimiento, publicación, etc.)
• Un humano revisa todo antes de que lo veas

Recibirás un enlace privado para revisar y aprobar antes de que algo se publique.

No se requiere pago para revisar.

Tiempo estimado: 24–72 horas

Si quieres que preservemos o evitemos algo específico de tu sitio actual, simplemente responde aquí.

—
LaunchBase
El sistema operativo para administrar tu negocio`,
        },
        systems_only: {
          subject: "Integraremos tu sitio existente — esto es lo que sigue",
          previewText: "Integraremos sistemas sin cambiar el diseño de tu sitio.",
          body: `Hola {{firstName}},

Gracias por completar tu registro en LaunchBase.

Ya tienes un sitio web que quieres mantener — así que dejaremos el sitio en sí solo y nos enfocaremos en integrar los sistemas a su alrededor.

Qué sigue:

• Revisamos cómo funciona tu sitio actual
• Conectamos los sistemas que necesita (formularios, seguimiento, publicación, etc.)
• Verificamos que todo funcione limpiamente juntos
• Un humano lo revisa antes de que veas el resultado

Recibirás un enlace de vista previa que muestra cómo se conecta todo — sin cambiar el diseño de tu sitio.

No se requiere pago para revisar.

Tiempo estimado: 24–72 horas

Si hay algo específico que no debemos tocar, responde y háznoslo saber.

—
LaunchBase
El sistema operativo para administrar tu negocio`,
        },
      },
      in_progress: {
        subject: "👷 Tu sitio está en progreso",
        previewText: "Una actualización rápida — todo va según lo planeado.",
        body: `Hola {{firstName}},

Una actualización rápida — tu sitio web está siendo construido actualmente.

No necesitas hacer nada ahora. Estamos armando el diseño, contenido y características basadas en tu registro y revisando todo antes de que esté listo.

Recibirás otro correo tan pronto como tu vista previa esté disponible.

—
LaunchBase`,
      },
      ready_for_review: {
        subject: "Tu vista previa está lista",
        previewText: "Nada está publicado aún — revisa tu vista previa y avísanos.",
        body: `Hola {{firstName}},

Tu vista previa de LaunchBase está lista para revisar.

Nada está publicado aún — esta es tu oportunidad de confirmar que todo se ve bien.

👉 Revisa tu vista previa:
{{previewUrl}}

Si quieres cambios, responde a este correo y lo ajustaremos antes del lanzamiento.

—
LaunchBase
Flujos de trabajo que te devuelven tu vida.`,
      },
      review_nudge: {
        subject: "Solo verificando — tu sitio está listo",
        previewText: "Sin prisa, solo asegurándonos de que lo viste.",
        body: `Hola {{firstName}},

Solo verificando para asegurarme de que viste tu vista previa del sitio.

👉 {{previewUrl}}

No hay prisa — solo queremos asegurarnos de que todo se vea bien antes del lanzamiento.

Si tienes preguntas o quieres cambios, responde aquí y nos encargaremos.

—
LaunchBase`,
      },
      deployment_started: {
        subject: "Recibimos el pago — el despliegue ha comenzado",
        previewText: "Tu sitio está siendo desplegado ahora.",
        body: `Hola {{firstName}},

Recibimos tu pago — gracias.

Tu sitio ahora está siendo desplegado. Esto es lo que está sucediendo:

1. Aprovisionando tu plantilla
2. Aplicando tu marca
3. Publicando en la web
4. Conectando tu dominio (si aplica)

Recibirás otro correo tan pronto como tu sitio esté en vivo.

—
LaunchBase
Flujos de trabajo que te devuelven tu vida.`,
      },
      site_live: {
        subject: "Tu sitio está en vivo — y no necesitas gestionarlo",
        previewText: "LaunchBase se ha hecho cargo. Esto es lo que significa.",
        body: `Hola {{firstName}},

Tu sitio está en vivo — y no necesitas gestionarlo.

👉 Ver tu sitio:
{{liveUrl}}

Desde este momento, LaunchBase está llevando:

• Monitoreo — estamos vigilando tiempo de actividad, rendimiento y disponibilidad
• Decisiones — determinamos cuándo la acción es segura y relevante
• Espera — a veces el movimiento correcto es no moverse
• Protección — las reglas de seguridad siempre se aplican, sin excepción

Nada sucede en silencio.
Cada acción es visible en tu panel.
La no acción siempre es segura.

Puedes dejar de pensar en esto.

Si alguna vez necesitas cambios o tienes preguntas, responde a este correo. Estamos aquí.

—
LaunchBase
Flujos de trabajo que te devuelven tu vida.`,
      },
      preview_followup: {
        subject: "Solo verificando — feliz de hacer cambios",
        previewText: "Echa un vistazo cuando tengas un momento.",
        body: `Hola {{firstName}},

Solo verificando para ver si tuviste la oportunidad de revisar tu sitio.

👉 {{previewUrl}}

Si quieres ajustes o cambios, simplemente responde aquí — feliz de ajustar cualquier cosa antes del lanzamiento.

Sin prisa.

—
LaunchBase`,
      },
      testimonial_request: {
        subject: "Pregunta rápida (2 minutos)",
        previewText: "Nos encantaría tu opinión.",
        body: `Hola {{firstName}},

Pregunta rápida — si LaunchBase te ahorró tiempo o te ayudó a estar en línea más rápido, ¿estarías abierto a compartir un breve testimonio?

Una o dos oraciones es perfecto. Nada formal.

Realmente ayuda mientras abrimos esto a más negocios.

Gracias de cualquier manera — y avísanos si necesitas algo.

—
LaunchBase`,
      },
      founding_client_lockin: {
        subject: "Oficialmente eres un cliente fundador de LaunchBase",
        previewText: "Tu precio está bloqueado.",
        body: `Hola {{firstName}},

Una nota rápida para decir gracias.

Mientras nos preparamos para abrir LaunchBase públicamente, oficialmente estás bloqueado como Cliente Fundador.

Eso significa:
• Tu precio nunca cambia
• Mantienes soporte prioritario
• Tu retroalimentación continúa dando forma a la plataforma

Apreciamos que confiaras en nosotros temprano.

—
LaunchBase`,
      },
      day7_checkin: {
        subject: "¿Todo se ve bien?",
        previewText: "Solo verificando tu sitio.",
        body: `Hola {{firstName}},

Solo verificando para asegurarme de que todo se ve bien con tu sitio.

Si quieres pequeños ajustes o cambios, siéntete libre de responder aquí.

—
LaunchBase`,
      },
      day30_value: {
        subject: "Nota rápida de LaunchBase",
        previewText: "Tu suscripción cubre alojamiento, actualizaciones y soporte.",
        body: `Hola {{firstName}},

Solo una nota rápida — tu suscripción a LaunchBase cubre alojamiento, actualizaciones y soporte continuo para tu sitio.

Si alguna vez necesitas cambios o mejoras, simplemente responde aquí.

Gracias de nuevo por confiar en nosotros.

—
LaunchBase`,
      },
      contact_form_confirmation: {
        subject: "We received your message 👍",
        previewText: "Thanks for reaching out — we'll get back to you within 24 hours.",
        body: `Hi {{firstName}},

Thanks for reaching out to {{businessName}}.

We've received your message and will get back to you within 24 hours.

If this is urgent, you can reply directly to this email.

—
{{businessName}}`,
      },
      ops_alert: {
        subject: "{{subject}}",
        previewText: "LaunchBase ops alert",
        body: `{{text}}`,
      },
      founder_welcome: {
        subject: "Welcome, Founder #{{founderNumber}} — you're locked in",
        previewText: "Your LaunchBase Founder spot is confirmed.",
        body: `Hi {{firstName}},

Your LaunchBase Founder spot is confirmed — Founder #{{founderNumber}}.

Here's what's now locked in for you:

• $300 build (Founder setup)
• 50% off your first 3 months of service
• 15% off ongoing service in perpetuity (our thank-you to the O.G.'s)

What happens next:

1. We begin building based on your intake
2. A human reviews everything for quality
3. You'll get a preview link to approve (no surprise charges)

If anything changes or you want to add details, just reply to this email.

—
LaunchBase Support`,
      },
    },
  },
  
  pl: {
    biz: {
      intake_confirmation: {
        none: {
          subject: "Budujemy Twoją stronę od podstaw — oto plan",
          previewText: "Twoja strona LaunchBase jest oficjalnie w trakcie realizacji.",
          body: `Cześć {{firstName}},

Dziękujemy za wypełnienie formularza LaunchBase.

Nie masz jeszcze strony internetowej, więc zbudujemy ją od podstaw i podłączymy wszystkie potrzebne systemy.

Co dalej:

• Projektujemy i budujemy stronę
• Integrujemy potrzebne systemy
• Człowiek sprawdza wszystko
• Otrzymasz prywatny link do podglądu

Nie wymagamy płatności za podgląd.

Czas realizacji: 24–72 godziny

—
LaunchBase`,
        },
        existing: {
          subject: "Odświeżamy Twoją stronę — następne kroki wewnątrz",
          previewText: "Odświeżymy i zmodernizujemy Twoją istniejącą stronę.",
          body: `Cześć {{firstName}},

Masz już stronę internetową, więc odświeżymy ją i zmodernizujemy, a następnie zintegrujemy potrzebne systemy.

Następne kroki:

• Przeglądamy obecną stronę
• Poprawiamy strukturę i czytelność
• Integrujemy systemy
• Człowiek sprawdza wszystko

Otrzymasz prywatny link do podglądu.

Bez płatności za podgląd.

—
LaunchBase`,
        },
        systems_only: {
          subject: "Zintegrujemy Twoją istniejącą stronę — oto co następuje",
          previewText: "Zintegrujemy systemy bez zmiany wyglądu strony.",
          body: `Cześć {{firstName}},

Masz stronę, którą chcesz zachować — nie zmieniamy jej wyglądu. Skupiamy się wyłącznie na integracji systemów.

Co robimy:

• Sprawdzamy działanie strony
• Integrujemy formularze i systemy
• Testujemy wszystko
• Człowiek sprawdza efekt

Bez płatności za podgląd.

—
LaunchBase`,
        },
      },

      in_progress: {
        subject: "👷 Twoja strona jest w trakcie realizacji",
        previewText: "Szybka aktualizacja — wszystko idzie zgodnie z planem.",
        body: `Cześć {{firstName}},

Szybka aktualizacja — Twoja strona internetowa jest obecnie budowana.

Nic nie musisz teraz robić. Montujemy układ, treść i funkcje na podstawie Twojego formularza i sprawdzamy wszystko, zanim będzie gotowe.

Otrzymasz kolejny e-mail, gdy tylko Twój podgląd będzie dostępny.

—
LaunchBase`,
      },
      ready_for_review: {
        subject: "Twój podgląd strony jest gotowy",
        previewText: "Nic nie jest jeszcze opublikowane — sprawdź podgląd i daj nam znać.",
        body: `Cześć {{firstName}},

Twój podgląd LaunchBase jest gotowy do przeglądu.

Nic nie jest jeszcze opublikowane — to Twoja szansa, aby potwierdzić, że wszystko wygląda dobrze.

👉 Sprawdź swój podgląd:
{{previewUrl}}

Jeśli chcesz zmian, odpowiedz na ten e-mail, a dostosujemy to przed uruchomieniem.

—
LaunchBase
Przepływy pracy, które oddają Ci życie.`,
      },
      review_nudge: {
        subject: "Tylko sprawdzam — Twoja strona jest gotowa",
        previewText: "Bez pośpiechu, tylko upewniamy się, że to widziałeś.",
        body: `Cześć {{firstName}},

Tylko sprawdzam, aby upewnić się, że widziałeś podgląd swojej strony.

👉 {{previewUrl}}

Nie ma pośpiechu — chcemy tylko upewnić się, że wszystko wygląda dobrze przed uruchomieniem.

Jeśli masz pytania lub chcesz zmian, odpowiedz tutaj, a my się tym zajmiemy.

—
LaunchBase`,
      },
      deployment_started: {
        subject: "Otrzymaliśmy płatność — wdrożenie rozpoczęte",
        previewText: "Twoja strona jest teraz wdrażana.",
        body: `Cześć {{firstName}},

Otrzymaliśmy Twoją płatność — dziękujemy.

Twoja strona jest teraz wdrażana. Oto co się dzieje:

1. Przygotowywanie szablonu
2. Stosowanie Twojej marki
3. Publikowanie w sieci
4. Podłączanie domeny (jeśli dotyczy)

Otrzymasz kolejny e-mail, gdy tylko Twoja strona będzie na żywo.

—
LaunchBase
Przepływy pracy, które oddają Ci życie.`,
      },
      site_live: {
        subject: "Twoja strona jest na żywo — i nie musisz nią zarządzać",
        previewText: "LaunchBase przejął kontrolę. Oto co to oznacza.",
        body: `Cześć {{firstName}},

Twoja strona jest na żywo — i nie musisz nią zarządzać.

👉 Zobacz swoją stronę:
{{liveUrl}}

Od tego momentu LaunchBase niesie:

• Monitorowanie — obserwujemy czas pracy, wydajność i dostępność
• Decyzje — określamy, kiedy działanie jest bezpieczne i istotne
• Czekanie — czasami właściwym ruchem jest brak ruchu
• Ochrona — zasady bezpieczeństwa są zawsze egzekwowane, bez wyjątku

Nic nie dzieje się po cichu.
Każde działanie jest widoczne na Twoim panelu.
Brak działania jest zawsze bezpieczny.

Możesz przestać o tym myśleć.

Jeśli kiedykolwiek potrzebujesz zmian lub masz pytania, odpowiedz na ten e-mail. Jesteśmy tutaj.

—
LaunchBase
Przepływy pracy, które oddają Ci życie.`,
      },
      preview_followup: {
        subject: "Tylko sprawdzam — chętnie wprowadzę zmiany",
        previewText: "Spójrz, gdy będziesz mieć chwilę.",
        body: `Cześć {{firstName}},

Tylko sprawdzam, czy miałeś okazję przejrzeć swoją stronę.

👉 {{previewUrl}}

Jeśli chciałbyś jakichś poprawek lub zmian, po prostu odpowiedz tutaj — chętnie dostosuję cokolwiek przed uruchomieniem.

Bez pośpiechu.

—
LaunchBase`,
      },
      testimonial_request: {
        subject: "Szybkie pytanie (2 minuty)",
        previewText: "Chętnie poznamy Twoją opinię.",
        body: `Cześć {{firstName}},

Szybkie pytanie — jeśli LaunchBase zaoszczędził Ci czas lub pomógł szybciej wejść do sieci, czy byłbyś otwarty na podzielenie się krótkim świadectwem?

Jedno lub dwa zdania jest idealne. Nic formalnego.

Naprawdę pomaga, gdy otwieramy to dla większej liczby firm.

Dziękujemy tak czy inaczej — i daj nam znać, jeśli czegoś potrzebujesz.

—
LaunchBase`,
      },
      founding_client_lockin: {
        subject: "Oficjalnie jesteś klientem założycielskim LaunchBase",
        previewText: "Twoja cena jest zablokowana.",
        body: `Cześć {{firstName}},

Szybka notatka, aby powiedzieć dziękuję.

Gdy przygotowujemy się do publicznego otwarcia LaunchBase, oficjalnie jesteś zablokowany jako Klient Założycielski.

To oznacza:
• Twoja cena nigdy się nie zmienia
• Zachowujesz priorytetowe wsparcie
• Twoja opinia nadal kształtuje platformę

Doceniamy, że zaufałeś nam wcześnie.

—
LaunchBase`,
      },
      day7_checkin: {
        subject: "Wszystko wygląda dobrze?",
        previewText: "Tylko sprawdzam Twoją stronę.",
        body: `Cześć {{firstName}},

Tylko sprawdzam, aby upewnić się, że wszystko wygląda dobrze z Twoją stroną.

Jeśli chcesz małych poprawek lub zmian, śmiało odpowiedz tutaj.

—
LaunchBase`,
      },
      day30_value: {
        subject: "Szybka notatka od LaunchBase",
        previewText: "Twoja subskrypcja obejmuje hosting, aktualizacje i wsparcie.",
        body: `Cześć {{firstName}},

Tylko szybka notatka — Twoja subskrypcja LaunchBase obejmuje hosting, aktualizacje i bieżące wsparcie dla Twojej strony.

Jeśli kiedykolwiek potrzebujesz zmian lub ulepszeń, po prostu odpowiedz tutaj.

Dziękujemy ponownie za zaufanie.

—
LaunchBase`,
      },
      contact_form_confirmation: {
        subject: "We received your message 👍",
        previewText: "Thanks for reaching out — we'll get back to you within 24 hours.",
        body: `Hi {{firstName}},

Thanks for reaching out to {{businessName}}.

We've received your message and will get back to you within 24 hours.

If this is urgent, you can reply directly to this email.

—
{{businessName}}`,
      },
      ops_alert: {
        subject: "{{subject}}",
        previewText: "LaunchBase ops alert",
        body: `{{text}}`,
      },
      founder_welcome: {
        subject: "Welcome, Founder #{{founderNumber}} — you're locked in",
        previewText: "Your LaunchBase Founder spot is confirmed.",
        body: `Hi {{firstName}},

Your LaunchBase Founder spot is confirmed — Founder #{{founderNumber}}.

Here's what's now locked in for you:

• $300 build (Founder setup)
• 50% off your first 3 months of service
• 15% off ongoing service in perpetuity (our thank-you to the O.G.'s)

What happens next:

1. We begin building based on your intake
2. A human reviews everything for quality
3. You'll get a preview link to approve (no surprise charges)

If anything changes or you want to add details, just reply to this email.

—
LaunchBase Support`,
      },
    },
    org: {
      intake_confirmation: {
        none: {
          subject: "Budujemy Twoją stronę od podstaw — oto plan",
          previewText: "LaunchBase montuje Twój system operacyjny.",
          body: `Cześć {{firstName}},

Dziękujemy za wypełnienie formularza LaunchBase.

Nie masz jeszcze strony internetowej, więc zbudujemy ją od podstaw i podłączymy wszystkie potrzebne systemy.

Co dalej:

• Projektujemy i budujemy stronę
• Integrujemy potrzebne systemy
• Człowiek sprawdza wszystko
• Otrzymasz prywatny link do podglądu

Nie wymagamy płatności za podgląd.

Czas realizacji: 24–72 godziny

—
LaunchBase`,
        },
        existing: {
          subject: "Odświeżamy Twoją stronę — następne kroki wewnątrz",
          previewText: "Odświeżymy i zmodernizujemy Twoją istniejącą stronę.",
          body: `Cześć {{firstName}},

Masz już stronę internetową, więc odświeżymy ją i zmodernizujemy, a następnie zintegrujemy potrzebne systemy.

Następne kroki:

• Przeglądamy obecną stronę
• Poprawiamy strukturę i czytelność
• Integrujemy systemy
• Człowiek sprawdza wszystko

Otrzymasz prywatny link do podglądu.

Bez płatności za podgląd.

—
LaunchBase`,
        },
        systems_only: {
          subject: "Zintegrujemy Twoją istniejącą stronę — oto co następuje",
          previewText: "Zintegrujemy systemy bez zmiany wyglądu strony.",
          body: `Cześć {{firstName}},

Masz stronę, którą chcesz zachować — nie zmieniamy jej wyglądu. Skupiamy się wyłącznie na integracji systemów.

Co robimy:

• Sprawdzamy działanie strony
• Integrujemy formularze i systemy
• Testujemy wszystko
• Człowiek sprawdza efekt

Bez płatności za podgląd.

—
LaunchBase`,
        },
      },
      in_progress: {
        subject: "👷 Budowa systemu w trakcie",
        previewText: "Wszystko idzie zgodnie z planem.",
        body: `Cześć {{firstName}},

Szybka aktualizacja — Twój system jest obecnie montowany.

Nic nie musisz teraz robić. Konfigurujemy przepływy pracy i sprawdzamy wszystko, zanim będzie gotowe.

Otrzymasz kolejny e-mail, gdy Twój podgląd będzie dostępny.

—
LaunchBase`,
      },
      ready_for_review: {
        subject: "Twój podgląd systemu jest gotowy",
        previewText: "Nic nie jest jeszcze na żywo — sprawdź i zatwierdź, gdy będziesz gotowy.",
        body: `Cześć {{firstName}},

Twój podgląd systemu LaunchBase jest gotowy.

Nic nie jest jeszcze na żywo — to Twoja szansa, aby potwierdzić, że wszystko jest poprawnie skonfigurowane.

👉 Sprawdź swój podgląd:
{{previewUrl}}

Jeśli potrzebne są korekty, odpowiedz na ten e-mail.

—
LaunchBase
Przepływy pracy, które oddają Ci życie.`,
      },
      review_nudge: {
        subject: "Sprawdzam — Twój system jest gotowy",
        previewText: "Bez pośpiechu, tylko upewniamy się, że to widziałeś.",
        body: `Cześć {{firstName}},

Tylko sprawdzam, aby upewnić się, że widziałeś podgląd swojego systemu.

👉 {{previewUrl}}

Bez pośpiechu — chcemy tylko potwierdzić, że wszystko jest poprawnie skonfigurowane przed wdrożeniem.

Pytania lub zmiany? Odpowiedz tutaj.

—
LaunchBase`,
      },
      deployment_started: {
        subject: "Płatność otrzymana — wdrożenie w toku",
        previewText: "Twój system jest wdrażany.",
        body: `Cześć {{firstName}},

Płatność otrzymana — dziękujemy.

Twój system jest teraz wdrażany:

1. Przygotowywanie infrastruktury
2. Stosowanie konfiguracji
3. Publikowanie przepływów pracy
4. Podłączanie integracji (jeśli dotyczy)

Otrzymasz potwierdzenie, gdy wdrożenie zostanie zakończone.

—
LaunchBase
Przepływy pracy, które oddają Ci życie.`,
      },
      site_live: {
        subject: "Twój system jest na żywo — LaunchBase teraz go niesie",
        previewText: "Realizacja bez chaosu. Oto co to oznacza.",
        body: `Cześć {{firstName}},

Twój system jest na żywo — i LaunchBase teraz go niesie.

👉 Zobacz swój system:
{{liveUrl}}

Od tego momentu LaunchBase obsługuje:

• Monitorowanie — czas pracy, wydajność, dostępność
• Decyzje — określanie, kiedy działanie jest bezpieczne i istotne
• Czekanie — czasami właściwym ruchem jest brak ruchu
• Ochrona — zasady bezpieczeństwa egzekwowane bez wyjątku

Nic nie dzieje się po cichu.
Każde działanie jest widoczne.
Brak działania jest zawsze bezpieczny.

Możesz przestać samodzielnie to koordynować.

Pytania lub zmiany? Odpowiedz na ten e-mail.

—
LaunchBase
Przepływy pracy, które oddają Ci życie.`,
      },
      preview_followup: {
        subject: "Sprawdzam — chętnie wprowadzę korekty",
        previewText: "Sprawdź, gdy będzie wygodnie.",
        body: `Cześć {{firstName}},

Sprawdzam, czy miałeś okazję przejrzeć swój system.

👉 {{previewUrl}}

Jeśli potrzebne są korekty, po prostu odpowiedz — zajmiemy się tym przed wdrożeniem.

Bez pośpiechu.

—
LaunchBase`,
      },
      testimonial_request: {
        subject: "Szybkie pytanie (2 minuty)",
        previewText: "Cenilibyśmy Twoją opinię.",
        body: `Cześć {{firstName}},

Szybkie pytanie — jeśli LaunchBase pomógł usprawnić operacje lub zmniejszyć obciążenie koordynacyjne, czy byłbyś otwarty na podzielenie się krótkim świadectwem?

Jedno lub dwa zdania jest idealne. Nic formalnego.

Pomaga, gdy rozszerzamy się na więcej organizacji.

Dziękujemy tak czy inaczej.

—
LaunchBase`,
      },
      founding_client_lockin: {
        subject: "Oficjalnie jesteś klientem założycielskim LaunchBase",
        previewText: "Twoja cena jest zablokowana.",
        body: `Cześć {{firstName}},

Szybka notatka, aby powiedzieć dziękuję.

Gdy przygotowujemy się do publicznego uruchomienia, oficjalnie jesteś zablokowany jako Klient Założycielski.

To oznacza:
• Twoja cena nigdy się nie zmienia
• Priorytetowe wsparcie trwa
• Twoja opinia kształtuje platformę

Doceniamy Twoje wczesne zaufanie.

—
LaunchBase`,
      },
      day7_checkin: {
        subject: "Wszystko działa płynnie?",
        previewText: "Tylko sprawdzam.",
        body: `Cześć {{firstName}},

Tylko sprawdzam, aby upewnić się, że wszystko działa płynnie.

Jeśli potrzebne są korekty, śmiało odpowiedz.

—
LaunchBase`,
      },
      day30_value: {
        subject: "Szybka notatka od LaunchBase",
        previewText: "Twoja subskrypcja obejmuje hosting, aktualizacje i wsparcie.",
        body: `Cześć {{firstName}},

Szybka notatka — Twoja subskrypcja LaunchBase obejmuje hosting, aktualizacje i bieżące wsparcie.

Jeśli potrzebujesz zmian lub ulepszeń, po prostu odpowiedz.

Dziękujemy ponownie.

—
LaunchBase`,
      },
      contact_form_confirmation: {
        subject: "We received your message 👍",
        previewText: "Thanks for reaching out — we'll get back to you within 24 hours.",
        body: `Hi {{firstName}},

Thanks for reaching out to {{businessName}}.

We've received your message and will get back to you within 24 hours.

If this is urgent, you can reply directly to this email.

—
{{businessName}}`,
      },
      ops_alert: {
        subject: "{{subject}}",
        previewText: "LaunchBase ops alert",
        body: `{{text}}`,
      },
      founder_welcome: {
        subject: "Welcome, Founder #{{founderNumber}} — you're locked in",
        previewText: "Your LaunchBase Founder spot is confirmed.",
        body: `Hi {{firstName}},

Your LaunchBase Founder spot is confirmed — Founder #{{founderNumber}}.

Here's what's now locked in for you:

• $300 build (Founder setup)
• 50% off your first 3 months of service
• 15% off ongoing service in perpetuity (our thank-you to the O.G.'s)

What happens next:

1. We begin building based on your intake
2. A human reviews everything for quality
3. You'll get a preview link to approve (no surprise charges)

If anything changes or you want to add details, just reply to this email.

—
LaunchBase Support`,
      },
    },
  },
};

/**
 * Type guard to check if an email entry is a websiteStatus variant
 */
function isWebsiteStatusVariants(x: unknown): x is WebsiteStatusVariants<EmailBlock> {
  return !!x
    && typeof x === "object"
    && "none" in (x as any)
    && "existing" in (x as any)
    && "systems_only" in (x as any);
}

/**
 * Get email copy for a specific language, audience, and email type
 * Supports websiteStatus variants for emails like intake_confirmation
 * Falls back to English Business if translation missing
 */
export function getEmailCopy(args: {
  language: Language;
  audience: Audience;
  emailType: EmailType;
  websiteStatus?: WebsiteStatus | null;
}): EmailBlock {
  const status: WebsiteStatus = args.websiteStatus ?? "none";
  
  const entry = emailCopy[args.language]?.[args.audience]?.[args.emailType] as
    | EmailBlockOrVariants
    | undefined;
  
  // Fail-loud: better to crash in dev/tests than silently send wrong emails
  if (!entry) {
    throw new Error(
      `[emailCopy] Missing copy for language=${args.language} audience=${args.audience} emailType=${args.emailType}`
    );
  }
  
  // If this email type has websiteStatus variants, select the right one
  if (isWebsiteStatusVariants(entry)) {
    return entry[status] ?? entry.none;
  }
  
  // Old-style email blocks work unchanged
  return entry;
}

/**
 * Interpolate variables into email template
 * Supports: {{firstName}}, {{businessName}}, {{previewUrl}}, {{liveUrl}}
 */
export function interpolateEmail(
  template: string,
  data: {
    firstName: string;
    businessName: string;
    previewUrl?: string;
    liveUrl?: string;
    serviceSummaryText?: string;
  }
): string {
  return template
    .replace(/\{\{firstName\}\}/g, data.firstName)
    .replace(/\{\{businessName\}\}/g, data.businessName)
    .replace(/\{\{previewUrl\}\}/g, data.previewUrl || "[Preview URL]")
    .replace(/\{\{liveUrl\}\}/g, data.liveUrl || "[Live URL]")
    .replace(/\{\{serviceSummaryText\}\}/g, data.serviceSummaryText || "");
}
