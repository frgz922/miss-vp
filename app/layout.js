import './globals.css';
import { EVENT } from '@/lib/config';

export const metadata = {
  title: `${EVENT.line1} ${EVENT.line2}`.trim(),
  description: `${EVENT.tagline} — registro de participantes, evaluación y votación del público.`,
};

export const viewport = { themeColor: '#0d0619', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Great+Vibes&family=Montserrat:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
