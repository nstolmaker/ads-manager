import 'dotenv/config';
import { getKeywordMetrics } from './src/google-ads/keyword-planner.js';
const kws = [
    'ai for construction estimating',
    'ai for construction project management',
    'ai for construction management',
    'ai for construction business',
];
const m = await getKeywordMetrics(kws);
for (const r of m) {
    console.log(`${r.keyword}|${r.avgMonthlySearches}|${r.competition}|${r.competitionIndex}|$${r.lowTopOfPageBidUsd}-$${r.highTopOfPageBidUsd}`);
}
//# sourceMappingURL=kp-four-construction.js.map