// ============================================================
// Root Layout — wraps all pages with providers + navbar
// ============================================================

import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Meet Recorder — Record & Review Google Meet Sessions',
  description:
    'Record your Google Meet sessions with one click. Capture tab audio and microphone, playback with waveform visualization, and get AI-powered summaries.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}

