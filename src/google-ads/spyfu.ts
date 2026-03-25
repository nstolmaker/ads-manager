/**
 * spyfu.ts
 * SpyFu API wrappers for competitor PPC intelligence.
 */
import "dotenv/config";

const API_KEY = () => process.env.SPYFU_API_KEY!;
const BASE = "https://api.spyfu.com/apis";

export interface SpyFuPaidKeyword {
  keyword: string;
  searchVolume: number;
  cpc: number | null;
  monthlyClicks: number | null;
  monthlyCost: number | null;
  paidCompetitors: number;
}

export interface SpyFuDomainCompetitor {
  domain: string;
  commonKeywords: number;
  overlapScore: number;
}

/** Top paid PPC keywords for a competitor domain, sorted by search volume. */
export async function getDomainPaidKeywords(
  domain: string,
  limit = 20
): Promise<{ domain: string; totalKeywords: number; keywords: SpyFuPaidKeyword[] }> {
  const url = `${BASE}/keyword_api/v2/ppc/getMostSuccessful?api_key=${API_KEY()}&query=${encodeURIComponent(domain)}&pageSize=${limit}&pageIndex=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`SpyFu error ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return {
    domain,
    totalKeywords: j.totalMatchingResults ?? 0,
    keywords: (j.results ?? []).map((kw: any) => ({
      keyword: kw.keyword,
      searchVolume: kw.searchVolume ?? 0,
      cpc: kw.phraseCostPerClick ?? null,
      monthlyClicks: kw.phraseMonthlyClicks ?? null,
      monthlyCost: kw.phraseMonthlyCost ?? null,
      paidCompetitors: kw.paidCompetitors ?? 0,
    })),
  };
}

/**
 * PPC competitors for a domain — domains with the most overlapping paid keywords.
 * Use this to discover who competes with a given domain in paid search.
 */
export async function getDomainPpcCompetitors(
  domain: string,
  limit = 20
): Promise<{ domain: string; totalCompetitors: number; competitors: SpyFuDomainCompetitor[] }> {
  const url = `${BASE}/competitors_api/v2/ppc/getTopCompetitors?api_key=${API_KEY()}&domain=${encodeURIComponent(domain)}&pageSize=${limit}&pageIndex=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`SpyFu error ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return {
    domain,
    totalCompetitors: j.totalMatchingResults ?? 0,
    competitors: (j.results ?? []).map((d: any) => ({
      domain: d.domain ?? "",
      commonKeywords: d.commonTerms ?? 0,
      overlapScore: d.rank ?? 0,
    })),
  };
}
