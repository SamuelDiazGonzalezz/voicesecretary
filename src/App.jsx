import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  DatabaseZap,
  FileText,
  Headphones,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Minus,
  PhoneCall,
  Play,
  Plus,
  Route,
  Send,
  ShieldCheck,
  Stethoscope,
  UserRoundCheck,
  Webhook,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { dashboardCalls, sectors } from './data.js';

const VoiceMachine = lazy(() => import('./components/VoiceMachine.jsx'));
const VoiceDemo = lazy(() => import('./components/VoiceDemo.jsx'));

const navItems = [
  ['Producto', '#producto'],
  ['Demo', '#demo'],
  ['Cómo funciona', '#como-funciona'],
  ['Sectores', '#sectores'],
  ['Seguridad', '#seguridad'],
];

const processSteps = [
  {
    number: '01',
    icon: PhoneCall,
    title: 'Atiende',
    text: 'Responde con el saludo, el tono y el horario que defines para cada línea.',
  },
  {
    number: '02',
    icon: MessageSquareText,
    title: 'Comprende',
    text: 'Identifica intención y contexto antes de decidir el siguiente paso.',
  },
  {
    number: '03',
    icon: Workflow,
    title: 'Ejecuta',
    text: 'Consulta disponibilidad, registra datos y activa tus herramientas.',
  },
  {
    number: '04',
    icon: UserRoundCheck,
    title: 'Informa',
    text: 'Entrega un resumen útil o deriva la conversación a una persona.',
  },
];

const integrations = [
  { icon: CalendarDays, name: 'Calendario', type: 'Disponibilidad y citas' },
  { icon: DatabaseZap, name: 'CRM', type: 'Contactos y oportunidades' },
  { icon: PhoneCall, name: 'Telefonía', type: 'Números y transferencias' },
  { icon: Webhook, name: 'Automatizaciones', type: 'Webhooks y flujos' },
];

const dashboardDetails = [
  ['Cita de primera consulta', 'Jueves · 10:30', 'Confirmación por SMS'],
  ['Visita al ático AT-204', 'Financiación aprobada', 'Asignado a Laura M.'],
  ['Fuga de agua en local', 'Prioridad urgente', 'Técnico de guardia avisado'],
  ['Mesa para ocho personas', 'Sábado · 21:15', 'Una opción sin gluten'],
];

function Reveal({ children, className = '', delay = 0 }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 24 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Header({ onDemoRequest }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen);
    return () => document.body.classList.remove('menu-open');
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="site-header__inner container">
        <a className="brand" href="#producto" aria-label="NORA, inicio" onClick={closeMenu}>
          <span className="brand__mark"><i /><i /><i /></span>
          <span>NORA</span>
        </a>

        <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Navegación principal">
          {navItems.map(([label, href]) => (
            <a href={href} key={href} onClick={closeMenu}>{label}</a>
          ))}
          <button className="button button--primary main-nav__cta" type="button" onClick={() => {
            closeMenu();
            onDemoRequest(false);
          }}>
            Solicitar demo <ArrowUpRight size={17} />
          </button>
        </nav>

        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </div>
    </header>
  );
}

function Hero({ activity, onDemoRequest }) {
  return (
    <section className="hero" id="producto">
      <Suspense
        fallback={(
          <div className="voice-machine voice-machine--loading" aria-hidden="true">
            <div className="machine-fallback">
              <span className="machine-fallback__ring machine-fallback__ring--one" />
              <span className="machine-fallback__ring machine-fallback__ring--two" />
              <span className="machine-fallback__core" />
              <span className="machine-fallback__signal" />
            </div>
          </div>
        )}
      >
        <VoiceMachine activity={activity} />
      </Suspense>
      <div className="hero__grid container">
        <div className="hero__content">
          <div className="hero__technology">
            <span className="hero__tech-dot" />
            Tecnología de voz ElevenLabs
          </div>
          <h1>Secretaria de voz con IA para empresas</h1>
          <p className="hero__lead">
            Atiende, cualifica, agenda y deriva llamadas con una voz natural adaptada a tu forma de trabajar.
          </p>
          <div className="hero__actions">
            <button className="button button--primary button--large" type="button" onClick={() => onDemoRequest(true)}>
              <Play size={18} fill="currentColor" /> Escuchar una llamada
            </button>
            <button className="button button--ghost button--large" type="button" onClick={() => onDemoRequest(false)}>
              Solicitar demo <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="hero__assurances" aria-label="Capacidades principales">
            <span><Check size={15} /> Horario configurable</span>
            <span><Check size={15} /> Derivación humana</span>
            <span><Check size={15} /> Resumen de llamada</span>
          </div>
        </div>

        <div className="hero__live-status" aria-label="Ejemplo de llamada en curso">
          <div className="hero__status-top">
            <span><i /> Llamada en curso</span>
            <b>01:42</b>
          </div>
          <strong>Reserva confirmada</strong>
          <p>Agenda consultada · SMS enviado</p>
        </div>

        <a className="hero__scroll" href="#demo" aria-label="Ir a la demostración">
          <span>Descubrir</span>
          <ArrowDown size={18} />
        </a>
      </div>
    </section>
  );
}

function CapabilityBand() {
  const items = ['Atiende llamadas', 'Responde consultas', 'Agenda citas', 'Transfiere al equipo', 'Genera resúmenes'];
  return (
    <div className="capability-band" aria-label="Capacidades">
      <div className="container capability-band__inner">
        {items.map((item) => (
          <span key={item}><i aria-hidden="true" /> {item}</span>
        ))}
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, text, align = 'left' }) {
  return (
    <div className={`section-heading section-heading--${align}`}>
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

function ProcessSection() {
  return (
    <section className="section section--process" id="como-funciona">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Cómo funciona"
            title="Una conversación. Todo resuelto."
            text="Configura el conocimiento y las reglas. NORA sigue el proceso y pasa la llamada a una persona cuando corresponde."
          />
        </Reveal>
        <div className="process-grid">
          {processSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal className="process-step" delay={index * 0.07} key={step.number}>
                <div className="process-step__top">
                  <span>{step.number}</span>
                  <Icon size={22} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {index < processSteps.length - 1 && <ChevronRight className="process-step__arrow" size={19} />}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DashboardSection() {
  const [selectedCall, setSelectedCall] = useState(0);
  const detail = dashboardDetails[selectedCall];

  return (
    <section className="section section--dashboard" id="control">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Centro de control"
            title="Cada llamada queda bajo control."
            text="Revisa el contexto, el resultado y la siguiente acción desde un único espacio operativo."
          />
        </Reveal>

        <Reveal className="dashboard-preview" delay={0.08}>
          <div className="dashboard-topbar">
            <div className="dashboard-brand"><span className="brand__mark brand__mark--small"><i /><i /><i /></span>NORA / CONTROL</div>
            <span className="dashboard-label">Panel de demostración</span>
            <div className="dashboard-user">AM</div>
          </div>

          <div className="dashboard-layout">
            <div className="dashboard-main">
              <div className="dashboard-title-row">
                <div>
                  <span>Hoy · 16 julio</span>
                  <h3>Llamadas</h3>
                </div>
                <button className="icon-button" type="button" aria-label="Exportar llamadas" title="Exportar">
                  <ArrowUpRight size={18} />
                </button>
              </div>

              <div className="dashboard-metrics">
                <div><span>Recibidas</span><strong>42</strong><small>Volumen del día</small></div>
                <div><span>Completadas</span><strong>36</strong><small>Flujo finalizado</small></div>
                <div><span>Derivadas</span><strong>6</strong><small>Atención humana</small></div>
              </div>

              <div className="calls-table" role="table" aria-label="Llamadas de demostración">
                <div className="calls-table__head" role="row">
                  <span>Hora</span><span>Contacto</span><span>Motivo</span><span>Resultado</span><span>Duración</span>
                </div>
                {dashboardCalls.map((call, index) => (
                  <button
                    className={selectedCall === index ? 'calls-table__row is-selected' : 'calls-table__row'}
                    type="button"
                    role="row"
                    key={`${call[0]}-${call[1]}`}
                    onClick={() => setSelectedCall(index)}
                    aria-label={`Abrir llamada de ${call[1]}`}
                  >
                    {call.map((value, cellIndex) => (
                      <span role="cell" key={value} data-label={['Hora', 'Contacto', 'Motivo', 'Resultado', 'Duración'][cellIndex]}>
                        {cellIndex === 3 && <i className={`result-dot result-dot--${value.toLowerCase()}`} />}{value}
                      </span>
                    ))}
                  </button>
                ))}
              </div>
            </div>

            <aside className="call-detail">
              <div className="call-detail__status"><i /> Completada</div>
              <span className="call-detail__time">Hoy · {dashboardCalls[selectedCall][0]}</span>
              <h4>{dashboardCalls[selectedCall][1]}</h4>
              <p>{dashboardCalls[selectedCall][2]}</p>

              <div className="call-detail__audio">
                <button type="button" aria-label="Reproducir grabación" title="Reproducir">
                  <Play size={16} fill="currentColor" />
                </button>
                <div aria-hidden="true">{Array.from({ length: 20 }, (_, index) => <i key={index} style={{ height: `${5 + ((index * 11) % 14)}px` }} />)}</div>
                <span>{dashboardCalls[selectedCall][4]}</span>
              </div>

              <div className="call-detail__summary">
                <span>Resumen</span>
                {detail.map((item) => <p key={item}><Check size={14} /> {item}</p>)}
              </div>

              <button className="text-button" type="button">Ver transcripción <ArrowRight size={16} /></button>
            </aside>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function SectorsSection() {
  const [activeSector, setActiveSector] = useState(0);
  const sectorIcons = [Stethoscope, Building2, Headphones, CalendarDays];

  return (
    <section className="section section--sectors" id="sectores">
      <div className="container sectors-layout">
        <Reveal className="sectors-intro">
          <SectionHeading
            eyebrow="Casos de uso"
            title="Configurada para tu forma de trabajar."
            text="No parte de un guion genérico. Aprende tus servicios, procesos, horarios y criterios de derivación."
          />
          <a className="text-link" href="#contacto">Explorar mi caso <ArrowUpRight size={17} /></a>
        </Reveal>

        <div className="sector-list">
          {sectors.map((sector, index) => {
            const Icon = sectorIcons[index];
            const isActive = activeSector === index;
            return (
              <Reveal className="sector-row-wrap" delay={index * 0.05} key={sector.number}>
                <button
                  className={isActive ? 'sector-row is-active' : 'sector-row'}
                  type="button"
                  onClick={() => setActiveSector(index)}
                  aria-expanded={isActive}
                >
                  <span className="sector-row__number">{sector.number}</span>
                  <span className="sector-row__icon"><Icon size={21} /></span>
                  <span className="sector-row__content">
                    <strong>{sector.title}</strong>
                    <span className="sector-row__description">{sector.text}</span>
                    <span className="sector-row__tags">
                      {sector.tags.map((tag) => <i key={tag}>{tag}</i>)}
                    </span>
                  </span>
                  <span className="sector-row__control">{isActive ? <Minus size={20} /> : <Plus size={20} />}</span>
                </button>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ImpactCalculator() {
  const [calls, setCalls] = useState(80);
  const monthlyMinutes = calls * 3.2 * 22;
  const monthlyHours = Math.round(monthlyMinutes / 60);
  const workdays = Math.round(monthlyHours / 8);

  const setSafeCalls = (value) => setCalls(Math.max(20, Math.min(300, value)));

  return (
    <section className="section section--impact" id="impacto">
      <div className="container impact-layout">
        <Reveal>
          <SectionHeading
            eyebrow="Capacidad"
            title="Calcula el tiempo que consume tu teléfono."
            text="Una estimación sencilla para dimensionar la oportunidad antes de diseñar el flujo."
          />
          <p className="impact-note"><CircleCheck size={16} /> Supuesto: 3,2 min por llamada · 22 días laborables.</p>
        </Reveal>

        <Reveal className="impact-tool" delay={0.08}>
          <div className="impact-tool__input">
            <div>
              <label htmlFor="calls-range">Llamadas al día</label>
              <span>Media aproximada de tu empresa</span>
            </div>
            <div className="stepper">
              <button type="button" aria-label="Reducir llamadas" title="Reducir" onClick={() => setSafeCalls(calls - 10)}><Minus size={17} /></button>
              <output htmlFor="calls-range">{calls}</output>
              <button type="button" aria-label="Aumentar llamadas" title="Aumentar" onClick={() => setSafeCalls(calls + 10)}><Plus size={17} /></button>
            </div>
          </div>
          <input
            id="calls-range"
            className="range-input"
            type="range"
            min="20"
            max="300"
            step="10"
            value={calls}
            onChange={(event) => setCalls(Number(event.target.value))}
            style={{ '--range-progress': `${((calls - 20) / 280) * 100}%` }}
          />
          <div className="impact-result">
            <span>Tiempo mensual de conversación</span>
            <strong>{monthlyHours}<small> h</small></strong>
            <p>Equivale aproximadamente a <b>{workdays} jornadas</b> de 8 horas.</p>
          </div>
          <p className="impact-disclaimer">Estimación orientativa. El impacto real depende del flujo, duración y porcentaje de llamadas automatizables.</p>
        </Reveal>
      </div>
    </section>
  );
}

function PlatformSection() {
  return (
    <section className="section section--platform" id="integraciones">
      <div className="container platform-grid">
        <Reveal>
          <SectionHeading
            eyebrow="Integraciones"
            title="Conecta la conversación con tu operación."
            text="Una arquitectura preparada para leer contexto y ejecutar acciones sobre las herramientas que ya utilizas."
          />
          <div className="voice-engine">
            <div className="voice-engine__mark"><Bot size={24} /></div>
            <div><span>Motor de voz</span><strong>ElevenLabs</strong></div>
            <span className="voice-engine__status"><i /> Conectable</span>
          </div>
        </Reveal>

        <div className="integration-list">
          {integrations.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal className="integration-row" delay={index * 0.06} key={item.name}>
                <span className="integration-row__icon"><Icon size={20} /></span>
                <div><strong>{item.name}</strong><span>{item.type}</span></div>
                <ArrowUpRight size={18} />
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const controls = [
    {
      icon: LockKeyhole,
      title: 'Acceso por función',
      text: 'Define quién puede consultar llamadas, transcripciones y configuración.',
    },
    {
      icon: Route,
      title: 'Derivación con criterio',
      text: 'Escala excepciones, urgencias o solicitudes sensibles según tus reglas.',
    },
    {
      icon: FileText,
      title: 'Trazabilidad operativa',
      text: 'Conserva el resultado y las acciones de cada conversación para su revisión.',
    },
  ];

  return (
    <section className="section section--security" id="seguridad">
      <div className="container">
        <Reveal className="security-heading">
          <div className="security-heading__icon"><ShieldCheck size={30} /></div>
          <SectionHeading
            eyebrow="Seguridad y control"
            title="Tus reglas, tus datos, tu operación."
            text="Diseña la política de acceso, retención y atención humana que requiere cada proceso."
          />
        </Reveal>
        <div className="security-grid">
          {controls.map((control, index) => {
            const Icon = control.icon;
            return (
              <Reveal className="security-item" delay={index * 0.07} key={control.title}>
                <Icon size={22} />
                <h3>{control.title}</h3>
                <p>{control.text}</p>
              </Reveal>
            );
          })}
        </div>
        <Reveal className="security-policy">
          <span><Zap size={17} /> Identificación del asistente configurable</span>
          <span><Clock3 size={17} /> Retención según tu política</span>
          <span><UserRoundCheck size={17} /> Intervención humana disponible</span>
        </Reveal>
      </div>
    </section>
  );
}

function ContactSection() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const endpoint = import.meta.env.VITE_DEMO_ENDPOINT?.trim();

  const submitLead = async (event) => {
    event.preventDefault();
    setSending(true);
    setSubmitError('');
    const form = new FormData(event.currentTarget);
    const lead = Object.fromEntries(form.entries());

    try {
      if (endpoint) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead),
        });
        if (!response.ok) throw new Error('No se pudo enviar la solicitud.');
      } else {
        window.localStorage.setItem('nora-demo-request', JSON.stringify({ ...lead, createdAt: new Date().toISOString() }));
      }
      setSent(true);
    } catch {
      setSubmitError('No hemos podido preparar la solicitud. Revisa la conexión e inténtalo de nuevo.');
      setSending(false);
      return;
    }
    setSending(false);
  };

  return (
    <section className="contact-section" id="contacto">
      <div className="container contact-layout">
        <Reveal className="contact-copy">
          <span className="eyebrow eyebrow--dark">Próximo paso</span>
          <h2>Diseña una secretaria que conozca tu negocio.</h2>
          <p>Cuéntanos tu volumen y el proceso más importante. Prepararemos una demo sobre un caso real de tu empresa.</p>
          <div className="contact-points">
            <span><Check size={17} /> Voz y tono de marca</span>
            <span><Check size={17} /> Flujos e integraciones</span>
            <span><Check size={17} /> Prueba con tus escenarios</span>
          </div>
        </Reveal>

        <Reveal className="contact-form-wrap" delay={0.08}>
          {sent ? (
            <div className="form-success" role="status">
              <CircleCheck size={34} />
              <span>{endpoint ? 'Solicitud enviada' : 'Solicitud preparada'}</span>
              <h3>{endpoint ? 'Ya tenemos el contexto inicial.' : 'Tu briefing está listo.'}</h3>
              <p>
                {endpoint
                  ? 'El siguiente paso es revisar el flujo y preparar la conversación de demostración.'
                  : 'Este entorno no tiene un canal de envío conectado. Los datos se han guardado únicamente en este dispositivo.'}
              </p>
              <button className="text-button text-button--light" type="button" onClick={() => setSent(false)}>Editar datos <ArrowRight size={16} /></button>
            </div>
          ) : (
            <form className="contact-form" onSubmit={submitLead}>
              <div className="form-heading">
                <span>Solicitar demo</span>
                <b>01 / 01</b>
              </div>
              <label>
                Nombre
                <input type="text" name="name" placeholder="Tu nombre" autoComplete="name" required />
              </label>
              <label>
                Email de empresa
                <input type="email" name="email" placeholder="nombre@empresa.com" autoComplete="email" required />
              </label>
              <div className="form-row">
                <label>
                  Empresa
                  <input type="text" name="company" placeholder="Nombre de empresa" autoComplete="organization" required />
                </label>
                <label>
                  Llamadas al mes
                  <select name="callVolume" defaultValue="500-2000">
                    <option value="menos-500">Menos de 500</option>
                    <option value="500-2000">500 – 2.000</option>
                    <option value="2000-10000">2.000 – 10.000</option>
                    <option value="mas-10000">Más de 10.000</option>
                  </select>
                </label>
              </div>
              <label>
                ¿Qué debería resolver NORA?
                <textarea name="useCase" placeholder="Por ejemplo: agendar citas y derivar urgencias…" rows="3" required />
              </label>
              <label className="form-consent">
                <input type="checkbox" name="consent" value="accepted" required />
                <span>Acepto que se utilicen estos datos para responder a mi solicitud.</span>
              </label>
              {submitError && <p className="form-error" role="alert">{submitError}</p>}
              <button className="button button--primary button--form" type="submit" disabled={sending}>
                {sending ? 'Enviando…' : 'Preparar mi demo'} <Send size={17} />
              </button>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__top">
        <a className="brand" href="#producto" aria-label="NORA, inicio">
          <span className="brand__mark"><i /><i /><i /></span><span>NORA</span>
        </a>
        <p>Secretaria de voz con IA para empresas.</p>
        <a className="footer-top-link" href="#producto">Volver arriba <ArrowUpRight size={16} /></a>
      </div>
      <div className="container site-footer__bottom">
        <span>© {new Date().getFullYear()} NORA</span>
        <span>Voz conectable con ElevenLabs</span>
        <nav aria-label="Enlaces legales"><a href="#seguridad">Privacidad</a><a href="#seguridad">Términos</a></nav>
      </div>
    </footer>
  );
}

export default function App({ hasLiveAgent = false }) {
  const [voiceActivity, setVoiceActivity] = useState(false);
  const [playRequest, setPlayRequest] = useState(0);

  const requestDemo = (play) => {
    const target = document.getElementById(play ? 'demo' : 'contacto');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (play) setPlayRequest((current) => current + 1);
  };

  const demoHeading = useMemo(
    () => ({
      eyebrow: 'Demo interactiva',
      title: 'No leas lo que hace. Escúchalo.',
      text: 'Elige un sector y sigue, segundo a segundo, cómo una llamada se convierte en una acción resuelta.',
    }),
    [],
  );

  return (
    <>
      <a className="skip-link" href="#main">Saltar al contenido</a>
      <Header onDemoRequest={requestDemo} />
      <main id="main">
        <Hero activity={voiceActivity} onDemoRequest={requestDemo} />
        <CapabilityBand />

        <section className="section section--demo" id="demo">
          <div className="container">
            <Reveal>
              <SectionHeading {...demoHeading} />
            </Reveal>
            <Reveal delay={0.08}>
              <Suspense fallback={<div className="demo-loading">Preparando demostración…</div>}>
                <VoiceDemo
                  hasLiveAgent={hasLiveAgent}
                  onActivityChange={setVoiceActivity}
                  playRequest={playRequest}
                />
              </Suspense>
            </Reveal>
          </div>
        </section>

        <ProcessSection />
        <DashboardSection />
        <SectorsSection />
        <ImpactCalculator />
        <PlatformSection />
        <SecuritySection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
