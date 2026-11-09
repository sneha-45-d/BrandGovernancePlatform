
import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  CircleCheck,
  FileSearch,
  Fingerprint,
  Gauge,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'

const capabilities = [
  {
    icon: Fingerprint,
    title: 'Make your voice unmistakable',
    description: 'Bring tone, terminology, and messaging guidance into one shared source of truth.',
  },
  {
    icon: FileSearch,
    title: 'Catch issues before they ship',
    description: 'Review content for brand consistency and get clear, actionable findings.',
  },
  {
    icon: WandSparkles,
    title: 'Move from feedback to better copy',
    description: 'Use guided corrections to make content clearer while keeping its intent.',
  },
]

const workflow = [
  { number: '01', title: 'Set your guidelines', icon: ShieldCheck },
  { number: '02', title: 'Review your content', icon: FileSearch },
  { number: '03', title: 'Approve with confidence', icon: CheckCheck },
]

function BrandLogo() {
  return (
    <Link to="/" className="brandithm-logo flex items-center gap-3" aria-label="Brandithm home">
      <span className="brandithm-mark">B</span>
      <span className="brandithm-display text-xl">BRANDITHM</span>
    </Link>
  )
}

function ReviewPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[610px]">
      <div className="landing-preview-glow" />

      <div className="relative overflow-hidden rounded-[26px] border border-emerald-300/20 bg-[#09130f]/95 p-4 text-white shadow-2xl backdrop-blur-xl sm:p-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-white">Content review</p>
              <p className="mt-1 text-xs text-slate-400">Brand alignment overview</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300">
            Review complete
          </span>
        </div>

        <div className="grid gap-4 py-6 sm:grid-cols-[1fr_150px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-300">
              <FileSearch className="h-4 w-4 text-emerald-300" />
              Brand voice check
            </div>

            <div className="space-y-3" aria-hidden="true">
              <div className="h-2 w-full rounded-full bg-white/10" />
              <div className="h-2 w-[92%] rounded-full bg-white/10" />
              <div className="h-2 w-[78%] rounded-full bg-emerald-400/60" />
              <div className="h-2 w-[86%] rounded-full bg-white/10" />
            </div>

            <div className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <p className="text-xs leading-5 text-slate-300">
                Review findings and suggested improvements in one place.
              </p>
            </div>
          </div>

          <div className="flex flex-row items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:flex-col sm:justify-center">
            <div className="text-center">
              <div className="mx-auto flex h-[82px] w-[82px] items-center justify-center rounded-full border-[5px] border-emerald-400/70 bg-emerald-400/[0.08] shadow-[0_0_30px_rgba(16,185,129,0.13)]">
                <Gauge className="h-8 w-8 text-emerald-300" />
              </div>
              <p className="mt-3 text-[11px] font-medium text-slate-400">Alignment score</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 sm:mt-4">
              <Check className="h-4 w-4" />
              Ready to review
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.035] px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Your team makes the final call.
          </div>
          <span className="text-[11px] font-semibold text-emerald-300">Brandithm AI</span>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-2 hidden items-center gap-3 rounded-2xl border border-emerald-300/20 bg-[#10251b]/95 p-3 shadow-xl backdrop-blur-xl sm:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
          <CheckCheck className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-xs font-bold text-white">Review, resolved</span>
          <span className="mt-1 block text-[11px] text-slate-400">A clear next step for every issue</span>
        </span>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { user } = useAuth()
  const primaryHref = user ? '/dashboard' : '/signup'
  const primaryLabel = user ? 'Open your workspace' : 'Get started'

  const [showIntro, setShowIntro] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIntro(false), 4200)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,800;9..144,900&display=swap');

        .brandithm-display,
        .brandithm-intro-mark,
        .brandithm-intro-word {
          font-family: 'Fraunces', Georgia, serif;
          font-style: normal !important;
          font-weight: 900;
          font-variation-settings: 'SOFT' 70, 'WONK' 1, 'opsz' 144;
        }

        .brandithm-intro {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: radial-gradient(ellipse at center, rgba(35,82,52,.42), transparent 62%), #07130d;
          animation: brandithm-intro-fade 4.2s ease 3.45s forwards;
        }

        .brandithm-intro-lockup {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: clamp(58px, 7vw, 88px);
          white-space: nowrap;
          transform: none;
        }

        .brandithm-intro-mark {
          position: relative;
          z-index: 2;
          display: inline-block;
          flex: 0 0 auto;
          color: #e5d6b2 !important;
          font-size: clamp(58px, 7vw, 88px) !important;
          line-height: .82;
          opacity: 1 !important;
          visibility: visible !important;
          transform: scale(4.1);
          transform-origin: center;
          text-shadow: 0 0 14px rgba(229,214,178,.62), 0 0 38px rgba(229,214,178,.38);
          filter: drop-shadow(0 0 22px rgba(229,214,178,.34));
          animation: brandithm-b-shrink 1.35s cubic-bezier(.2,.8,.2,1) forwards;
        }

        .brandithm-intro-word {
          position: relative;
          z-index: 1;
          display: inline-block;
          flex: 0 0 auto;
          max-width: 0;
          margin-left: -.08em;
          overflow: hidden;
          color: #e5d6b2 !important;
          font-size: clamp(58px, 7vw, 88px) !important;
          line-height: .92;
          letter-spacing: -.055em;
          opacity: 0;
          clip-path: inset(0 100% 0 0);
          text-shadow: 0 0 14px rgba(229,214,178,.62), 0 0 38px rgba(229,214,178,.38);
          animation: brandithm-word-reveal 1.25s cubic-bezier(.22,1,.36,1) 1.12s forwards;
        }

        @keyframes brandithm-b-shrink {
          0% { transform: scale(4.1); }
          100% { transform: scale(1); }
        }

        @keyframes brandithm-word-reveal {
          0% { max-width: 0; opacity: 0; clip-path: inset(0 100% 0 0); }
          12% { opacity: 1; }
          100% { max-width: 5.15em; opacity: 1; clip-path: inset(0 0 0 0); }
        }

        @keyframes brandithm-intro-fade {
          to { opacity: 0; visibility: hidden; pointer-events: none; }
        }

        @media (max-width: 640px) {
          .brandithm-intro-lockup { font-size: 58px; transform: scale(.78); }
          .brandithm-intro-mark { transform: scale(4.1); }
          @keyframes brandithm-b-shrink {
            0% { transform: scale(4.1); }
            100% { transform: scale(1); }
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .brandithm-intro { animation-duration: 1ms; animation-delay: 2.5s; }
          .brandithm-intro-mark,
          .brandithm-intro-word { animation-duration: 1ms; animation-delay: 0ms; }
        }
        /* Light mode: a warm ivory / deep-forest version of the same brand system. */
        body[data-theme='light'] .landing-shell {
          color: #17372a !important;
          background:
            radial-gradient(ellipse at 50% 35%, rgba(16,185,129,.12), transparent 48%),
            radial-gradient(ellipse at 8% 82%, rgba(16,120,78,.08), transparent 42%),
            linear-gradient(135deg, #f7fbf7 0%, #edf5ef 52%, #e7f1e9 100%) !important;
        }
        body[data-theme='light'] .landing-shell::before {
          opacity: .55;
          background: repeating-linear-gradient(125deg, transparent 0%, transparent 17%, rgba(16,120,78,.045) 17.2%, transparent 17.7%, transparent 34%) !important;
        }
        body[data-theme='light'] .landing-shell::after { opacity: .35; }
        body[data-theme='light'] .landing-shell .text-white,
        body[data-theme='light'] .landing-shell h1,
        body[data-theme='light'] .landing-shell h2,
        body[data-theme='light'] .landing-shell h3 {
          color: #153b2b !important;
        }
        body[data-theme='light'] .landing-shell .text-slate-200,
        body[data-theme='light'] .landing-shell .text-slate-300,
        body[data-theme='light'] .landing-shell .text-slate-400,
        body[data-theme='light'] .landing-shell .text-slate-500 {
          color: #587365 !important;
          opacity: 1 !important;
        }
        body[data-theme='light'] .landing-shell header nav {
          padding: .65rem .9rem;
          border: 1px solid rgba(31,91,64,.12);
          border-radius: 999px;
          background: rgba(255,255,255,.58);
          backdrop-filter: blur(14px);
        }
        body[data-theme='light'] .landing-shell #platform {
          border-color: rgba(31,91,64,.14) !important;
          background: rgba(255,255,255,.68) !important;
          box-shadow: 0 24px 70px rgba(24,70,48,.08) !important;
        }
        body[data-theme='light'] .landing-shell .landing-capability-card,
        body[data-theme='light'] .landing-shell .landing-step-card {
          border-color: rgba(31,91,64,.13) !important;
          background: rgba(255,255,255,.72) !important;
          box-shadow: 0 14px 36px rgba(24,70,48,.07) !important;
        }
        body[data-theme='light'] .landing-shell .landing-cta {
          color: #f0fdf4 !important;
          background: linear-gradient(115deg, #123b2b 0%, #176344 55%, #08734f 100%) !important;
          border: 1px solid rgba(16,120,78,.2);
        }
        body[data-theme='light'] .landing-shell .landing-cta h2 { color: #f0fdf4 !important; }
        body[data-theme='light'] .landing-shell .landing-cta p { color: #ccebd8 !important; }
        body[data-theme='light'] .landing-shell .landing-gradient-text {
          background: linear-gradient(95deg, #08734f 0%, #10a36b 48%, #3a9a70 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
        }
        body[data-theme='light'] .landing-shell .landing-primary-button {
          color: #fff !important;
          background: linear-gradient(110deg, #08734f 0%, #0b9663 52%, #22ad78 100%) !important;
        }
        body[data-theme='light'] .landing-shell .border-white\\/15,
        body[data-theme='light'] .landing-shell .border-white\\/10 {
          border-color: rgba(31,91,64,.18) !important;
        }
        body[data-theme='light'] .landing-shell .bg-white\\/[0.04],
        body[data-theme='light'] .landing-shell .bg-white\\/[0.025],
        body[data-theme='light'] .landing-shell .bg-white\\/[0.035] {
          background: rgba(255,255,255,.55) !important;
        }
        body[data-theme='light'] .landing-shell .brandithm-logo .brandithm-display { color: #153b2b !important; }
      `}</style>
      {showIntro && (
        <div className="brandithm-intro" aria-label="Brandithm">
          <div className="brandithm-intro-lockup">
            <span className="brandithm-intro-mark">B</span>
            <span className="brandithm-intro-word">RANDITHM</span>
          </div>
        </div>
      )}

      <main className="landing-shell min-h-screen">
        <div className="landing-content relative z-10 mx-auto max-w-7xl px-5 pb-12 sm:px-8 lg:px-10">

          <header className="flex flex-col items-center gap-5 py-5 sm:py-7">
            <BrandLogo />
            <nav className="flex flex-wrap items-center justify-center gap-3 sm:gap-7" aria-label="Main navigation">
              <a className="hidden text-sm font-semibold text-slate-300 transition hover:text-emerald-300 sm:inline" href="#platform">
                Platform
              </a>
              <a className="hidden text-sm font-semibold text-slate-300 transition hover:text-emerald-300 sm:inline" href="#workflow">
                How it works
              </a>
              <Link to="/pricing" className="hidden text-sm font-semibold text-slate-300 transition hover:text-emerald-300 sm:inline">
                Pricing
              </Link>
              <Link to={user ? '/dashboard' : '/signin'} className="text-sm font-bold text-white transition hover:text-emerald-300">
                {user ? 'Workspace' : 'Sign in'}
              </Link>
            </nav>
          </header>

          <section className="grid grid-cols-1 justify-items-center gap-12 pb-20 pt-12 sm:pt-16 lg:gap-10 lg:pb-28 lg:pt-20">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-2 text-xs font-bold text-emerald-300 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                A clearer standard for every brand
              </div>

              <h1 className="text-[3.4rem] font-black leading-[0.98] tracking-[-0.075em] text-white sm:text-6xl lg:text-[4.5rem]">
                Keep every word
                <span className="landing-gradient-text block">true to your brand.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
                Bring your guidelines, content reviews, and approvals together. Help every team create consistent work with less back-and-forth.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link to={primaryHref} className="landing-primary-button inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white">
                  {primaryLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <a href="#platform" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3.5 text-sm font-bold text-slate-200 transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.06]">
                  Explore the platform
                  <ArrowDown className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-3 text-xs font-medium text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Brand guidelines in one place
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Human-led review decisions
                </span>
              </div>
            </div>

            <ReviewPreview />
          </section>

          <section id="platform" className="scroll-mt-8 rounded-[30px] border border-emerald-300/15 bg-[#0b1711]/75 px-5 py-10 shadow-[0_24px_90px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:px-9 sm:py-14">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-black uppercase tracking-[0.22em] text-emerald-400">One connected workflow</span>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.055em] text-white sm:text-4xl">
                Brand consistency, built into the process.
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-400 sm:text-base">
                Turn brand standards into practical guidance teams can use while creating and reviewing content.
              </p>
            </div>

            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {capabilities.map(({ icon: Icon, title, description }) => (
                <article key={title} className="landing-capability-card rounded-2xl border border-emerald-300/10 bg-white/[0.025] p-5 text-center transition duration-300 hover:-translate-y-1 hover:border-emerald-300/30 hover:bg-emerald-400/[0.04] sm:p-6">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-[14px] border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-extrabold tracking-tight text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="workflow" className="grid scroll-mt-8 justify-items-center gap-8 py-16 text-center sm:py-20">
            <div>
              <span className="text-xs font-black uppercase tracking-[0.22em] text-emerald-400">Simple by design</span>
              <h2 className="mt-3 max-w-md text-3xl font-black leading-tight tracking-[-0.055em] text-white sm:text-4xl">
                From brand rules to confident approvals.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-slate-400 sm:text-base">
                Keep your standards visible, your feedback actionable, and your final decisions with your team.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-3">
              {workflow.map(({ number, title, icon: Icon }) => (
                <div key={number} className="landing-step-card rounded-2xl border border-emerald-300/15 bg-[#0b1711]/70 p-5 text-center backdrop-blur-xl transition hover:border-emerald-300/40">
                  <div className="flex items-center justify-center gap-4">
                    <span className="text-xs font-black tracking-widest text-emerald-400">{number}</span>
                    <Icon className="h-5 w-5 text-emerald-300" />
                  </div>
                  <p className="mt-8 text-base font-extrabold leading-snug text-white">{title}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="landing-cta flex flex-col items-center justify-center gap-6 rounded-[26px] px-6 py-8 text-center text-white sm:px-9 sm:py-9">
            <div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                Make brand confidence part of every review.
              </h2>
              <p className="mt-2 text-sm text-emerald-100/70">
                Start building a more consistent content workflow.
              </p>
            </div>
            <Link to={primaryHref} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200/30 bg-white px-5 py-3.5 text-sm font-bold text-emerald-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50">
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <footer className="flex flex-col items-center justify-center gap-3 py-8 text-center text-xs text-slate-500">
            <BrandLogo />
            <p>Brandithm · A thoughtful way to govern your brand voice.</p>
            <Link to="/signin" className="font-semibold text-slate-400 transition hover:text-emerald-300">
              Sign in
            </Link>
          </footer>
        </div>
      </main>
    </>
  )
}

