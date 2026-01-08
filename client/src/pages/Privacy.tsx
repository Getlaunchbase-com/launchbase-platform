import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to LaunchBase
          </Link>
        </div>
      </header>

      <main className="container py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

        <div className="prose prose-invert max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              LaunchBase ("we," "our," or "us") respects your privacy and is committed to 
              protecting your personal data. This Privacy Policy explains how we collect, use, 
              and safeguard your information when you use our website building platform.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong className="text-foreground">Business Information:</strong> Business name, industry, services offered, service area</li>
              <li><strong className="text-foreground">Contact Information:</strong> Name, email address, phone number</li>
              <li><strong className="text-foreground">Payment Information:</strong> Processed securely through Stripe; we do not store card details</li>
              <li><strong className="text-foreground">Website Content:</strong> Text, images, and other content you provide for your website</li>
              <li><strong className="text-foreground">Communications:</strong> Messages and feedback you send us</li>
            </ul>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Build and host your professional website</li>
              <li>Process payments and manage your subscription</li>
              <li>Communicate with you about your account and services</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Send important updates about our platform</li>
              <li>Improve our services and develop new features</li>
            </ul>
          </section>

          {/* Information Sharing */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">4. Information Sharing</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We do not sell your personal information. We may share your information with:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong className="text-foreground">Service Providers:</strong> Third parties who help us operate our platform (hosting, payment processing, email delivery)</li>
              <li><strong className="text-foreground">Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong className="text-foreground">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Your website content will be publicly visible on your published website as intended.
            </p>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational measures to protect your 
              personal data against unauthorized access, alteration, disclosure, or destruction. 
              This includes encryption, secure servers, and regular security assessments. However, 
              no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal data for as long as your account is active or as needed to 
              provide you services. After account cancellation, we may retain certain information 
              as required by law or for legitimate business purposes (such as resolving disputes 
              or enforcing agreements).
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Depending on your location, you may have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Request data portability</li>
              <li>Withdraw consent where applicable</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              To exercise these rights, please contact us at the email below.
            </p>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">8. Cookies & Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies to operate our platform and may use analytics cookies to 
              understand how visitors use our service. You can control cookie preferences through 
              your browser settings. Disabling certain cookies may affect platform functionality.
            </p>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">9. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our platform integrates with third-party services including Stripe (payments), 
              and various analytics providers. These services have their own privacy policies, 
              and we encourage you to review them. We are not responsible for the privacy 
              practices of third parties.
            </p>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">10. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              LaunchBase is not intended for children under 18. We do not knowingly collect 
              personal information from children. If you believe we have collected information 
              from a child, please contact us immediately.
            </p>
          </section>

          {/* Changes to Policy */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">11. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of 
              significant changes by posting the new policy on this page and updating the 
              "Last updated" date. Your continued use of our services after changes constitutes 
              acceptance of the updated policy.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">12. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy or our data practices, please 
              contact us at{" "}
              <a href="mailto:privacy@launchbase.com" className="text-orange-500 hover:underline">
                privacy@launchbase.com
              </a>
            </p>
          </section>

          {/* Agreement */}
          <section className="border-t border-border pt-8 mt-8">
            <p className="text-muted-foreground leading-relaxed">
              By using LaunchBase, you acknowledge that you have read and understood this 
              Privacy Policy.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 mt-12">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} LaunchBase. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
