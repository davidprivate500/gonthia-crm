import type { IndustryTemplate } from '../types';

export const igamingTemplate: IndustryTemplate = {
  id: 'igaming',
  name: 'iGaming / Online Casino',

  pipeline: {
    name: 'Player Pipeline',
    stages: [
      { name: 'Registration', type: 'open', probability: 15, avgDaysInStage: 1, color: '#6366f1' },
      { name: 'KYC Pending', type: 'open', probability: 30, avgDaysInStage: 2, color: '#8b5cf6' },
      { name: 'KYC Verified', type: 'open', probability: 50, avgDaysInStage: 3, color: '#a855f7' },
      { name: 'First Deposit', type: 'open', probability: 70, avgDaysInStage: 5, color: '#d946ef' },
      { name: 'Active Player', type: 'won', probability: 100, avgDaysInStage: 0, color: '#22c55e' },
      { name: 'VIP', type: 'won', probability: 100, avgDaysInStage: 0, color: '#fbbf24' },
      { name: 'High Roller', type: 'won', probability: 100, avgDaysInStage: 0, color: '#f59e0b' },
      { name: 'Dormant', type: 'lost', probability: 0, avgDaysInStage: 0, color: '#9ca3af' },
      { name: 'Self-Excluded', type: 'lost', probability: 0, avgDaysInStage: 0, color: '#ef4444' },
    ],
  },

  deals: {
    minValue: 50,
    maxValue: 50000,
    avgValue: 500,
    cycleDaysMin: 1,
    cycleDaysMax: 30,
    winRate: 0.35,
  },

  leads: {
    conversionRate: 0.60, // Higher conversion from registration
    qualificationRate: 0.25,
  },

  activities: {
    avgPerContact: 5,
    avgPerDeal: 8,
    callToEmailRatio: 0.3, // More email/chat in iGaming
  },

  companyPatterns: [
    '{Word} Casino',
    '{Word} Gaming',
    '{Word} Bet',
    '{Word} Play',
    '{Word} Slots',
    '{Word} Poker',
    '{Word} Sports',
    '{Word} Games',
  ],
};
