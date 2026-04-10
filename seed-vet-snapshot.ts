import 'dotenv/config';
import { getKeywordMetrics } from './src/google-ads/keyword-planner.js';
import { getDomainPaidKeywords } from './src/google-ads/spyfu.js';

const seeds=['ai for business','ai for healthcare','ai for construction'];
const m=await getKeywordMetrics(seeds);
console.log('KEYWORD PLANNER');
for(const r of m){
  console.log(`${r.keyword} | ${r.avgMonthlySearches}/mo | ${r.competition} | $${r.lowTopOfPageBidUsd}-$${r.highTopOfPageBidUsd}`)
}

const domains = [
  'openai.com','ibm.com','workspace.google.com',
  'openevidence.com','hippocraticai.com','cloud.google.com',
  'construction.autodesk.com','trunktools.com','oracle.com'
];

console.log('\nSPYFU SNAPSHOT');
for(const d of domains){
  try {
    const rows=await getDomainPaidKeywords(d,5);
    const top=rows?.slice(0,3).map((x:any)=>x.keyword).join(', ');
    console.log(`${d} | ${rows?.length ?? 0} kws | ${top || 'no data'}`);
  } catch(e:any){
    console.log(`${d} | error/no data`)
  }
}
