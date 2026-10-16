import type { Metadata } from 'next';
import MerchantLoginClient from './MerchantLoginClient';

export const metadata: Metadata = {
  title: 'Merchant sign in | Aisle',
  description: 'Sign in to your private merchant business dashboard.',
};

export default function MerchantLoginPage() {
  return <MerchantLoginClient />;
}
