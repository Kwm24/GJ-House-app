import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Printer, Layers, Tag, Gift, Zap, Shield, DollarSign, MapPin,
  Menu, X, Phone, Mail, BookOpen, ShoppingBag, MessageCircle,
} from "lucide-react";
import { getSettings } from "../lib/settings.js";
import { InstantQuoter, buildInstantQuoteSummary } from "../components/InstantQuoter.jsx";

// ── Icon sets ─────────────────────────────────────────────────────────────────
const SERVICE_ICONS = {
  printer: Printer, layers: Layers, tag: Tag, gift: Gift,
  book: BookOpen, bag: ShoppingBag,
};
// Per-position fallback icons to ensure visual variety
const SERVICE_ICON_FALLBACK = [Printer, BookOpen, Tag, ShoppingBag];
const WHY_ICONS = [Zap, Shield, DollarSign, MapPin];

// ── Colour helpers ─────────────────────────────────────────────────────────────
function darkenHex(hex, amount = 0.15) {
  const h = (hex || "#6366F1").replace(/^#/, "").padEnd(6, "0");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex;
  const n = parseInt(h, 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  const r = c((n >> 16) & 255);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

// ── Scroll-reveal component ───────────────────────────────────────────────────
function Reveal({ children, delay = 0, direction = "up", className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const transforms = {
    up:    visible ? "translateY(0)"  : "translateY(28px)",
    down:  visible ? "translateY(0)"  : "translateY(-20px)",
    left:  visible ? "translateX(0)"  : "translateX(28px)",
    right: visible ? "translateX(0)"  : "translateX(-28px)",
    scale: visible ? "scale(1)"       : "scale(0.94)",
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  transforms[direction] ?? transforms.up,
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── Default content ───────────────────────────────────────────────────────────
const DEFAULT = {
  hero: {
    headline: "Premium Print Solutions for Ghanaian Businesses",
    subhead: "From digital prints to large-format banners — delivered fast, crafted with precision.",
  },
  stats: [
    { value: "500+", label: "Jobs Completed" },
    { value: "200+", label: "Happy Clients"  },
    { value: "48hr", label: "Avg. Turnaround"},
    { value: "100%", label: "Quality Guarantee" },
  ],
  services: [
    { name: "Digital Printing",    description: "Sharp, vibrant prints for flyers, brochures, business cards and more.",     icon: "printer", image_url: "" },
    { name: "Offset Printing",     description: "High-volume, cost-effective printing with consistent colour accuracy.",      icon: "book",    image_url: "" },
    { name: "Labels & Stickers",   description: "Custom labels and stickers for products, packaging and branding.",          icon: "tag",     image_url: "" },
    { name: "Branded Merchandise", description: "T-shirts, bags, mugs and souvenirs with your logo and identity.",          icon: "bag",     image_url: "" },
  ],
  features: [
    { title: "Fast Turnaround",     description: "Most orders ready within 24–48 hours. Urgent? We have same-day options."    },
    { title: "Quality Control",     description: "Every print goes through a multi-point quality check before delivery."      },
    { title: "Competitive Pricing", description: "Fair, transparent pricing with no hidden charges. Bulk discounts available." },
    { title: "Pan-Ghana Delivery",  description: "We deliver to all regions across Ghana. Door-to-door available in Accra."   },
  ],
  steps: [
    { number: "01", title: "Get a Quote",     description: "Sign up and submit your job details. We'll review and send you a quote within the hour." },
    { number: "02", title: "Pay Deposit",     description: "Approve your quote and pay a 60% deposit to get your order started."                      },
    { number: "03", title: "Review Design",   description: "Our team creates your artwork. Review and approve before we go to print."                 },
    { number: "04", title: "Collect & Enjoy", description: "Your finished prints are ready. Pick up or we deliver straight to you."                  },
  ],
  cta: {
    headline: "Ready to bring your brand to life?",
    subhead: "Create your account in 2 minutes and get your first quote today.",
  },
  contact: { address: "Accra, Ghana", phone: "", email: "" },
  global_styles: {
    text_color:     "#0A0A0A",
    text_secondary: "#6B6B6B",
    accent_color:   "#6366F1",
    button_color:   "",
    nav_bg:         "#FFFFFF",
    nav_text:       "#0A0A0A",
  },
  section_styles: {
    hero:     { bg_color: "#FFFFFF", bg_image_url: "", bg_overlay: 0.5, hidden: false, text_color: "", text_secondary: "" },
    stats:    { bg_color: "#FFFFFF", bg_image_url: "",                  hidden: false, text_color: "", text_secondary: "" },
    services: { bg_color: "#FAFAFA", bg_image_url: "", bg_overlay: 0.5, hidden: false, text_color: "", text_secondary: "" },
    features: { bg_color: "#FFFFFF", bg_image_url: "", bg_overlay: 0.5, hidden: false, text_color: "", text_secondary: "" },
    steps:    { bg_color: "#FAFAFA", bg_image_url: "", bg_overlay: 0.5, hidden: false, text_color: "", text_secondary: "" },
    cta:      { bg_color: "#F4F4FF", bg_image_url: "", bg_overlay: 0.4, hidden: false, text_color: "", text_secondary: "" },
    footer:   { bg_color: "#FFFFFF", bg_image_url: "",                  hidden: false, text_color: "", text_secondary: "" },
  },
};

function merge(defaults, overrides) {
  if (!overrides) return defaults;
  const merged = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (overrides[key] === undefined || overrides[key] === null) continue;
    if (key === "section_styles") {
      merged[key] = {};
      for (const sub of Object.keys(defaults[key])) {
        merged[key][sub] = { ...defaults[key][sub], ...(overrides[key]?.[sub] ?? {}) };
      }
    } else if (key === "global_styles") {
      merged[key] = { ...defaults[key], ...(typeof overrides[key] === "object" && !Array.isArray(overrides[key]) ? overrides[key] : {}) };
    } else if (Array.isArray(defaults[key])) {
      // Merge array items to preserve new fields (e.g. image_url) added to defaults
      if (Array.isArray(overrides[key])) {
        merged[key] = defaults[key].map((defItem, i) => {
          const ovItem = overrides[key][i];
          if (!ovItem) return defItem;
          return typeof defItem === "object" ? { ...defItem, ...ovItem } : ovItem;
        });
      } else {
        merged[key] = overrides[key];
      }
    } else if (typeof defaults[key] === "object") {
      merged[key] = { ...defaults[key], ...overrides[key] };
    } else {
      merged[key] = overrides[key];
    }
  }
  return merged;
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function SectionWrapper({ sectionKey, styles, className, id, children }) {
  const s = styles?.[sectionKey] ?? {};
  if (s.hidden) return null;

  const hasBg = Boolean(s.bg_image_url);
  const outerStyle = {
    position: "relative",
    ...(s.bg_color ? { backgroundColor: s.bg_color } : {}),
    ...(hasBg ? { backgroundImage: `url(${s.bg_image_url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
    ...(s.text_color     ? { "--lp-text1": s.text_color     } : {}),
    ...(s.text_secondary ? { "--lp-text2": s.text_secondary } : {}),
  };

  return (
    <section id={id} style={outerStyle} className={className}>
      {hasBg && s.bg_overlay > 0 && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, backgroundColor: s.bg_color || "#000", opacity: s.bg_overlay, pointerEvents: "none" }} />
      )}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </section>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ appName, logoUrl, navBg, navText, accent, onGetQuote }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#E8E8EC] backdrop-blur-md" style={{ backgroundColor: navBg + "CC" }}>
      <div className="mx-auto max-w-[1280px] px-6 h-14 flex items-center justify-between gap-4">

        {/* Logo / brand */}
        <div className="flex items-center gap-2 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-8 max-w-[140px] object-contain" />
          ) : (
            <>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent }}>
                <Printer size={14} className="text-white" />
              </div>
              <span className="font-bold tracking-tight text-base" style={{ color: navText }}>{appName}</span>
            </>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { label: "Services",     href: "#services"      },
            { label: "Why Us",       href: "#why-us"        },
            { label: "How It Works", href: "#how-it-works"  },
            { label: "Contact",      href: "#contact"       },
          ].map(({ label, href }) => (
            <a key={href} href={href} className="lp-nav-link px-3 py-1.5 rounded-lg text-sm font-medium transition-colors" style={{ color: navText + "99" }}>
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link to="/login"  className="px-4 py-2 rounded-[6px] border border-[#E8E8EC] text-sm font-medium hover:bg-black/5 transition-colors" style={{ color: navText }}>
            Sign In
          </Link>
          <button type="button" onClick={onGetQuote} className="lp-btn px-4 py-2 rounded-[6px] text-sm font-medium text-white transition-all">
            Instant Quoter
          </button>
        </div>

        <button type="button" onClick={() => setMenuOpen((v) => !v)} className="md:hidden p-2 rounded-lg hover:bg-black/5 transition-colors" style={{ color: navText }}>
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-[#E8E8EC] px-6 py-4 space-y-2" style={{ backgroundColor: navBg }}>
          {[
            { label: "Services",     href: "#services"      },
            { label: "Why Us",       href: "#why-us"        },
            { label: "How It Works", href: "#how-it-works"  },
            { label: "Contact",      href: "#contact"       },
          ].map(({ label, href }) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)} className="block py-2 text-sm font-medium" style={{ color: navText + "99" }}>
              {label}
            </a>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <Link to="/login"  className="block text-center px-4 py-2.5 rounded-[6px] border border-[#E8E8EC] text-sm font-medium" style={{ color: navText }}>Sign In</Link>
            <button type="button" onClick={() => { setMenuOpen(false); onGetQuote(); }} className="lp-btn block w-full text-center px-4 py-2.5 rounded-[6px] text-sm font-medium text-white">Instant Quoter</button>
          </div>
        </div>
      )}
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ hero, styles, onGetQuote }) {
  return (
    <SectionWrapper sectionKey="hero" styles={styles}>
      <div className="pt-20 pb-16 px-6">
        <div className="mx-auto max-w-[1280px] text-center">
          <Reveal delay={0}>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E8E8EC] bg-white/80 backdrop-blur-sm px-4 py-1.5 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shrink-0" />
              <span className="text-xs font-medium" style={{ color: "var(--lp-text2)" }}>Now accepting online quote requests</span>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="text-4xl sm:text-5xl lg:text-[60px] font-bold leading-[1.1] tracking-[-0.03em] max-w-4xl mx-auto mb-6" style={{ color: "var(--lp-text1)" }}>
              {hero.headline}
            </h1>
          </Reveal>
          <Reveal delay={220}>
            <p className="text-lg max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: "var(--lp-text2)" }}>
              {hero.subhead}
            </p>
          </Reveal>
          <Reveal delay={320}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button type="button" onClick={onGetQuote} className="lp-btn inline-flex items-center gap-2 px-6 py-3 rounded-[6px] text-sm font-semibold text-white transition-all">
                Get an Instant Quote
              </button>
              <a href="#how-it-works" className="inline-flex items-center gap-2 px-6 py-3 rounded-[6px] border border-[#E8E8EC] bg-white/70 text-sm font-semibold hover:bg-white transition-colors" style={{ color: "var(--lp-text1)" }}>
                See how it works
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </SectionWrapper>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ stats, styles }) {
  return (
    <SectionWrapper sectionKey="stats" styles={styles}>
      <div className="px-6 pb-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#E8E8EC] rounded-2xl overflow-hidden border border-[#E8E8EC]">
            {stats.map((stat, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="bg-white px-6 py-8 text-center">
                  <p className="text-3xl sm:text-4xl font-bold tracking-[-0.03em]" style={{ color: "var(--lp-text1)" }}>{stat.value}</p>
                  <p className="mt-1 text-sm" style={{ color: "var(--lp-text2)" }}>{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

// ── Services ──────────────────────────────────────────────────────────────────
function Services({ services, styles }) {
  return (
    <SectionWrapper sectionKey="services" styles={styles} id="services">
      <div className="px-6 py-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-12 text-center">
            <Reveal delay={0}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] mb-3" style={{ color: "#9C9C9C" }}>What We Offer</p>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em]" style={{ color: "var(--lp-text1)" }}>Print services for every need</h2>
            </Reveal>
            <Reveal delay={180}>
              <p className="mt-4 max-w-xl mx-auto" style={{ color: "var(--lp-text2)" }}>
                From single-page flyers to complex branded merchandise — we handle it all under one roof.
              </p>
            </Reveal>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {services.map((service, i) => {
              const Icon = SERVICE_ICONS[service.icon] ?? SERVICE_ICON_FALLBACK[i] ?? Printer;
              return (
                <Reveal key={i} delay={i * 90} direction="up">
                  <div className="group h-full bg-white rounded-xl border border-[#E8E8EC] overflow-hidden hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200">
                    {service.image_url && (
                      <div className="w-full h-36 overflow-hidden">
                        <img
                          src={service.image_url}
                          alt={service.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <div className="lp-icon-bg w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                        <Icon size={18} style={{ color: "var(--lp-accent)" }} />
                      </div>
                      <h3 className="font-semibold mb-2" style={{ color: "var(--lp-text1)" }}>{service.name}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--lp-text2)" }}>{service.description}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

// ── Why Us ────────────────────────────────────────────────────────────────────
function WhyUs({ features, styles }) {
  return (
    <SectionWrapper sectionKey="features" styles={styles} id="why-us">
      <div className="px-6 py-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-12 text-center">
            <Reveal delay={0}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] mb-3" style={{ color: "#9C9C9C" }}>Why Choose Us</p>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em]" style={{ color: "var(--lp-text1)" }}>Built around your business</h2>
            </Reveal>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map((feat, i) => {
              const Icon = WHY_ICONS[i % WHY_ICONS.length];
              return (
                <Reveal key={i} delay={i * 100} direction={i % 2 === 0 ? "right" : "left"}>
                  <div className="flex gap-4 rounded-xl border border-[#E8E8EC] bg-white p-6 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200">
                    <div className="lp-icon-bg w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                      <Icon size={18} style={{ color: "var(--lp-accent)" }} />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1" style={{ color: "var(--lp-text1)" }}>{feat.title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--lp-text2)" }}>{feat.description}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────
function HowItWorks({ steps, styles }) {
  return (
    <SectionWrapper sectionKey="steps" styles={styles} id="how-it-works">
      <div className="px-6 py-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-12 text-center">
            <Reveal delay={0}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] mb-3" style={{ color: "#9C9C9C" }}>The Process</p>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em]" style={{ color: "var(--lp-text1)" }}>From quote to print in 4 steps</h2>
            </Reveal>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, i) => (
              <Reveal key={i} delay={i * 110} direction="up">
                <div className="relative">
                  {i < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-6 left-[calc(100%+10px)] w-[calc(100%-20px)] h-px bg-[#E8E8EC] z-0" />
                  )}
                  <div className="bg-white rounded-xl border border-[#E8E8EC] p-6 relative z-10">
                    <p className="text-2xl font-bold tracking-[-0.03em] mb-3" style={{ color: "var(--lp-accent)" }}>{step.number}</p>
                    <h3 className="font-semibold mb-2" style={{ color: "var(--lp-text1)" }}>{step.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--lp-text2)" }}>{step.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

// ── Instant Quote modal (triggered by "Instant Quoter" nav button) ───────────
function QuoteModal({ open, onClose, accent, whatsappNumber }) {
  const [quoteSummary, setQuoteSummary] = useState(null);
  if (!open) return null;

  const waMsg  = quoteSummary ? buildInstantQuoteSummary(quoteSummary) : null;
  const waUrl  = waMsg && whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(waMsg)}`
    : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8EC]">
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--lp-text1)" }}>Get an Instant Price</h2>
            <p className="text-xs" style={{ color: "var(--lp-text2)" }}>
              Configure your job and see an estimated price right away.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 transition-colors">
            <X size={18} style={{ color: "var(--lp-text2)" }} />
          </button>
        </div>
        {/* Quoter */}
        <div className="overflow-y-auto max-h-[65vh]">
          <InstantQuoter accentHex={accent} onResult={setQuoteSummary} />
        </div>
        {/* CTA */}
        <div className="border-t border-[#E8E8EC] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm" style={{ color: "var(--lp-text2)" }}>
            {quoteSummary ? "Ready to place your order?" : "Get your price above, then order."}
          </p>
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              className="lp-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-[6px] text-sm font-semibold text-white transition-all"
            >
              Place Order Now
            </a>
          ) : (
            <Link
              to="/signup"
              onClick={onClose}
              className="lp-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-[6px] text-sm font-semibold text-white transition-all"
            >
              Place Order Now
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CTA banner ────────────────────────────────────────────────────────────────
function CTABanner({ cta, styles }) {
  return (
    <SectionWrapper sectionKey="cta" styles={styles}>
      <div className="px-6 py-16">
        <div className="mx-auto max-w-[1280px]">
          <Reveal direction="scale">
            <div className="rounded-2xl border px-8 py-14 text-center" style={{ borderColor: "var(--lp-accent)" + "33", backgroundColor: "var(--lp-accent)" + "0D" }}>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em] mb-4" style={{ color: "var(--lp-text1)" }}>{cta.headline}</h2>
              <p className="mb-8 max-w-lg mx-auto" style={{ color: "var(--lp-text2)" }}>{cta.subhead}</p>
              <Link to="/signup" className="lp-btn inline-flex items-center gap-2 px-7 py-3.5 rounded-[6px] text-sm font-semibold text-white transition-all">
                Create a Free Account
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </SectionWrapper>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer({ appName, logoUrl, contact, styles, accent }) {
  return (
    <SectionWrapper sectionKey="footer" styles={styles} id="contact">
      <div className="border-t border-[#E8E8EC] px-6 py-12">
        <div className="mx-auto max-w-[1280px] flex flex-col md:flex-row items-start justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              {logoUrl ? (
                <img src={logoUrl} alt={appName} className="h-7 max-w-[120px] object-contain" />
              ) : (
                <>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--lp-accent)" }}>
                    <Printer size={14} className="text-white" />
                  </div>
                  <span className="font-bold tracking-tight" style={{ color: "var(--lp-text1)" }}>{appName}</span>
                </>
              )}
            </div>
            <p className="text-sm max-w-xs leading-relaxed" style={{ color: "var(--lp-text2)" }}>
              Professional printing services you can trust — fast, affordable, and built for Ghanaian businesses.
            </p>
          </div>

          {/* Quick Links — middle */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#9C9C9C" }}>Quick Links</p>
            <a href="#services"     className="text-sm hover:underline" style={{ color: "var(--lp-text2)" }}>Services</a>
            <a href="#why-us"       className="text-sm hover:underline" style={{ color: "var(--lp-text2)" }}>Why Choose Us</a>
            <a href="#how-it-works" className="text-sm hover:underline" style={{ color: "var(--lp-text2)" }}>How It Works</a>
            <Link to="/login"       className="text-sm hover:underline" style={{ color: "var(--lp-text2)" }}>Sign In</Link>
            <Link to="/signup"      className="text-sm font-medium hover:underline" style={{ color: "var(--lp-accent)" }}>Get a Quote</Link>
          </div>

          {/* Contact — last */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#9C9C9C" }}>Contact</p>
            {contact.address && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--lp-text2)" }}>
                <MapPin size={13} className="shrink-0" style={{ color: "#9C9C9C" }} /> {contact.address}
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--lp-text2)" }}>
                <Phone size={13} className="shrink-0" style={{ color: "#9C9C9C" }} /> {contact.phone}
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--lp-text2)" }}>
                <Mail size={13} className="shrink-0" style={{ color: "#9C9C9C" }} /> {contact.email}
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] mt-10 pt-6 border-t border-[#E8E8EC]">
          <p className="text-xs" style={{ color: "#9C9C9C" }}>© {new Date().getFullYear()} {appName}. All rights reserved.</p>
        </div>
      </div>
    </SectionWrapper>
  );
}

// ── WhatsApp float ────────────────────────────────────────────────────────────
function WhatsAppFloat({ number }) {
  if (!number) return null;
  const clean = number.replace(/[^0-9]/g, "");
  if (!clean) return null;
  return (
    <a
      href={`https://wa.me/${clean}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-[0_4px_16px_rgba(37,211,102,0.45)] hover:scale-110 hover:shadow-[0_6px_20px_rgba(37,211,102,0.6)] active:scale-100 transition-all duration-200"
    >
      <MessageCircle size={26} className="text-white" fill="white" />
    </a>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function LandingPage() {
  const [content, setContent] = useState(DEFAULT);
  const [appName, setAppName]             = useState("Jage Press");
  const [logoUrl, setLogoUrl]             = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);

  const g          = content.global_styles ?? {};
  const accent     = g.accent_color   || "#6366F1";
  const text1      = g.text_color     || "#0A0A0A";
  const text2      = g.text_secondary || "#6B6B6B";
  const navBg      = g.nav_bg         || "#FFFFFF";
  const navText    = g.nav_text       || "#0A0A0A";
  const btnColor   = g.button_color   || accent;
  const btnHover   = darkenHex(btnColor, 0.15);

  useEffect(() => {
    getSettings().then((data) => {
      if (!data) return;
      if (data.company_name)     setAppName(data.company_name);
      if (data.company_logo_url) setLogoUrl(data.company_logo_url);
      if (data.whatsapp_number)  setWhatsappNumber(data.whatsapp_number);
      if (data.landing_page)     setContent(merge(DEFAULT, data.landing_page));
    }).catch(() => {});
  }, []);

  // Inject dynamic hover + utility styles
  useEffect(() => {
    const id = "lp-dynamic-styles";
    let tag = document.getElementById(id);
    if (!tag) {
      tag = document.createElement("style");
      tag.id = id;
      document.head.appendChild(tag);
    }
    tag.textContent = `
      .lp-btn { background-color: ${btnColor}; }
      .lp-btn:hover { background-color: ${btnHover}; transform: translateY(-1px); box-shadow: 0 4px 12px ${btnColor}59; }
      .lp-btn:active { transform: translateY(0); }
      .lp-nav-link:hover { color: ${navText} !important; background-color: rgba(0,0,0,0.05); }
      .lp-icon-bg { background-color: ${accent}1A; }
    `;
    return () => { try { document.head.removeChild(tag); } catch {} };
  }, [accent, btnColor, btnHover, navText]);

  const rootStyle = {
    "--lp-accent": accent,
    "--lp-text1":  text1,
    "--lp-text2":  text2,
    fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]" style={rootStyle}>
      <Nav appName={appName} logoUrl={logoUrl} navBg={navBg} navText={navText} accent={accent} onGetQuote={() => setQuoteModalOpen(true)} />
      <Hero       hero={content.hero}         styles={content.section_styles} onGetQuote={() => setQuoteModalOpen(true)} />
      <StatsBar   stats={content.stats}       styles={content.section_styles} />
      <Services   services={content.services} styles={content.section_styles} />
      <WhyUs      features={content.features} styles={content.section_styles} />
      <HowItWorks steps={content.steps}       styles={content.section_styles} />
      <CTABanner  cta={content.cta}           styles={content.section_styles} />
      <QuoteModal open={quoteModalOpen} onClose={() => setQuoteModalOpen(false)} accent={accent} whatsappNumber={whatsappNumber} />
      <Footer     appName={appName} logoUrl={logoUrl} contact={content.contact} styles={content.section_styles} accent={accent} />
      <WhatsAppFloat number={whatsappNumber} />
    </div>
  );
}
