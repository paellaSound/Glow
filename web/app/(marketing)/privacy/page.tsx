import { Metadata } from 'next';
import Link from 'next/link';
import { NeonCard, NeonTitle } from '@/components/ui/neon';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | Glow',
  description: 'Privacy Policy for Glow - The Rave screen syncing platform.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 md:py-20 space-y-8">
      <div className="flex flex-col space-y-4">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-cyber uppercase tracking-widest text-muted-foreground hover:text-neon-cyan transition-colors w-fit">
          <ArrowLeft className="size-3.5" />
          Back to Terminal
        </Link>
        <div className="flex items-center gap-3">
          <ShieldAlert className="size-8 text-neon-cyan neon-text-cyan" />
          <NeonTitle color="cyan" as="h1" className="text-3xl md:text-5xl font-black">
            Privacy Policy
          </NeonTitle>
        </div>
        <p className="text-sm text-muted-foreground font-cyber uppercase tracking-wider">
          Last Updated: June 6, 2026
        </p>
      </div>

      <NeonCard borderVariant="cyan" glowColor="none" hoverEffect={false} className="space-y-6 text-sm leading-relaxed text-zinc-300 font-sans">
        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-cyan border-b border-neon-cyan/20 pb-2">
            1. Introduction
          </h2>
          <p>
            Welcome to <strong>Glow</strong> (referred to as "the Application", "Glow", "we", "us", or "our"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you visit our website <Link href="https://glowtherave.com" className="text-neon-cyan hover:underline">glowtherave.com</Link> and use our synchronized electronic screen light services.
          </p>
          <p>
            Glow is owned and operated by <strong>Luis Millán</strong>. If you have any questions, you can contact us at <Link href="mailto:paellasounds@gmail.com" className="text-neon-cyan hover:underline">paellasounds@gmail.com</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-cyan border-b border-neon-cyan/20 pb-2">
            2. Information We Collect
          </h2>
          <p>
            To provide our services, we allow users to register and log in using Google OAuth. When you authenticate using Google, we access only the following basic information from your Google Account:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
            <li><strong>Email Address:</strong> To identify your account and send important service communications.</li>
            <li><strong>Full Name:</strong> To personalize your experience in the Application.</li>
            <li><strong>Profile Picture URL:</strong> To display your avatar inside your account and active rooms.</li>
          </ul>
          <p>
            We do not request or access any other sensitive scopes or personal data from your Google account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-cyan border-b border-neon-cyan/20 pb-2">
            3. How We Use Your Information
          </h2>
          <p>
            We use the information we collect solely for the following purposes:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
            <li>To create, manage, and authenticate your user account.</li>
            <li>To allow you to create, join, and sync rooms and lighting grids.</li>
            <li>To display your display name and avatar within the sync interface.</li>
            <li>To maintain and improve the performance and security of the Application.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-cyan border-b border-neon-cyan/20 pb-2">
            4. Data Retention and Deletion
          </h2>
          <p>
            We retain your personal information only as long as you maintain an active account with us. You have the right to request the deletion of your account and all associated data at any time.
          </p>
          <p>
            To request data deletion, you can delete your profile directly from your account settings page, or send an email to <Link href="mailto:paellasounds@gmail.com" className="text-neon-cyan hover:underline">paellasounds@gmail.com</Link>. We will process your deletion request and purge all your personal records from our database within 30 days of receiving the request.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-cyan border-b border-neon-cyan/20 pb-2">
            5. Security of Your Data
          </h2>
          <p>
            We implement industry-standard administrative, technical, and physical security measures to protect your personal information. All communications between the client and our servers are encrypted using Secure Socket Layer (SSL/TLS) technology.
          </p>
          <p>
            However, please remember that no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-cyan border-b border-neon-cyan/20 pb-2">
            6. Sharing and Third Parties
          </h2>
          <p>
            We do not sell, rent, trade, or otherwise transfer your personal information to third parties. We only share information with partners and processors required to host our servers (like Supabase and Vercel) and process payments (like Stripe), who are contractually bound to protect your data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-cyan border-b border-neon-cyan/20 pb-2">
            7. Changes to This Privacy Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date at the top of this document. We encourage you to review this policy periodically for any changes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-cyan border-b border-neon-cyan/20 pb-2">
            8. Contact Us
          </h2>
          <p>
            If you have any questions or concerns about this Privacy Policy, please contact us at:
          </p>
          <div className="bg-background/40 border border-border/50 rounded-xl p-4 space-y-1 font-cyber text-xs uppercase tracking-wider text-muted-foreground">
            <p><strong>Owner:</strong> Luis Millán</p>
            <p><strong>Email:</strong> <Link href="mailto:paellasounds@gmail.com" className="text-neon-cyan hover:underline normal-case font-sans">paellasounds@gmail.com</Link></p>
            <p><strong>Website:</strong> <Link href="https://glowtherave.com" className="text-neon-cyan hover:underline normal-case font-sans">https://glowtherave.com</Link></p>
          </div>
        </section>
      </NeonCard>
    </main>
  );
}
