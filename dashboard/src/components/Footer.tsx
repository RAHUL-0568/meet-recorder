// ============================================================
// Footer Component — Site-wide footer with social links
// ============================================================

import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        {/* Top row — Brand + Nav columns */}
        <div className="footer-top">
          {/* Brand */}
          <div className="footer-brand">
            <div className="footer-logo">
              <div className="footer-logo-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" opacity="0.5" />
                </svg>
              </div>
              <span>Meet Recorder</span>
            </div>
            <p className="footer-tagline">
              A lightweight Chrome extension that captures your Google Meet sessions.
              Record, review, and never miss a detail.
            </p>
          </div>

          {/* Product */}
          <div className="footer-col">
            <h4>Product</h4>
            <ul>
              <li><Link href="/#hero">Home</Link></li>
              <li><Link href="/#install">Install</Link></li>
              <li><Link href="/#features">Features</Link></li>
              <li><Link href="/recordings">Dashboard</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="footer-col">
            <h4>Resources</h4>
            <ul>
              <li><a href="https://github.com/RAHUL-0568" target="_blank" rel="noopener noreferrer">GitHub</a></li>
              <li><a href="mailto:rahulx.568@gmail.com">Support</a></li>
              <li><Link href="/#install">Installation Guide</Link></li>
            </ul>
          </div>

          {/* Connect */}
          <div className="footer-col">
            <h4>Connect</h4>
            <ul>
              <li><a href="mailto:rahulx.568@gmail.com">rahulx.568@gmail.com</a></li>
              <li>
                <a href="https://www.instagram.com/rahulx.568?igsh=MTkxN2twYTFrZGRnNA==" target="_blank" rel="noopener noreferrer">Instagram</a>
              </li>
              <li>
                <a href="https://t.me/Rahulx568" target="_blank" rel="noopener noreferrer">Telegram</a>
              </li>
              <li>
                <a href="https://www.linkedin.com/in/rahulx0568" target="_blank" rel="noopener noreferrer">LinkedIn</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="footer-divider" />

        {/* Bottom row — Made with | Copyright | Social icons */}
        <div className="footer-bottom">
          <p className="footer-made">Made with <span className="footer-heart">❤️</span> by Rahul</p>
          <p className="footer-copy">&copy; {currentYear} Meet Recorder. All rights reserved.</p>
          <div className="footer-socials">
            {/* Instagram */}
            <a
              href="https://www.instagram.com/rahulx.568?igsh=MTkxN2twYTFrZGRnNA=="
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-icon"
              aria-label="Instagram"
              title="Instagram"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>

            {/* GitHub */}
            <a
              href="https://github.com/RAHUL-0568"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-icon"
              aria-label="GitHub"
              title="GitHub"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </a>

            {/* Telegram */}
            <a
              href="https://t.me/Rahulx568"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-icon"
              aria-label="Telegram"
              title="Telegram"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </a>

            {/* LinkedIn */}
            <a
              href="https://www.linkedin.com/in/rahulx0568"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-icon"
              aria-label="LinkedIn"
              title="LinkedIn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>

            {/* Email */}
            <a
              href="mailto:rahulx.568@gmail.com"
              className="footer-social-icon"
              aria-label="Email"
              title="Email"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
