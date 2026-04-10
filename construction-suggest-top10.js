import 'dotenv/config';
import { getKeywordMetrics } from './src/google-ads/keyword-planner.js';
const ALPHA_NUM = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
async function fetchSuggestions(q) {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}&hl=en`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok)
        return [];
    const j = await r.json();
    return (j?.[1] ?? []);
}
const seed = 'ai for construction';
const set = new Set();
for (const q of [seed, ...ALPHA_NUM.map(c => `${seed} ${c}`)]) {
    const s = await fetchSuggestions(q);
    for (const x of s) {
        const n = x.toLowerCase().trim();
        if (n.startsWith(seed))
            set.add(n);
    }
}
const all = [...set];
const metrics = await getKeywordMetrics(all);
metrics.sort((a, b) => b.avgMonthlySearches - a.avgMonthlySearches);
const top = metrics.slice(0, 10).map(m => ({
    keyword: m.keyword,
    monthlySearches: m.avgMonthlySearches,
    competition: m.competition,
    cpc: `$${m.lowTopOfPageBidUsd}-$${m.highTopOfPageBidUsd}`,
}));
console.log(JSON.stringify({ totalSuggestions: all.length, top10: top }, null, 2));
//# sourceMappingURL=construction-suggest-top10.js.map