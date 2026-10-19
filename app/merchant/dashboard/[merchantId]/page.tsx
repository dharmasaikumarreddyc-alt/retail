import type { Metadata } from 'next';
import MerchantDashboardClient from './MerchantDashboardClient';
import ReviewInsightFormatter from './ReviewInsightFormatter';

export const metadata: Metadata = {
  title: 'Store Analytics | Merchant Dashboard',
  description: 'Real-time analytics for your store — weekly statistics, order insights, cancellation analysis, stock availability, and revenue breakdown.',
};

export default async function MerchantDashboardPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  return (
    <>
      <MerchantDashboardClient merchantId={merchantId} />
      <ReviewInsightFormatter />
    </>
  );
}
