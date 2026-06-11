import { Metadata } from 'next';
import Link from 'next/link';
import { NeonCard, NeonTitle } from '@/components/ui/neon';
import { ArrowLeft, Scale } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service | Glow',
  description: 'Terms of Service for Glow - The Rave screen syncing platform.',
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 md:py-20 space-y-8">
      <div className="flex flex-col space-y-4">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-cyber uppercase tracking-widest text-muted-foreground hover:text-neon-magenta transition-colors w-fit">
          <ArrowLeft className="size-3.5" />
          Back to Terminal
        </Link>
        <div className="flex items-center gap-3">
          <Scale className="size-8 text-neon-magenta neon-text-magenta" />
          <NeonTitle color="magenta" as="h1" className="text-3xl md:text-5xl font-black">
            Terms of Service
          </NeonTitle>
        </div>
        <p className="text-sm text-muted-foreground font-cyber uppercase tracking-wider">
          Last Updated: June 6, 2026
        </p>
      </div>

      <NeonCard borderVariant="magenta" glowColor="none" hoverEffect={false} className="space-y-6 text-sm leading-relaxed text-zinc-300 font-sans">
        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-magenta border-b border-neon-magenta/20 pb-2">
            1. Agreement to Terms
          </h2>
          <p>
            By accessing or using <strong>Glow</strong> (referred to as "the Application", "Glow", "we", "us", or "our"), located at <Link href="https://glowtherave.com" className="text-neon-magenta hover:underline">glowtherave.com</Link>, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to all of these Terms, you are prohibited from using the Application.
          </p>
          <p>
            These Terms constitute a legally binding agreement made between you, whether personally or on behalf of an entity, and <strong>Luis Millán</strong> (the owner).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-magenta border-b border-neon-magenta/20 pb-2">
            2. Intellectual Property Rights
          </h2>
          <p>
            Unless otherwise indicated, the Application and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Application (collectively, the "Content") and the trademarks, service marks, and logos contained therein are owned or controlled by us or licensed to us, and are protected by copyright and trademark laws.
          </p>
          <p>
            The Content is provided on the Application "AS IS" for your information and personal, non-commercial use only. Except as expressly provided in these Terms, no part of the Application or Content may be copied, reproduced, aggregated, republished, uploaded, posted, publicly displayed, encoded, translated, transmitted, distributed, sold, licensed, or otherwise exploited for any commercial purpose whatsoever, without our express prior written permission.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-magenta border-b border-neon-magenta/20 pb-2">
            3. User Representations
          </h2>
          <p>
            By using the Application, you represent and warrant that:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
            <li>All registration information you submit will be true, accurate, current, and complete.</li>
            <li>You will maintain the accuracy of such information and promptly update it as necessary.</li>
            <li>You have the legal capacity and you agree to comply with these Terms.</li>
            <li>You are not a minor in the jurisdiction in which you reside.</li>
            <li>You will not access the Application through automated or non-human means, whether through a bot, script, or otherwise.</li>
            <li>You will not use the Application for any illegal or unauthorized purpose, and your use of the Application will not violate any applicable law or regulation.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-magenta border-b border-neon-magenta/20 pb-2">
            4. User Registration & Accounts
          </h2>
          <p>
            You may be required to register with the Application using Google OAuth. You agree to keep your account details secure and confidential and are responsible for all use of your account. We reserve the right to remove, reclaim, or change a username you select if we determine, in our sole discretion, that such username is inappropriate, obscene, or otherwise objectionable.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-magenta border-b border-neon-magenta/20 pb-2">
            5. Prohibited Activities
          </h2>
          <p>
            You may not access or use the Application for any purpose other than that for which we make the Application available. The Application may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.
          </p>
          <p>
            As a user, you agree not to:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
            <li>Systematically retrieve data or other content from the Application to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.</li>
            <li>Circumvent, disable, or otherwise interfere with security-related features of the Application.</li>
            <li>Engage in unauthorized framing of or linking to the Application.</li>
            <li>Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information.</li>
            <li>Make improper use of our support services or submit false reports of abuse or misconduct.</li>
            <li>Attempt to impersonate another user or person.</li>
            <li>Interfere with, disrupt, or create an undue burden on the Application or the networks or services connected to the Application.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-magenta border-b border-neon-magenta/20 pb-2">
            6. Term and Termination
          </h2>
          <p>
            These Terms shall remain in full force and effect while you use the Application. WITHOUT LIMITING ANY OTHER PROVISION OF THESE TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE APPLICATION (INCLUDING BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON OR FOR NO REASON.
          </p>
          <p>
            If we terminate or suspend your account for any reason, you are prohibited from registering and creating a new account under your name, a fake or borrowed name, or the name of any third party, even if you may be acting on behalf of the third party.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-magenta border-b border-neon-magenta/20 pb-2">
            7. Disclaimer of Warranty & Limitation of Liability
          </h2>
          <p>
            THE APPLICATION IS PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE APPLICATION AND OUR SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE APPLICATION AND YOUR USE THEREOF.
          </p>
          <p>
            IN NO EVENT WILL WE OR OUR EMPLOYEES BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE APPLICATION, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-magenta border-b border-neon-magenta/20 pb-2">
            8. Governing Law
          </h2>
          <p>
            These Terms and your use of the Application are governed by and construed in accordance with the laws of Spain, without regard to its conflict of law principles.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-cyber uppercase tracking-wider text-neon-magenta border-b border-neon-magenta/20 pb-2">
            9. Contact Information
          </h2>
          <p>
            In order to resolve a complaint regarding the Application or to receive further information regarding use of the Application, please contact us at:
          </p>
          <div className="bg-background/40 border border-border/50 rounded-xl p-4 space-y-1 font-cyber text-xs uppercase tracking-wider text-muted-foreground">
            <p><strong>Owner:</strong> Luis Millán</p>
            <p><strong>Email:</strong> <Link href="mailto:paellasounds@gmail.com" className="text-neon-magenta hover:underline normal-case font-sans">paellasounds@gmail.com</Link></p>
            <p><strong>Website:</strong> <Link href="https://glowtherave.com" className="text-neon-magenta hover:underline normal-case font-sans">https://glowtherave.com</Link></p>
          </div>
        </section>
      </NeonCard>
    </main>
  );
}
