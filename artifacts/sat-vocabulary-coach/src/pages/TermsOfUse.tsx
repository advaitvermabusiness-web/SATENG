import { ChevronLeft, Scale } from 'lucide-react';
import { Link } from 'wouter';

export function TermsOfUse() {
  return (
    <main className="min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-8 text-[hsl(var(--foreground))] md:px-10 md:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))] no-underline hover:text-[hsl(var(--primary))]">
            <ChevronLeft size={16} /> Back to Wordwell
          </Link>
          <div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Legal</div>
        </div>

        <header className="mt-16 border-b border-[hsl(var(--border))] pb-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
            <Scale size={24} />
          </div>
          <div className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Terms of Use</div>
          <h1 className="mt-2 font-display text-5xl tracking-[-.05em]">The terms for using Wordwell.</h1>
          <p className="mt-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            Effective date: [Insert effective date] · Last updated: [Insert update date]
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.07)] p-5" aria-labelledby="terms-acceptance-title">
          <h2 id="terms-acceptance-title" className="text-sm font-extrabold">Agreement to these Terms</h2>
          <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            By accessing or using Wordwell, you acknowledge that you have read, understood, and agree to be bound by these Terms of Use, including the Agreement to Arbitrate and Class Action Waiver below. If you do not agree to these Terms, do not access or use the application.
          </p>
        </section>

        <article className="prose prose-sm mt-10 max-w-none text-[hsl(var(--foreground))] prose-headings:font-display prose-headings:font-normal prose-headings:tracking-[-.03em] prose-p:leading-relaxed prose-p:text-[hsl(var(--muted-foreground))] prose-li:text-[hsl(var(--muted-foreground))]">
          <h2>1. Use of Wordwell</h2>
          <p>
            Wordwell provides vocabulary-learning tools, study materials, recall exercises, and related educational features. Wordwell is for educational purposes and does not guarantee a particular learning outcome, examination result, or score.
          </p>

          <h2>2. Agreement to Arbitrate</h2>
          <p>
            Except for the disputes and claims described in the Exceptions section below, any dispute, claim, or controversy arising out of or relating to these Terms, Wordwell, or your access to or use of the application will be resolved by final and binding arbitration on an individual basis, rather than in court.
          </p>
          <p>
            The arbitration will be administered by the American Arbitration Association under its applicable consumer arbitration rules. The Federal Arbitration Act governs the interpretation and enforcement of this Agreement to Arbitrate. The arbitrator, and not a court, will generally decide disputes about the interpretation, applicability, enforceability, or formation of this arbitration provision, including whether any dispute is arbitrable.
          </p>
          <p>
            The arbitration may be conducted remotely, based on written submissions, or in a mutually agreed location. The arbitrator may award the same individual relief that a court could award. The arbitrator’s decision may be entered as a judgment in any court with jurisdiction.
          </p>

          <h2>3. Class Action and Representative Action Waiver</h2>
          <p>
            To the fullest extent permitted by law, you and Wordwell agree that each claim may be brought only in your or Wordwell’s individual capacity and not as a plaintiff, class member, representative, private attorney general, or participant in any class, collective, consolidated, or representative action or arbitration. The arbitrator may not combine or consolidate claims or preside over any representative proceeding.
          </p>

          <h2>4. Exceptions to Arbitration</h2>
          <p>
            Either party may bring an individual action in small claims court if the claim qualifies. Either party may also seek temporary or preliminary injunctive relief in court to protect intellectual property rights, prevent unauthorized access, or prevent misuse of the application while arbitration is pending.
          </p>

          <h2>5. Right to Opt Out of Arbitration</h2>
          <p>
            You may opt out of the Agreement to Arbitrate and Class Action Waiver by sending written notice to [Insert legal contact email or mailing address] within thirty (30) days after you first access or use Wordwell. Your notice must include your name, the email address associated with your account, and a clear statement that you are opting out of the arbitration provision and class-action waiver. Opting out will not affect any other part of these Terms.
          </p>

          <h2>6. Governing Law</h2>
          <p>
            Except to the extent governed by the Federal Arbitration Act, these Terms are governed by the laws of [Insert state], without regard to its conflict-of-law rules.
          </p>

          <h2>7. Severability</h2>
          <p>
            If any part of the Agreement to Arbitrate or Class Action Waiver is found unenforceable, the remaining provisions will remain in effect to the fullest extent permitted by law. If the class-action waiver is found unenforceable as to a particular claim, that claim must proceed in court and not in arbitration.
          </p>

          <h2>8. Changes and Contact</h2>
          <p>
            [Insert terms for updates, notice of material changes, legal entity name, and contact information.]
          </p>
        </article>

        <footer className="mt-12 border-t border-[hsl(var(--border))] pt-6 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
          This arbitration provision is a draft template and should be reviewed by qualified U.S. legal counsel before publication. State law, consumer arbitration rules, user age, business structure, and the signup or consent flow may affect enforceability.
        </footer>
      </div>
    </main>
  );
}