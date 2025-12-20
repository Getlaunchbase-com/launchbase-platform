import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
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
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

        <div className="prose prose-invert max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">1. Agreement Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms of Service ("Terms") govern your use of LaunchBase, a website building 
              and hosting platform for service businesses. By clicking "Approve & Pay" or using 
              our services, you agree to these Terms.
            </p>
          </section>

          {/* What We Provide */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">2. What We Provide</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              LaunchBase provides:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Professional website design and development based on your intake information</li>
              <li>Website hosting and infrastructure</li>
              <li>Lead capture and contact form functionality</li>
              <li>Ongoing technical support and maintenance</li>
              <li>Platform updates and improvements</li>
            </ul>
          </section>

          {/* Pricing */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">3. Pricing & Payment</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">Founding Client Pricing:</strong>
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong className="text-foreground">$499</strong> one-time setup fee (charged upon approval)</li>
              <li><strong className="text-foreground">$79/month</strong> ongoing hosting and support (billed monthly after launch)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Founding client pricing is locked for as long as your account remains active. 
              Future customers may pay higher rates.
            </p>
          </section>

          {/* Approval Process */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">4. Approval Process</h2>
            <p className="text-muted-foreground leading-relaxed">
              When you click "Approve & Pay," you are confirming:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
              <li>You have reviewed your build plan and website preview</li>
              <li>You approve the scope, features, and design direction</li>
              <li>You authorize the one-time setup charge</li>
              <li>You agree to these Terms of Service</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              This approval is logged with timestamp and serves as your agreement to proceed.
            </p>
          </section>

          {/* What's Not Included */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">5. What's Not Included</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The following are outside the scope of standard LaunchBase service:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Custom feature development beyond the build plan</li>
              <li>Third-party integrations not specified in your plan</li>
              <li>Content writing or copywriting services</li>
              <li>Photography or custom graphics</li>
              <li>Domain registration (you provide or purchase separately)</li>
              <li>Email hosting services</li>
            </ul>
          </section>

          {/* Revisions */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">6. Revisions & Changes</h2>
            <p className="text-muted-foreground leading-relaxed">
              Before approval, you may request reasonable revisions to your build plan at no 
              additional cost. After approval and payment, minor text and image updates are 
              included in your monthly service. Significant redesigns or feature additions 
              may incur additional fees, quoted in advance.
            </p>
          </section>

          {/* Cancellation */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">7. Cancellation</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may cancel your monthly subscription at any time. Upon cancellation:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
              <li>Your website will remain active until the end of your billing period</li>
              <li>No refunds are provided for partial months or the setup fee</li>
              <li>You may export your content before cancellation</li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">8. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of your business content, logos, and images. LaunchBase 
              retains ownership of the underlying platform, templates, and code. Your website 
              design is licensed to you for use while your subscription is active.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              LaunchBase is provided "as is." We are not liable for indirect, incidental, or 
              consequential damages. Our total liability is limited to the amount you've paid 
              us in the 12 months preceding any claim.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">10. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Questions about these Terms? Contact us at{" "}
              <a href="mailto:support@launchbase.com" className="text-orange-500 hover:underline">
                support@launchbase.com
              </a>
            </p>
          </section>

          {/* Agreement */}
          <section className="border-t border-border pt-8 mt-8">
            <p className="text-muted-foreground leading-relaxed">
              By using LaunchBase, you acknowledge that you have read, understood, and agree 
              to be bound by these Terms of Service.
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
