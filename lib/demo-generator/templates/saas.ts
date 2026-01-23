import type { IndustryTemplate } from '../types';

export const saasTemplate: IndustryTemplate = {
  id: 'saas',
  name: 'SaaS / Software',

  pipeline: {
    name: 'SaaS Sales Pipeline',
    stages: [
      { name: 'Lead', type: 'open', probability: 10, avgDaysInStage: 3, color: '#6366f1' },
      { name: 'Discovery', type: 'open', probability: 20, avgDaysInStage: 7, color: '#8b5cf6' },
      { name: 'Demo', type: 'open', probability: 35, avgDaysInStage: 7, color: '#a855f7' },
      { name: 'Trial', type: 'open', probability: 50, avgDaysInStage: 14, color: '#d946ef' },
      { name: 'Proposal', type: 'open', probability: 65, avgDaysInStage: 10, color: '#ec4899' },
      { name: 'Negotiation', type: 'open', probability: 80, avgDaysInStage: 14, color: '#f43f5e' },
      { name: 'Closed Won', type: 'won', probability: 100, avgDaysInStage: 0, color: '#22c55e' },
      { name: 'Closed Lost', type: 'lost', probability: 0, avgDaysInStage: 0, color: '#ef4444' },
      { name: 'No Decision', type: 'lost', probability: 0, avgDaysInStage: 0, color: '#9ca3af' },
    ],
  },

  deals: {
    minValue: 500,
    maxValue: 100000,
    avgValue: 12000,
    cycleDaysMin: 30,
    cycleDaysMax: 120,
    winRate: 0.22,
  },

  leads: {
    conversionRate: 0.30,
    qualificationRate: 0.35,
  },

  activities: {
    avgPerContact: 10,
    avgPerDeal: 15,
    callToEmailRatio: 0.5,
  },

  companyPatterns: [
    '{Word} Software',
    '{Word} Tech',
    '{Word} Systems',
    '{Word} Solutions',
    '{Word} Cloud',
    '{Word} Labs',
    '{Word} IO',
    '{Word} HQ',
    '{Word} App',
  ],
};
