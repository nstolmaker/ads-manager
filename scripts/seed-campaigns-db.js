import 'dotenv/config';
import { query, queryOne, pool } from '../src/db/pool.js';
// Campaigns already created in test account
const campaigns = [
    { slug: 'ai-department', googleId: '23688917485', name: 'Noah Consulting — AI Department' },
    { slug: 'pressure-release', googleId: '23684245841', name: 'Noah Consulting — Pressure Release' },
    { slug: 'turbocharger', googleId: '23684245874', name: 'Noah Consulting — Turbocharger' },
];
for (const c of campaigns) {
    const persona = await queryOne('SELECT id FROM personas WHERE slug = $1', [c.slug]);
    if (!persona) {
        console.error('Persona not found:', c.slug);
        continue;
    }
    await query(`INSERT INTO campaigns (persona_id, google_campaign_id, name, status)
     VALUES ($1, $2, $3, 'paused')
     ON CONFLICT (google_campaign_id) DO NOTHING`, [persona.id, c.googleId, c.name]);
    console.log('✅', c.name, '→', c.googleId);
}
await pool.end();
//# sourceMappingURL=seed-campaigns-db.js.map