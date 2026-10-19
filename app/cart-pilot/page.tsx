import type { Metadata } from 'next';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CartPilotClient from './CartPilotClient';
import CartPilotAuthGate from './CartPilotAuthGate';

export const metadata: Metadata = {
  title: 'Cart Pilot | Agentic AI Checkout',
  description: 'Experience AI-powered shopping with our intelligent agents. Find, compare, and purchase from local merchants automatically.',
};

export default function CartPilotPage() {
  return (
    <div className="page-wraper">
      <Header />

      <div className="page-content bg-light" style={{ paddingTop: '0', minHeight: '100vh' }}>
        <CartPilotAuthGate>
          <CartPilotClient />
        </CartPilotAuthGate>
      </div>

      <Footer />
    </div>
  );
}
