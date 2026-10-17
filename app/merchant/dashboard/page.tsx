import type { Metadata } from 'next';
import MerchantSelectorClient from './MerchantSelectorClient';

export const metadata: Metadata = {
  title: 'Select Your Store | Merchant Dashboard',
  description: 'Choose your restaurant or store to view real-time analytics, weekly statistics, order insights, and revenue data.',
};

export default function MerchantDashboardSelectorPage() {
  return <MerchantSelectorClient />;
}
