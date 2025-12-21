import './globals.css';
import { Outfit, Playfair_Display } from 'next/font/google';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-body',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-heading',
});

export const metadata = {
  title: 'Sangeet Sarathi | Premium Musical Instruments',
  description: 'Discover the finest musical instruments at Sangeet Sarathi, Palakkad.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${playfair.variable}`}>
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
