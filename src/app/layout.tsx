import type { Metadata, Viewport } from 'next';
import { Inter, Lora } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-lora',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'WordNest 2.0 – Học Tiếng Anh & Nghe Chép YouTube',
  description:
    'Luyện nghe chép chính tả từ YouTube chuẩn DOL, học từ vựng Flashcard SRS, Quiz, Chính tả — tối ưu hoàn hảo cho điện thoại và máy tính.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WordNest',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F2EA' },
    { media: '(prefers-color-scheme: dark)', color: '#161310' },
  ],
};

// Runs synchronously before first paint to prevent light/dark flash (FOUC)
const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem('wordnest-v2-storage');if(raw){var p=JSON.parse(raw);var t=p&&p.state&&p.state.theme;if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);return;}}if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} ${lora.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased selection:bg-[#8B6F47]/20">{children}</body>
    </html>
  );
}
