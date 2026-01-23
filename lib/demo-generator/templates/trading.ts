import type { IndustryTemplate } from '../types';

export const tradingTemplate: IndustryTemplate = {
  id: 'trading',
  name: 'Trading / Forex / CFD',

  pipeline: {
    name: 'Trading Pipeline',
    stages: [
      { name: 'New Lead', type: 'open', probability: 10, avgDaysInStage: 2, color: '#6366f1' },
      { name: 'Contacted', type: 'open', probability: 20, avgDaysInStage: 3, color: '#8b5cf6' },
      { name: 'Qualified', type: 'open', probability: 35, avgDaysInStage: 5, color: '#a855f7' },
      { name: 'Demo Scheduled', type: 'open', probability: 50, avgDaysInStage: 4, color: '#d946ef' },
      { name: 'Demo Completed', type: 'open', probability: 65, avgDaysInStage: 7, color: '#ec4899' },
      { name: 'Funded', type: 'open', probability: 80, avgDaysInStage: 14, color: '#f43f5e' },
      { name: 'Active Trader', type: 'won', probability: 100, avgDaysInStage: 0, color: '#22c55e' },
      { name: 'VIP', type: 'won', probability: 100, avgDaysInStage: 0, color: '#fbbf24' },
      { name: 'Churned', type: 'lost', probability: 0, avgDaysInStage: 0, color: '#ef4444' },
      { name: 'Disqualified', type: 'lost', probability: 0, avgDaysInStage: 0, color: '#9ca3af' },
    ],
  },

  deals: {
    minValue: 500,
    maxValue: 100000,
    avgValue: 5000,
    cycleDaysMin: 7,
    cycleDaysMax: 45,
    winRate: 0.25,
  },

  leads: {
    conversionRate: 0.40, // 40% of leads become contacts
    qualificationRate: 0.30, // 30% of contacts become opportunities
  },

  activities: {
    avgPerContact: 8,
    avgPerDeal: 12,
    callToEmailRatio: 0.6, // 60% calls, 40% emails
  },

  companyPatterns: [
    '{Word} Trading',
    '{Word} Capital',
    '{Name} Investments',
    '{Word} Markets',
    '{Word} Financial',
    '{Name} Trading Group',
    '{Word} FX',
    '{Word} Global Markets',
  ],
};
