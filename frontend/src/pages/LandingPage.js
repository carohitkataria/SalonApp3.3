import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Scissors, Clock, Bell, Star, Users, Calendar,
  Smartphone, MapPin, Sparkles, MessageSquare, Zap, ArrowUpRight, Quote, Check, Gift
} from 'lucide-react';
import { motion } from 'framer-motion';
import SalonHubLogo from '@/components/SalonHubLogo';
import ThemePicker from '@/components/ThemePicker';
import Footer from '@/components/Footer';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || process.env.REACT_APP_BACKEND_URL;

export default function LandingPage() {
  const navigate = useNavigate();

  // Smart routing for "Get Started" button
  const handleGetStarted = async () => {
    // Check if user has visited a salon before
    const lastSalonId = localStorage.getItem('last_visited_salon_id');
    
    if (lastSalonId) {
      // Returning user - go to last visited salon
      navigate(`/salon/${lastSalonId}`);
    } else {
      // Check if user has a phone number in localStorage (from previous bookings)
      const customerPhone = localStorage.getItem('customer_phone');
      if (customerPhone) {
        try {
          const response = await axios.get(`${API_URL}/api/customer/${customerPhone}/last-salon`);
          if (response.data.salon_id) {
            localStorage.setItem('last_visited_salon_id', response.data.salon_id);
            navigate(`/salon/${response.data.salon_id}`);
            return;
          }
        } catch (error) {
          console.warn('Failed to fetch last salon:', error);
        }
      }
      // First-time user - go to salon search
      navigate('/salons');
    }
  };

  // "Subscribe Now" CTA — salon admins go to their dashboard; otherwise login.
  const handleSubscribe = (cycle = 'monthly') => {
    try {
      const auth = JSON.parse(localStorage.getItem('salon_user_auth') || 'null');
      // Persist desired billing cycle for the dashboard to pick up after login.
      localStorage.setItem('preferred_billing_cycle', cycle);
      if (auth?.token && auth?.salonId) {
        navigate(`/salon/dashboard?tab=subscription&cycle=${cycle}`);
      } else {
        navigate('/salon/login', { state: { next: `/salon/dashboard?tab=subscription&cycle=${cycle}` } });
      }
    } catch (_e) {
      navigate('/salon/login');
    }
  };

  // "Start Free Trial" CTA — same routing; dashboard surfaces the trial banner.
  const handleStartTrial = () => {
    try {
      const auth = JSON.parse(localStorage.getItem('salon_user_auth') || 'null');
      localStorage.setItem('start_trial_intent', 'true');
      if (auth?.token && auth?.salonId) {
        navigate(`/salon/dashboard?tab=subscription&trial=1`);
      } else {
        navigate('/salon/login', { state: { next: `/salon/dashboard?tab=subscription&trial=1` } });
      }
    } catch (_e) {
      navigate('/salon/login');
    }
  };

  const pricingPlans = [
    {
      id: 'monthly',
      name: 'Monthly',
      price: '₹999',
      cycle: '/month/branch',
      tagline: 'Billed monthly. Cancel anytime.',
      highlight: false,
      features: [
        'Unlimited staff & customers',
        'Multi-branch dashboard',
        'Staff attendance & payroll',
        'Loyalty, wallet, incentives',
        'WhatsApp booking confirmations',
        'Analytics & reports',
      ],
      cta: 'Subscribe Monthly',
    },
    {
      id: 'yearly',
      name: 'Yearly',
      price: '₹9,999',
      cycle: '/year/branch',
      tagline: 'Save ~17% (2 months free).',
      highlight: true,
      features: [
        'Everything in Monthly',
        '2 months free vs monthly',
        'Priority WhatsApp support',
        'Branded booking QR codes',
        'Customer marketplace access',
        'Lock in this rate for a full year',
      ],
      cta: 'Subscribe Yearly',
    },
  ];

  const features = [
    { icon: Clock,         eyebrow: '01 · LIVE QUEUE',     title: 'Real-time queue, no waiting room',         description: 'Track your token with live position, ETA, and "now serving" status — from anywhere.' },
    { icon: Bell,          eyebrow: '02 · NOTIFICATIONS',  title: 'Whispered when it\'s your turn',           description: 'Browser push and WhatsApp confirmations the moment your stylist calls you in.' },
    { icon: Users,         eyebrow: '03 · YOUR STYLIST',   title: 'Choose the artist, not just the salon',     description: 'Browse stylist portfolios, ratings, and specialties. Book the hands you trust.' },
    { icon: Sparkles,      eyebrow: '04 · MEMBERSHIPS',    title: 'Memberships that pay you back',            description: 'Unlock exclusive house benefits, prepaid wallets, and curated loyalty rewards.' },
    { icon: MapPin,        eyebrow: '05 · DISCOVERY',      title: 'A curated atlas of salons',                 description: 'Find ateliers nearby with maps, filters, and guided previews of each space.' },
    { icon: Star,          eyebrow: '06 · REVIEWS',        title: 'Honest words from real chairs',             description: 'Authentic reviews with photo evidence and per-stylist ratings — no inflation.' },
  ];

  const stats = [
    { label: 'Active salons',       value: '500+'  },
    { label: 'Members served',      value: '50K+'  },
    { label: 'Bookings each day',   value: '2K+'   },
    { label: 'Average rating',      value: '4.8'   },
  ];

  const steps = [
    { step: 'I',   title: 'Discover',  description: 'Browse curated salons near you and explore their stylists, services, and ambience.', icon: MapPin },
    { step: 'II',  title: 'Reserve',   description: 'Pick services, choose your stylist, and confirm your token in seconds.',              icon: Calendar },
    { step: 'III', title: 'Arrive',    description: 'Track the queue live. Walk in only when it\'s your turn — never sooner.',             icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground bg-grain">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-warm border-b border-border/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <SalonHubLogo size={36} showText={true} />

          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Experience</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors" data-testid="nav-pricing-link">Pricing</a>
            <a href="#stats" className="hover:text-foreground transition-colors">House notes</a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemePicker />
            <Button
              variant="ghost"
              onClick={() => navigate('/salon/login')}
              className="hidden sm:inline-flex text-muted-foreground hover:text-foreground hover:bg-transparent"
              data-testid="landing-salon-login-btn"
            >
              For Salons
            </Button>
            <Button
              onClick={() => handleSubscribe('monthly')}
              className="hidden lg:inline-flex bg-transparent border border-brass text-brass hover:bg-brass-soft font-semibold rounded-full px-5 h-9"
              data-testid="header-subscribe-btn"
            >
              Subscribe Now
            </Button>
            <Button
              onClick={() => navigate('/login')}
              className="bg-brass hover:bg-brass-hover text-espresso font-semibold rounded-full px-5 h-9"
              data-testid="landing-login-btn"
            >
              Sign in
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative hero-wash overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[80vw] h-[80vw] max-w-[1100px] max-h-[1100px] rounded-full bg-brass/[0.06] blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-24 pb-20">
          <div className="grid lg:grid-cols-12 gap-12 items-end">
            {/* Headline column */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
              className="lg:col-span-8"
            >
              <div className="inline-flex items-center gap-2 mb-8">
                <span className="h-px w-10 bg-brass/60" />
                <span className="eyebrow-brass">A modern atelier of booking</span>
              </div>

              <h1 className="font-fraunces text-[44px] sm:text-[60px] lg:text-[88px] leading-[0.96] font-light tracking-tightest">
                Book your <span className="serif-italic font-medium brass-text">perfect</span>
                <br />
                salon experience.
              </h1>

              <p className="mt-8 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                Skip the queues. Choose your stylist. Arrive in time for the chair, not the wait.
                A quiet, considered way to book the salons you love.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleGetStarted}
                  className="bg-brass hover:bg-brass-hover text-espresso font-semibold px-7 h-12 rounded-full shadow-brass"
                  data-testid="hero-get-started-btn"
                >
                  <Smartphone className="mr-2 w-4 h-4" />
                  Begin booking
                </Button>
                <Button
                  onClick={() => navigate('/salon/login')}
                  variant="outline"
                  className="bg-transparent border-border hover:border-brass/60 text-foreground hover:bg-transparent px-7 h-12 rounded-full"
                  data-testid="hero-salon-login-btn"
                >
                  <Scissors className="mr-2 w-4 h-4" strokeWidth={1.6} />
                  I run a salon
                </Button>
              </div>
            </motion.div>

            {/* Hero card column */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:col-span-4"
            >
              <div className="lux-card p-6 rounded-2xl bg-card/80">
                <div className="flex items-center justify-between mb-5">
                  <span className="eyebrow">Token</span>
                  <span className="pill-open inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
                    NOW SERVING
                  </span>
                </div>
                <div className="font-bebas text-[88px] leading-none brass-text">#12</div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Stylist</span>
                    <span className="font-medium">Aanya M.</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Before you</span>
                    <span className="font-medium">2 guests</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Estimated</span>
                    <span className="font-medium">~18 min</span>
                  </div>
                </div>
                <div className="mt-5 pt-5 border-t border-border/60 flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Bell className="w-3.5 h-3.5 text-brass" strokeWidth={1.6} />
                  We'll ping you when it's your turn.
                </div>
              </div>
            </motion.div>
          </div>

          {/* Stats strip */}
          <motion.div
            id="stats"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-20 pt-10 border-t border-border/60 grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6"
          >
            {stats.map((stat, idx) => (
              <div key={idx} className="flex flex-col">
                <span className="font-bebas text-[44px] leading-none text-foreground">
                  {stat.value}
                  {stat.label === 'Average rating' && <span className="text-brass">★</span>}
                </span>
                <span className="eyebrow mt-2">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
          <div className="grid lg:grid-cols-12 gap-12 mb-16">
            <div className="lg:col-span-5">
              <span className="eyebrow-brass">The experience</span>
              <h2 className="font-fraunces text-4xl sm:text-5xl mt-4 leading-[1.05] font-light">
                Everything you'd expect <span className="serif-italic font-medium">from your house</span> — and a little more.
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 self-end">
              <p className="text-muted-foreground leading-relaxed">
                A booking system designed like a guestbook, not a ticketing kiosk. Considered moments,
                tactile micro-interactions, and zero noise — so the only color you'll notice is the one
                in the chair.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border/60 rounded-2xl overflow-hidden">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: idx * 0.06 }}
                  className="group relative bg-card p-8 hover:bg-card/60 transition-colors"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-12 h-12 rounded-full border border-brass/40 flex items-center justify-center text-brass group-hover:bg-brass-soft transition-colors">
                      <Icon className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-brass transition-colors" strokeWidth={1.4} />
                  </div>
                  <span className="eyebrow">{feature.eyebrow}</span>
                  <h3 className="font-fraunces text-xl mt-2 mb-3 leading-snug font-medium">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/60 bg-card/40">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
          <div className="text-center mb-16">
            <span className="eyebrow-brass">The ritual</span>
            <h2 className="font-fraunces text-4xl sm:text-5xl mt-4 font-light">
              Three steps, <span className="serif-italic font-medium">no fuss</span>.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-border/60 rounded-2xl overflow-hidden">
            {steps.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="bg-card p-10 relative"
                >
                  <span className="font-fraunces text-[80px] leading-none brass-text serif-italic font-light absolute top-6 right-8 opacity-30 select-none">
                    {item.step}
                  </span>
                  <Icon className="w-7 h-7 text-brass mb-6" strokeWidth={1.5} />
                  <h3 className="font-fraunces text-2xl mb-3 font-medium">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                    {item.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing — Salon SaaS plans */}
      <section id="pricing" className="border-t border-border/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
          <div className="text-center mb-14">
            <span className="eyebrow-brass">For salons</span>
            <h2 className="font-fraunces text-4xl sm:text-5xl mt-4 font-light">
              Simple, <span className="serif-italic font-medium brass-text">per-branch</span> pricing.
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
              Run unlimited staff, customers, and bookings on every branch.
              Start free for 30 days &mdash; no card required.
            </p>
          </div>

          {/* Trial banner */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="lux-card rounded-2xl p-6 mb-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:justify-between"
            data-testid="trial-banner"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-brass-soft flex items-center justify-center text-brass shrink-0">
                <Gift className="w-5 h-5" strokeWidth={1.6} />
              </div>
              <div>
                <span className="eyebrow-brass">30-day free trial</span>
                <h3 className="font-fraunces text-xl font-medium mt-1">
                  Try every feature on the house.
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Unlock multi-branch, payroll, loyalty &amp; analytics free for 1 month. Pay only if you continue.
                </p>
              </div>
            </div>
            <Button
              onClick={handleStartTrial}
              className="bg-brass hover:bg-brass-hover text-espresso font-semibold rounded-full px-6 h-11 shadow-brass shrink-0"
              data-testid="start-free-trial-btn"
            >
              <Gift className="mr-2 w-4 h-4" />
              Start free trial
            </Button>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {pricingPlans.map((p, idx) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: idx * 0.1 }}
                className={`relative rounded-2xl p-8 transition-all ${
                  p.highlight
                    ? 'lux-card bg-card border-2 border-brass shadow-brass'
                    : 'lux-card bg-card border border-border'
                }`}
                data-testid={`pricing-card-${p.id}`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-8 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-brass text-espresso">
                    <Sparkles className="w-3 h-3" /> Best value
                  </span>
                )}
                <span className="eyebrow">{p.name}</span>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-fraunces text-5xl font-light brass-text">{p.price}</span>
                  <span className="text-muted-foreground text-sm">{p.cycle}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{p.tagline}</p>

                <ul className="mt-6 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-brass mt-0.5 shrink-0" strokeWidth={2} />
                      <span className="text-foreground/80">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSubscribe(p.id)}
                  className={`mt-8 w-full font-semibold rounded-full h-11 ${
                    p.highlight
                      ? 'bg-brass hover:bg-brass-hover text-espresso shadow-brass'
                      : 'bg-transparent border border-brass text-brass hover:bg-brass-soft'
                  }`}
                  data-testid={`subscribe-${p.id}-btn`}
                >
                  {p.cta}
                </Button>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-10">
            Prices are per active branch. GST extra where applicable. Cancel anytime &mdash; no lock-in.
          </p>
        </div>
      </section>

      {/* Quote / closing */}
      <section className="border-t border-border/60">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-24 text-center">
          <Quote className="w-8 h-8 text-brass mx-auto mb-6" strokeWidth={1.4} />
          <p className="font-fraunces text-3xl sm:text-4xl leading-tight font-light serif-italic">
            "The chair shouldn't have to wait — and neither should you."
          </p>
          <p className="eyebrow mt-6">— A note from the house</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="lux-card rounded-3xl p-12 lg:p-16 relative overflow-hidden">
            <div className="absolute inset-0 hero-wash opacity-60 pointer-events-none" />
            <div className="relative grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <span className="eyebrow-brass">Ready when you are</span>
                <h2 className="font-fraunces text-4xl sm:text-5xl mt-4 leading-[1.05] font-light">
                  Step inside <span className="serif-italic font-medium brass-text">SalonHub</span>.
                </h2>
                <p className="mt-4 text-muted-foreground leading-relaxed max-w-md">
                  Join thousands of guests who skipped the wait and walked straight to their chair.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 lg:justify-end">
                <Button
                  onClick={() => navigate('/login')}
                  className="bg-brass hover:bg-brass-hover text-espresso font-semibold px-7 h-12 rounded-full shadow-brass"
                  data-testid="cta-start-booking-btn"
                >
                  Start booking
                  <ArrowUpRight className="ml-2 w-4 h-4" />
                </Button>
                <Button
                  onClick={() => navigate('/salon/login')}
                  variant="outline"
                  className="bg-transparent border-border hover:border-brass/60 text-foreground px-7 h-12 rounded-full"
                  data-testid="cta-salon-portal-btn"
                >
                  Salon portal
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
