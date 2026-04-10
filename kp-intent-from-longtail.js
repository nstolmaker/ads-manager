import 'dotenv/config';
import fs from 'node:fs';
import { getKeywordMetrics } from './src/google-ads/keyword-planner.js';
const raw = fs.readFileSync('./autocomplete-longtail-utf8.json', 'utf8');
const json = JSON.parse(raw);
const intentPatterns = ['for business', 'small business', 'enterprise', 'consulting', 'consultant', 'services', 'service', 'accounting', 'bookkeeping', 'attorneys', 'lawyers', 'doctors', 'healthcare', 'construction', 'finance', 'financial advisors', 'hr', 'developers', 'app development', 'workflow', 'automation'];
const ignorePatterns = ['free', 'course', 'courses', 'certification', 'specialization', 'dummies', 'pdf', 'book', 'coursera', 'by andrew ng', 'download', 'chrome', 'extension', 'android', 'iphone', 'mac', 'windows', 'apple watch', 'desktop', 'students', 'teachers', 'educators', 'college', 'homework', 'jobs', 'salary', 'reddit', 'youtube'];
function score(s) { const t = s.toLowerCase(); for (const p of ignorePatterns) {
    if (t.includes(p))
        return 'ignore';
} for (const p of intentPatterns) {
    if (t.includes(p))
        return 'intent';
} if (/for (everyone|beginners|all|humans|good)/.test(t))
    return 'ignore'; return 'maybe'; }
const intents = new Set();
for (const seed of ['ai', 'llm', 'chatgpt', 'claude'])
    for (const q of json[seed] || [])
        if (score(q) === 'intent')
            intents.add(q.toLowerCase());
const kws = [...intents];
const metrics = await getKeywordMetrics(kws);
metrics.sort((a, b) => (b.avgMonthlySearches - a.avgMonthlySearches) || (a.competitionIndex - b.competitionIndex));
const rows = metrics.map(m => ({ keyword: m.keyword, monthlySearches: m.avgMonthlySearches, competition: m.competition, competitionIndex: m.competitionIndex, lowTopOfPage: m.lowTopOfPageBidUsd, highTopOfPage: m.highTopOfPageBidUsd }));
fs.writeFileSync('./kp-intent-results.json', JSON.stringify(rows, null, 2));
for (const r of rows.filter(r => r.monthlySearches > 0).slice(0, 30))
    console.log(`${String(r.monthlySearches).padStart(5)}/mo | ${String(r.competition).padEnd(6)} | idx ${String(r.competitionIndex).padStart(3)} | $${r.lowTopOfPage}-$${r.highTopOfPage} | ${r.keyword}`);
console.log(`\nTotal intent kws checked: ${rows.length}; nonzero volume: ${rows.filter(r => r.monthlySearches > 0).length}`);
//# sourceMappingURL=kp-intent-from-longtail.js.map