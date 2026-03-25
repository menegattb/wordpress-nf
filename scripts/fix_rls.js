require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

async function main() {
  const connString = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (!connString) {
    console.error('No POSTGRES_URL found in .env');
    process.exit(1);
  }

  const finalConnString = connString.includes('sslmode=require') && !connString.includes('uselibpqcompat')
    ? connString + '&uselibpqcompat=true'
    : connString;

  const pool = new Pool({
    connectionString: finalConnString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const tables = [
      'pedidos', 'nfse', 'nfe', 'logs', 'configuracoes',
      'tenants', 'tenant_config', 'subscriptions', 'usage_monthly'
    ];

    console.log('Enabling Row Level Security for tables...');
    for (const table of tables) {
      try {
        await pool.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
        console.log(`✓ Enabled RLS on public.${table}`);
      } catch (err) {
        if (err.message.includes('does not exist')) {
          console.log(`ℹ Table public.${table} does not exist, skipping.`);
        } else {
          console.error(`⚠ Error setting RLS on public.${table}: ${err.message}`);
        }
      }
    }

    console.log('\\nVerifying RLS status for all tables in public schema:');
    const res = await pool.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
      WHERE nspname = 'public' AND relkind = 'r'
      ORDER BY relname;
    `);
    console.table(res.rows);

  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await pool.end();
  }
}

main();
