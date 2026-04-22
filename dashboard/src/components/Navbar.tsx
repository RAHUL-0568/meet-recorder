// ============================================================
// Navbar Component — Top navigation bar
// ============================================================

'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link href="/" className="navbar-logo">
          <div className="navbar-logo-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.5" />
            </svg>
          </div>
          <span className="navbar-logo-text">Meet Recorder</span>
        </Link>

        {/* Navigation Links */}
        <div className="navbar-links">
          <Link
            href="/"
            className={`navbar-link ${pathname === '/' ? 'active' : ''}`}
          >
            Home
          </Link>
          {session && (
            <Link
              href="/recordings"
              className={`navbar-link ${pathname.startsWith('/recordings') ? 'active' : ''}`}
            >
              Recordings
            </Link>
          )}
        </div>

        {/* Auth */}
        <div className="navbar-auth">
          {status === 'loading' ? (
            <div className="navbar-skeleton" />
          ) : session?.user ? (
            <div className="navbar-user">
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="navbar-avatar"
                />
              )}
              <span className="navbar-username">{session.user.name?.split(' ')[0]}</span>
              <button onClick={() => signOut()} className="navbar-signout">
                Sign Out
              </button>
            </div>
          ) : (
            <button onClick={() => signIn('google')} className="navbar-signin">
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
