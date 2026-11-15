import { B2BFeaturesSection } from './components/B2BFeaturesSection';
import { B2CCatalogSection } from './components/B2CCatalogSection';
import { FeeCalculatorSection } from './components/FeeCalculatorSection';
import { FooterSection } from './components/FooterSection';
import { HeroSection } from './components/HeroSection';
import { Navbar } from './components/Navbar';
import { PartnerAndFaqSection } from './components/PartnerAndFaqSection';

const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:5174';
const ADMIN_URL = import.meta.env.VITE_ADMIN_URL ?? 'http://localhost:5175';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <Navbar appUrl={APP_URL} />

      <main id="top" className="flex-1">
        <HeroSection appUrl={APP_URL} />
        <B2CCatalogSection appUrl={APP_URL} />
        <B2BFeaturesSection />
        <FeeCalculatorSection />
        <PartnerAndFaqSection />
      </main>

      <FooterSection appUrl={APP_URL} adminUrl={ADMIN_URL} />
    </div>
  );
}
