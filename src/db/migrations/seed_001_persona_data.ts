/**
 * Seed 001: Populate persona data blobs for the 3 existing personas.
 * Uses context from live landing pages + Noah's seed ideas.
 */
import 'dotenv/config';
import { query } from '../pool.js';

const personas = [
  {
    slug: 'ai-department',
    lp_url: 'https://noah.consulting/lp/ai-department/',
    data: {
      seed_idea: 'AI Department — give your business the capabilities of a full AI department without hiring one',
      headline: 'You move faster. Your competitors wonder how.',
      target_audience: 'Business owners and executives at SMBs and mid-market companies who want to move faster than competitors using AI, but lack the in-house AI expertise to do so.',
      pain_points: [
        'Competitors feel like they are moving faster but you cannot identify why',
        'No dedicated AI staff or budget to hire one',
        'Unsure where AI fits in the business or how to start',
        'Watching AI hype but not capturing any of the value',
      ],
      target_job_titles: ['CEO', 'COO', 'VP Operations', 'Business Owner', 'Managing Director'],
      company_size: '10-200 employees',
      industries: ['Professional services', 'Logistics', 'Insurance', 'Manufacturing', 'Consulting'],
      geography: 'United States',
      value_proposition: 'Noah Consulting acts as your outsourced AI department — strategy, implementation, and ongoing support — so you get the competitive edge of AI without the overhead.',
      offer: 'Free AI audit and competitive analysis',
    },
  },
  {
    slug: 'turbocharger',
    lp_url: 'https://noah.consulting/lp/turbocharger/',
    data: {
      seed_idea: 'Turbocharger — make your best employee twice as fast by enhancing the software they already use with AI',
      headline: 'Your best employee just got twice as fast.',
      target_audience: 'Operations managers and team leads at companies with key employees who are bottlenecks — people doing high-value work that cannot be easily delegated or replaced.',
      pain_points: [
        'Top performers are overloaded and cannot scale',
        'Important work is stuck in one person\'s head',
        'Software tooling is already in place but underutilized',
        'Cannot afford to replace systems — just need to make them work better',
      ],
      target_job_titles: ['Operations Manager', 'VP of Operations', 'Team Lead', 'Director of Engineering', 'CTO'],
      company_size: '15-500 employees',
      industries: ['Technology', 'Professional services', 'Healthcare operations', 'Finance'],
      geography: 'United States',
      value_proposition: 'We enhance the software your team already uses with AI — no rip-and-replace, no retraining. Your best people move faster without changing their workflow.',
      offer: 'Free productivity audit — identify the biggest bottleneck in your team',
    },
  },
  {
    slug: 'pressure-release',
    lp_url: 'https://noah.consulting/lp/pressure-release/',
    data: {
      seed_idea: 'Pressure Release — your most important people are underwater; AI can take the pressure off',
      headline: 'Your most important people are underwater.',
      target_audience: 'Executives and business owners at growing companies where key team members are stretched thin and burning out, creating risk for the business.',
      pain_points: [
        'Key people are doing work that should be automated or delegated',
        'Burnout risk in high-performers',
        'Growth is being throttled by team capacity, not demand',
        'Too much of the business depends on a small number of people',
        'Hiring is too slow or too expensive to solve the capacity problem',
      ],
      target_job_titles: ['CEO', 'COO', 'HR Director', 'VP People', 'Operations Director'],
      company_size: '20-300 employees',
      industries: ['Professional services', 'Healthcare', 'Legal', 'Accounting', 'Real estate'],
      geography: 'United States',
      value_proposition: 'We identify the high-value repetitive work crushing your best people and build AI systems that take it off their plate — so they can do the work only they can do.',
      offer: 'Free capacity audit — find where your team is losing hours to work AI can handle',
    },
  },
];

for (const p of personas) {
  await query(
    `UPDATE personas SET data = $1, lp_url = $2, updated_at = NOW() WHERE slug = $3`,
    [JSON.stringify(p.data), p.lp_url, p.slug]
  );
  console.log(`  seeded: ${p.slug}`);
}

console.log('Done.');
process.exit(0);
