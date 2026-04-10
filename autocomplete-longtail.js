import 'dotenv/config';
const seeds = ['ai', 'llm', 'chatgpt', 'claude'];
const ALPHA_NUM = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
async function fetchSuggestions(q) {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}&hl=en`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok)
        return [];
    const j = await r.json();
    return (j?.[1] ?? []);
}
async function getLongtail(seed, target = 100) {
    const wantPrefix = `${seed} for `;
    const out = new Set();
    // round 1: base + single char expansions
    const q1 = [`${seed} for`, ...ALPHA_NUM.map(c => `${seed} for ${c}`)];
    for (const q of q1) {
        const s = await fetchSuggestions(q);
        for (const x of s) {
            const n = x.toLowerCase().trim();
            if (n.startsWith(wantPrefix))
                out.add(n);
        }
        if (out.size >= target)
            break;
    }
    // round 2: two-char expansions if needed
    if (out.size < target) {
        outer: for (const a of ALPHA_NUM) {
            for (const b of ALPHA_NUM) {
                const q = `${seed} for ${a}${b}`;
                const s = await fetchSuggestions(q);
                for (const x of s) {
                    const n = x.toLowerCase().trim();
                    if (n.startsWith(wantPrefix))
                        out.add(n);
                }
                if (out.size >= target)
                    break outer;
            }
        }
    }
    return [...out].slice(0, target);
}
const result = {};
for (const seed of seeds) {
    result[seed] = await getLongtail(seed, 100);
}
console.log(JSON.stringify(result, null, 2));
//# sourceMappingURL=autocomplete-longtail.js.map