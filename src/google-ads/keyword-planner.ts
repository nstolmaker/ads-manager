/**
 * google-ads/keyword-planner.ts
 * Fetches historical search volume, competition, and CPC data
 * for a list of keywords via the Google Ads KeywordPlanIdea service.
 */
import 'dotenv/config';
import { GoogleAdsApi, enums } from 'google-ads-api';

export interface KeywordMetrics {
  keyword: string;
  avgMonthlySearches: number;
  competition: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNSPECIFIED';
  competitionIndex: number;
  lowTopOfPageBidUsd: number;
  highTopOfPageBidUsd: number;
}

export async function getKeywordMetrics(
  keywords: string[],
  languageId = '1000',   // English
  geoTargetId = '2840',  // United States
): Promise<KeywordMetrics[]> {
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });
  const customerId = process.env.GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!;
  const customer = client.Customer({
    customer_id: customerId,
    login_customer_id: process.env.GOOGLE_ADS_MCC_CUSTOMER_ID!,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  });

  const response = await customer.keywordPlanIdeas.generateKeywordHistoricalMetrics({
    customer_id: customerId,
    keywords,
    language: `languageConstants/${languageId}`,
    geo_target_constants: [`geoTargetConstants/${geoTargetId}`],
    keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH_AND_PARTNERS,
  });

  return (response.results ?? []).map((result: any) => {
    const m = result.keyword_metrics ?? {};
    const low = Number(m.low_top_of_page_bid_micros ?? 0);
    const high = Number(m.high_top_of_page_bid_micros ?? 0);
    const compMap: Record<string, KeywordMetrics['competition']> = {
      LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH',
    };
    return {
      keyword: result.text ?? '',
      avgMonthlySearches: Number(m.avg_monthly_searches ?? 0),
      competition: compMap[m.competition] ?? 'UNSPECIFIED',
      competitionIndex: Number(m.competition_index ?? 0),
      lowTopOfPageBidUsd: parseFloat((low / 1_000_000).toFixed(2)),
      highTopOfPageBidUsd: parseFloat((high / 1_000_000).toFixed(2)),
    };
  });
}
