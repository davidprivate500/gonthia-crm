import type { IndustryTemplate, IndustryType } from '../types';
import { tradingTemplate } from './trading';
import { igamingTemplate } from './igaming';
import { saasTemplate } from './saas';
import { ecommerceTemplate } from './ecommerce';

// Template registry
const templates: Record<IndustryType, IndustryTemplate> = {
  trading: tradingTemplate,
  igaming: igamingTemplate,
  saas: saasTemplate,
  ecommerce: ecommerceTemplate,
  realestate: {
    id: 'realestate',
    name: 'Real Estate',
    pipeline: {
      name: 'Real Estate Pipeline',
      stages: [
        { name: 'Inquiry', type: 'open', probability: 10, avgDaysInStage: 1, color: '#6366f1' },
        { name: 'Viewing Scheduled', type: 'open', probability: 25, avgDaysInStage: 5, color: '#8b5cf6' },
        { name: 'Viewing Done', type: 'open', probability: 40, avgDaysInStage: 7, color: '#a855f7' },
        { name: 'Offer Made', type: 'open', probability: 60, avgDaysInStage: 14, color: '#d946ef' },
        { name: 'Negotiation', type: 'open', probability: 75, avgDaysInStage: 21, color: '#ec4899' },
        { name: 'Contract Signed', type: 'open', probability: 90, avgDaysInStage: 30, color: '#f43f5e' },
        { name: 'Closed', type: 'won', probability: 100, avgDaysInStage: 0, color: '#22c55e' },
        { name: 'Lost', type: 'lost', probability: 0, avgDaysInStage: 0, color: '#ef4444' },
      ],
    },
    deals: {
      minValue: 50000,
      maxValue: 2000000,
      avgValue: 350000,
      cycleDaysMin: 60,
      cycleDaysMax: 180,
      winRate: 0.15,
    },
    leads: {
      conversionRate: 0.25,
      qualificationRate: 0.40,
    },
    activities: {
      avgPerContact: 6,
      avgPerDeal: 15,
      callToEmailRatio: 0.7,
    },
    companyPatterns: [
      '{Word} Realty',
      '{Word} Properties',
      '{Name} Real Estate',
      '{Word} Homes',
      '{Word} Land {Suffix}',
    ],
  },
  finserv: {
    id: 'finserv',
    name: 'Financial Services',
    pipeline: {
      name: 'Financial Services Pipeline',
      stages: [
        { name: 'Lead', type: 'open', probability: 10, avgDaysInStage: 2, color: '#6366f1' },
        { name: 'Consultation', type: 'open', probability: 25, avgDaysInStage: 7, color: '#8b5cf6' },
        { name: 'Application', type: 'open', probability: 50, avgDaysInStage: 14, color: '#a855f7' },
        { name: 'Underwriting', type: 'open', probability: 70, avgDaysInStage: 21, color: '#d946ef' },
        { name: 'Approval', type: 'open', probability: 85, avgDaysInStage: 7, color: '#ec4899' },
        { name: 'Funded', type: 'won', probability: 100, avgDaysInStage: 0, color: '#22c55e' },
        { name: 'Declined', type: 'lost', probability: 0, avgDaysInStage: 0, color: '#ef4444' },
        { name: 'Withdrawn', type: 'lost', probability: 0, avgDaysInStage: 0, color: '#f97316' },
      ],
    },
    deals: {
      minValue: 5000,
      maxValue: 500000,
      avgValue: 50000,
      cycleDaysMin: 30,
      cycleDaysMax: 90,
      winRate: 0.35,
    },
    leads: {
      conversionRate: 0.35,
      qualificationRate: 0.45,
    },
    activities: {
      avgPerContact: 8,
      avgPerDeal: 12,
      callToEmailRatio: 0.6,
    },
    companyPatterns: [
      '{Word} Financial',
      '{Word} Capital',
      '{Name} Advisors',
      '{Word} Wealth',
      '{Word} Investment {Suffix}',
    ],
  },
};

/**
 * Get industry template by ID
 */
export function getTemplate(industry: IndustryType): IndustryTemplate {
  const template = templates[industry];
  if (!template) {
    throw new Error(`Unknown industry template: ${industry}`);
  }
  return template;
}

/**
 * Get all available templates
 */
export function getAllTemplates(): IndustryTemplate[] {
  return Object.values(templates);
}

/**
 * Get template IDs
 */
export function getTemplateIds(): IndustryType[] {
  return Object.keys(templates) as IndustryType[];
}

// Export individual templates
export { tradingTemplate } from './trading';
export { igamingTemplate } from './igaming';
export { saasTemplate } from './saas';
export { ecommerceTemplate } from './ecommerce';
