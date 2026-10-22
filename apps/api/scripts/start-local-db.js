const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config();

let EmbeddedPostgres;
try {
  const mod = require('embedded-postgres');
  EmbeddedPostgres = mod.default || mod;
} catch (e) {
  console.error('Failed to load embedded-postgres:', e.message);
  process.exit(1);
}

const port = parseInt(process.env.LOCAL_DB_PORT || '5433', 10);
const dataDir = path.resolve(__dirname, '..', '.pgdata');
const user = 'postgres';
const password = 'postgres';
const dbName = 'miniledger';

async function run() {
  console.log('====================================================');
  console.log(' Starting Embedded PostgreSQL Database for MiniLedger');
  console.log('====================================================');
  console.log(`Port:     ${port}`);
  console.log(`Data Dir: ${dataDir}`);
  console.log(`Database: ${dbName}`);

  const isInitialRun = !fs.existsSync(dataDir);
  if (isInitialRun) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const pg = new EmbeddedPostgres({
    port,
    databaseDir: dataDir,
    user,
    password,
    persistent: true,
  });

  if (isInitialRun) {
    console.log('Initializing new PostgreSQL cluster...');
    await pg.initialise();
  }

  console.log('Starting PostgreSQL server...');
  await pg.start();
  console.log(`PostgreSQL is running on localhost:${port}`);

  // Ensure default database exists
  try {
    const adminClient = new Client({
      host: 'localhost',
      port,
      user,
      password,
      database: 'postgres',
    });
    await adminClient.connect();
    const res = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );
    if (res.rowCount === 0) {
      console.log(`Creating database "${dbName}"...`);
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created successfully.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
    await adminClient.end();
  } catch (err) {
    console.warn(`Database check/creation notice: ${err ? err.message : err}`);
  }

  console.log('====================================================');
  console.log(`DATABASE_URL="postgresql://${user}:${password}@localhost:${port}/${dbName}?schema=public"`);
  console.log('Database is ready to accept connections.');
  console.log('Press Ctrl+C to stop PostgreSQL.');
  console.log('====================================================');

  const shutdown = async () => {
    console.log('\nStopping PostgreSQL...');
    try {
      await pg.stop();
      console.log('PostgreSQL stopped cleanly.');
    } catch (e) {
      console.error('Error during shutdown:', e);
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep process alive
  setInterval(() => {}, 10000);
}

run().catch((err) => {
  console.error('Failed to start embedded PostgreSQL:', err);
  process.exit(1);
});
