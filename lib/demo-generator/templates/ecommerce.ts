import type { IndustryTemplate } from '../types';

export const ecommerceTemplate: IndustryTemplate = {
  id: 'ecommerce',
  name: 'E-commerce / Retail',

  pipeline: {
    name: 'E-commerce Pipeline',
    stages: [
      { name: 'Visitor', type: 'open', probability: 5, avgDaysInStage: 1, color: '#6366f1' },
      { name: 'Cart Added', type: 'open', probability: 20, avgDaysInStage: 1, color: '#8b5cf6' },
      { name: 'Checkout Started', type: 'open', probability: 40, avgDaysInStage: 1, color: '#a855f7' },
      { name: 'Payment Pending', type: 'open', probability: 70, avgDaysInStage: 1, color: '#d946ef' },
      { name: 'Purchased', type: 'won', probability: 100, avgDaysInStage: 0, color: '#22c55e' },
      { name: 'Repeat Customer', type: 'won', probability: 100, avgDaysInStage: 0, color: '#fbbf24' },
      { name: 'VIP Customer', type: 'won', probability: 100, avgDaysInStage: 0, color: '#f59e0b' },
      { name: 'Abandoned', type: 'lost', probability: 0, avgDaysInStage: 0, color: '#ef4444' },
      { name: 'Refunded', type: 'lost', probability: 0, avgDaysInStage: 0, color: '#f97316' },
    ],
  },

  deals: {
    minValue: 20,
    maxValue: 2000,
    avgValue: 150,
    cycleDaysMin: 1,
    cycleDaysMax: 7,
    winRate: 0.45,
  },

  leads: {
    conversionRate: 0.70, // High initial conversion
    qualificationRate: 0.20,
  },

  activities: {
    avgPerContact: 3,
    avgPerDeal: 4,
    callToEmailRatio: 0.2, // Mostly automated emails
  },

  companyPatterns: [
    '{Word} Store',
    '{Word} Shop',
    '{Word} Market',
    '{Word} Goods',
    '{Word} Direct',
    '{Word} Outlet',
    '{Word} Express',
    '{Word} Mart',
  ],
};
