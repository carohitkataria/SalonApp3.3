import { useNavigate } from 'react-router-dom';
import { Mail, MessageCircle } from 'lucide-react';
import SalonHubLogo from './SalonHubLogo';

// Brand-icon SVGs (lucide-react v1 doesn't ship social brand icons)
const Instagram = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
);
const Facebook = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);
const Linkedin = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);
const Youtube = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 7.5a2.8 2.8 0 0 0-2-2C18.3 5 12 5 12 5s-6.3 0-8 .5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1.5 12 29 29 0 0 0 2 16.5a2.8 2.8 0 0 0 2 2C5.7 19 12 19 12 19s6.3 0 8-.5a2.8 2.8 0 0 0 2-2A29 29 0 0 0 22.5 12 29 29 0 0 0 22 7.5z" />
    <polygon points="9.75 8.5 15.5 12 9.75 15.5 9.75 8.5" fill="currentColor" />
  </svg>
);

/**
 * App-wide footer (luzo-inspired).
 * Slim, four columns on desktop, stacks on mobile.
 */
export default function Footer() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  const company = [
    { label: 'About Us',         action: () => navigate('/about') },
    { label: 'Partner With Us',  action: () => navigate('/salon/login') },
    { label: 'Find a Salon',     action: () => navigate('/salons') },
    { label: 'Help',             action: () => navigate('/help') },
  ];

  const legal = [
    { label: 'Privacy Policy',     action: () => navigate('/privacy') },
    { label: 'Terms of Service',   action: () => navigate('/terms') },
    { label: 'Merchant Terms',     action: () => navigate('/merchant-terms') },
  ];

  return (
    <footer className="border-t border-border/60 bg-card/40 mt-12" data-testid="app-footer">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 grid md:grid-cols-12 gap-10">
        {/* Brand column */}
        <div className="md:col-span-4 flex flex-col gap-5">
          <SalonHubLogo size={48} showText={true} />
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            Discover luxury salons, spas and stylists near you. Skip the wait, choose your chair, and arrive in time — only with SalonHub.
          </p>
          <div className="flex items-center gap-2 mt-2">
            {[
              { icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
              { icon: Facebook,  href: 'https://facebook.com',  label: 'Facebook' },
              { icon: Linkedin,  href: 'https://linkedin.com',  label: 'LinkedIn' },
              { icon: Youtube,   href: 'https://youtube.com',   label: 'YouTube' },
            ].map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                data-testid={`footer-social-${label.toLowerCase()}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card hover:border-brass/60 hover:text-brass transition-colors text-muted-foreground"
              >
                <Icon width={16} height={16} className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Company column */}
        <div className="md:col-span-3">
          <h4 className="text-foreground font-semibold mb-5 text-base">Company</h4>
          <ul className="space-y-3">
            {company.map(item => (
              <li key={item.label}>
                <button
                  onClick={item.action}
                  className="text-sm text-muted-foreground hover:text-brass transition-colors"
                  data-testid={`footer-company-${item.label.toLowerCase().replace(/ /g,'-')}`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal column */}
        <div className="md:col-span-2">
          <h4 className="text-foreground font-semibold mb-5 text-base">Legal</h4>
          <ul className="space-y-3">
            {legal.map(item => (
              <li key={item.label}>
                <button
                  onClick={item.action}
                  className="text-sm text-muted-foreground hover:text-brass transition-colors text-left"
                  data-testid={`footer-legal-${item.label.toLowerCase().replace(/ /g,'-')}`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact column */}
        <div className="md:col-span-3">
          <h4 className="text-foreground font-semibold mb-5 text-base">Contact Us</h4>
          <ul className="space-y-3">
            <li>
              <a
                href="https://wa.me/917503070727"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brass transition-colors group"
                data-testid="footer-whatsapp-link"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brass-soft border border-brass/20 group-hover:bg-brass group-hover:text-espresso transition-colors text-brass">
                  <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.7} />
                </span>
                <span>
                  WhatsApp
                  <span className="block text-[11px] text-muted-foreground/70">+91 75030 70727</span>
                </span>
              </a>
            </li>
            <li>
              <a
                href="mailto:carohitkataria@gmail.com"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brass transition-colors group"
                data-testid="footer-email-link"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brass-soft border border-brass/20 group-hover:bg-brass group-hover:text-espresso transition-colors text-brass">
                  <Mail className="w-3.5 h-3.5" strokeWidth={1.7} />
                </span>
                <span>
                  Email
                  <span className="block text-[11px] text-muted-foreground/70">carohitkataria@gmail.com</span>
                </span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {year} SalonHub. All rights reserved.</span>
          <span className="serif-italic">Crafted with care for the chair.</span>
        </div>
      </div>
    </footer>
  );
}
