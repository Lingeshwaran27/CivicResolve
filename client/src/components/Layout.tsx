import { MapPinCheck, Menu, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/report', label: 'Report' },
  { to: '/track', label: 'Track' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/admin', label: 'Admin' },
];

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · CivicResolve`;
  }, [title]);
}

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <MapPinCheck size={Math.round(size * 0.55)} strokeWidth={2.2} color="var(--primary)" />
    </span>
  );
}

export function Layout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPath, setLastPath] = useState(location.pathname);

  // Close the mobile menu whenever the route changes (derived during render, no effect needed).
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  // Move focus to the main region on navigation so screen-reader users hear the new page.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="container">
          <Link to="/" className="brand" aria-label="CivicResolve home">
            <BrandMark />
            <span>
              Civic<b>Resolve</b>
            </span>
          </Link>
          <nav aria-label="Main" className={`site-nav${menuOpen ? ' open' : ''}`} id="site-nav">
            <ul className="nav">
              {LINKS.map((l) => (
                <li key={l.to}>
                  <NavLink to={l.to} end={l.end}>
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="header-actions">
            <Link to="/report" className="btn btn-primary btn-sm header-cta">
              <Plus size={16} aria-hidden="true" />
              New report
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon menu-btn"
              aria-expanded={menuOpen}
              aria-controls="site-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="row">
            <BrandMark size={26} />
            <span>
              <strong style={{ color: '#ffffff' }}>CivicResolve</strong>
              <span style={{ color: 'rgb(255 255 255 / 55%)', marginLeft: '0.4rem' }}>
                · Coimbatore City Municipal Corporation · AI-assisted Grievance Portal
              </span>
            </span>
          </div>
          <nav aria-label="Footer">
            <ul>
              <li>
                <Link to="/report">File a Complaint</Link>
              </li>
              <li>
                <Link to="/track">Track Status</Link>
              </li>
              <li>
                <Link to="/dashboard">City Dashboard</Link>
              </li>
            </ul>
          </nav>
          <span className="xs" style={{ color: 'rgb(255 255 255 / 40%)' }}>Powered by Google Gemini · Map © OpenStreetMap / CARTO</span>
        </div>
      </footer>
    </>
  );
}
