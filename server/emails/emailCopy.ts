/**
 * LaunchBase Email Copy Map
 * Single source of truth for all customer-facing email content
 * Supports: EN, ES, PL × Business, Organization
 */

export type Language = "en" | "es" | "pl";
export type Audience = "biz" | "org";

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
  | "day7_checkin"
  | "day30_value";

interface EmailBlock {
  subject: string;
  previewText: string;
  body: string;
}

type EmailCopyMap = Record<Language, Record<Audience, Record<EmailType, EmailBlock>>>;

export const emailCopy: EmailCopyMap = {
  en: {
    biz: {
      intake_confirmation: {
        subject: "✅ We're building your website",
        previewText: "Your LaunchBase site is officially in progress.",
        body: `Hi {{firstName}},

Thanks for completing your LaunchBase intake.

We're now building your website based on the information you provided. Our system handles the structure, copy, and layout — and a real human reviews everything before it's ready.

What happens next:
• We build your site
• We review it for quality
• You'll receive a link to preview and approve

Estimated turnaround: 24–72 hours
(No payment required to review.)

If you have questions in the meantime, just reply to this email.

—
💰 Know someone who needs a website? Refer a friend and you'll both save $50.
https://getlaunchbase.com/referrals

—
LaunchBase
The operating system for launching service businesses`,
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
    },
    org: {
      intake_confirmation: {
        subject: "✅ Your system build has started",
        previewText: "LaunchBase is assembling your operational system.",
        body: `Hi {{firstName}},

Thanks for submitting your LaunchBase intake.

We're assembling the system based on your inputs. Structure, workflows, and visibility are being configured — with human review before anything goes live.

What happens next:
• System assembly
• Quality review
• Preview link for approval

Estimated turnaround: 24–72 hours
(No payment required to review.)

Questions? Reply to this email.

—
LaunchBase
Workflows that give you back your life.`,
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
    },
  },
  
  es: {
    biz: {
      intake_confirmation: {
        subject: "✅ Estamos construyendo tu sitio web",
        previewText: "Tu sitio LaunchBase está oficialmente en progreso.",
        body: `Hola {{firstName}},

Gracias por completar tu registro en LaunchBase.

Ahora estamos construyendo tu sitio web basado en la información que proporcionaste. Nuestro sistema maneja la estructura, el contenido y el diseño — y un humano real revisa todo antes de que esté listo.

Qué sigue:
• Construimos tu sitio
• Lo revisamos para asegurar calidad
• Recibirás un enlace para previsualizar y aprobar

Tiempo estimado: 24–72 horas
(No se requiere pago para revisar.)

Si tienes preguntas mientras tanto, simplemente responde a este correo.

—
💰 ¿Conoces a alguien que necesite un sitio web? Refiere a un amigo y ambos ahorrarán $50.
https://getlaunchbase.com/referrals

—
LaunchBase
El sistema operativo para lanzar negocios de servicios`,
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
    },
    org: {
      intake_confirmation: {
        subject: "✅ La construcción de tu sistema ha comenzado",
        previewText: "LaunchBase está ensamblando tu sistema operacional.",
        body: `Hola {{firstName}},

Gracias por enviar tu registro en LaunchBase.

Estamos ensamblando el sistema basado en tus entradas. Estructura, flujos de trabajo y visibilidad están siendo configurados — con revisión humana antes de que nada salga en vivo.

Qué sigue:
• Ensamblaje del sistema
• Revisión de calidad
• Enlace de vista previa para aprobación

Tiempo estimado: 24–72 horas
(No se requiere pago para revisar.)

¿Preguntas? Responde a este correo.

—
LaunchBase
Flujos de trabajo que te devuelven tu vida.`,
      },
      in_progress: {
        subject: "👷 Construcción del sistema en progreso",
        previewText: "Todo va según lo planeado.",
        body: `Hola {{firstName}},

Actualización rápida — tu sistema está siendo ensamblado actualmente.

No necesitas hacer nada ahora. Estamos configurando flujos de trabajo y revisando todo antes de que esté listo.

Recibirás otro correo cuando tu vista previa esté disponible.

—
LaunchBase`,
      },
      ready_for_review: {
        subject: "Tu vista previa del sistema está lista",
        previewText: "Nada está en vivo aún — revisa y aprueba cuando estés listo.",
        body: `Hola {{firstName}},

Tu vista previa del sistema LaunchBase está lista.

Nada está en vivo aún — esta es tu oportunidad de confirmar que todo está configurado correctamente.

👉 Revisa tu vista previa:
{{previewUrl}}

Si se necesitan ajustes, responde a este correo.

—
LaunchBase
Flujos de trabajo que te devuelven tu vida.`,
      },
      review_nudge: {
        subject: "Verificando — tu sistema está listo",
        previewText: "Sin prisa, solo asegurándonos de que lo viste.",
        body: `Hola {{firstName}},

Solo verificando para asegurarme de que viste tu vista previa del sistema.

👉 {{previewUrl}}

Sin prisa — solo queremos confirmar que todo está configurado correctamente antes del despliegue.

¿Preguntas o cambios? Responde aquí.

—
LaunchBase`,
      },
      deployment_started: {
        subject: "Pago recibido — despliegue en marcha",
        previewText: "Tu sistema está siendo desplegado.",
        body: `Hola {{firstName}},

Pago recibido — gracias.

Tu sistema ahora está siendo desplegado:

1. Aprovisionando infraestructura
2. Aplicando configuración
3. Publicando flujos de trabajo
4. Conectando integraciones (si aplica)

Recibirás confirmación cuando el despliegue esté completo.

—
LaunchBase
Flujos de trabajo que te devuelven tu vida.`,
      },
      site_live: {
        subject: "Tu sistema está en vivo — LaunchBase ahora lo está llevando",
        previewText: "Ejecución sin caos. Esto es lo que significa.",
        body: `Hola {{firstName}},

Tu sistema está en vivo — y LaunchBase ahora lo está llevando.

👉 Ver tu sistema:
{{liveUrl}}

Desde este momento, LaunchBase maneja:

• Monitoreo — tiempo de actividad, rendimiento, disponibilidad
• Decisiones — determinando cuándo la acción es segura y relevante
• Espera — a veces el movimiento correcto es no moverse
• Protección — reglas de seguridad aplicadas sin excepción

Nada sucede en silencio.
Cada acción es visible.
La no acción siempre es segura.

Puedes dejar de coordinar esto tú mismo.

¿Preguntas o cambios? Responde a este correo.

—
LaunchBase
Flujos de trabajo que te devuelven tu vida.`,
      },
      preview_followup: {
        subject: "Verificando — feliz de hacer ajustes",
        previewText: "Revisa cuando sea conveniente.",
        body: `Hola {{firstName}},

Verificando para ver si has tenido la oportunidad de revisar tu sistema.

👉 {{previewUrl}}

Si se necesitan ajustes, simplemente responde — lo manejaremos antes del despliegue.

Sin prisa.

—
LaunchBase`,
      },
      testimonial_request: {
        subject: "Pregunta rápida (2 minutos)",
        previewText: "Valoraríamos tu opinión.",
        body: `Hola {{firstName}},

Pregunta rápida — si LaunchBase ayudó a optimizar operaciones o reducir la sobrecarga de coordinación, ¿estarías abierto a compartir un breve testimonio?

Una o dos oraciones es perfecto. Nada formal.

Ayuda mientras expandimos a más organizaciones.

Gracias de cualquier manera.

—
LaunchBase`,
      },
      founding_client_lockin: {
        subject: "Oficialmente eres un cliente fundador de LaunchBase",
        previewText: "Tu precio está bloqueado.",
        body: `Hola {{firstName}},

Una nota rápida para decir gracias.

Mientras nos preparamos para el lanzamiento público, oficialmente estás bloqueado como Cliente Fundador.

Eso significa:
• Tu precio nunca cambia
• El soporte prioritario continúa
• Tu retroalimentación da forma a la plataforma

Apreciamos tu confianza temprana.

—
LaunchBase`,
      },
      day7_checkin: {
        subject: "¿Todo funciona sin problemas?",
        previewText: "Solo verificando.",
        body: `Hola {{firstName}},

Solo verificando para asegurarme de que todo funciona sin problemas.

Si se necesitan ajustes, siéntete libre de responder.

—
LaunchBase`,
      },
      day30_value: {
        subject: "Nota rápida de LaunchBase",
        previewText: "Tu suscripción cubre alojamiento, actualizaciones y soporte.",
        body: `Hola {{firstName}},

Nota rápida — tu suscripción a LaunchBase cubre alojamiento, actualizaciones y soporte continuo.

Si necesitas cambios o mejoras, simplemente responde.

Gracias de nuevo.

—
LaunchBase`,
      },
    },
  },
  
  pl: {
    biz: {
      intake_confirmation: {
        subject: "✅ Budujemy Twoją stronę internetową",
        previewText: "Twoja strona LaunchBase jest oficjalnie w trakcie realizacji.",
        body: `Cześć {{firstName}},

Dziękujemy za wypełnienie formularza LaunchBase.

Teraz budujemy Twoją stronę internetową na podstawie dostarczonych informacji. Nasz system zajmuje się strukturą, treścią i układem — a prawdziwy człowiek sprawdza wszystko, zanim będzie gotowe.

Co dalej:
• Budujemy Twoją stronę
• Sprawdzamy jakość
• Otrzymasz link do podglądu i zatwierdzenia

Szacowany czas: 24–72 godziny
(Nie wymaga się płatności do przeglądu.)

Jeśli masz pytania w międzyczasie, po prostu odpowiedz na ten e-mail.

—
💰 Znasz kogoś, kto potrzebuje strony internetowej? Poleć znajomego, a oboje zaoszczędzicie $50.
https://getlaunchbase.com/referrals

—
LaunchBase
System operacyjny do uruchamiania firm usługowych`,
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
    },
    org: {
      intake_confirmation: {
        subject: "✅ Budowa Twojego systemu rozpoczęta",
        previewText: "LaunchBase montuje Twój system operacyjny.",
        body: `Cześć {{firstName}},

Dziękujemy za przesłanie formularza LaunchBase.

Montujemy system na podstawie Twoich danych wejściowych. Struktura, przepływy pracy i widoczność są konfigurowane — z ludzkim przeglądem, zanim cokolwiek zostanie uruchomione.

Co dalej:
• Montaż systemu
• Przegląd jakości
• Link podglądu do zatwierdzenia

Szacowany czas: 24–72 godziny
(Nie wymaga się płatności do przeglądu.)

Pytania? Odpowiedz na ten e-mail.

—
LaunchBase
Przepływy pracy, które oddają Ci życie.`,
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
    },
  },
};

/**
 * Get email copy for a specific language, audience, and email type
 * Falls back to English Business if translation missing
 */
export function getEmailCopy(
  language: Language,
  audience: Audience,
  emailType: EmailType
): EmailBlock {
  return emailCopy[language]?.[audience]?.[emailType] ?? emailCopy.en.biz[emailType];
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
  }
): string {
  return template
    .replace(/\{\{firstName\}\}/g, data.firstName)
    .replace(/\{\{businessName\}\}/g, data.businessName)
    .replace(/\{\{previewUrl\}\}/g, data.previewUrl || "[Preview URL]")
    .replace(/\{\{liveUrl\}\}/g, data.liveUrl || "[Live URL]");
}
