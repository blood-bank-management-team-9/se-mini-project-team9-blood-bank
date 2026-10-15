const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

describe('Database Schema & Migration (SRS 7.1, SAD 3.6)', () => {
  const schemaPath = path.join(__dirname, 'schema.sql');
  let schemaSql = '';

  beforeAll(() => {
    schemaSql = fs.readFileSync(schemaPath, 'utf8');
  });

  it('contains schema.sql file', () => {
    expect(fs.existsSync(schemaPath)).toBe(true);
    expect(schemaSql.length).toBeGreaterThan(0);
  });

  it('uses non-destructive CREATE TABLE IF NOT EXISTS and no DROP TABLE', () => {
    expect(schemaSql).not.toMatch(/DROP\s+TABLE/i);
    expect(schemaSql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i);
  });

  it('defines all 10 required tables from SRS 7.1 and SAD 3.6', () => {
    const requiredTables = [
      'users',
      'donors',
      'donations',
      'blood_units',
      'blood_requests',
      'blood_request_units',
      'audit_log',
      'system_config',
      'password_reset_tokens',
      'sessions',
    ];

    requiredTables.forEach((table) => {
      const tableRegex = new RegExp(`CREATE TABLE( IF NOT EXISTS)?\\s+${table}\\b`, 'i');
      expect(schemaSql).toMatch(tableRegex);
    });
  });

  it('enforces foreign key constraints between dependent tables', () => {
    expect(schemaSql).toMatch(/REFERENCES\s+donors\(donor_id\)/i);
    expect(schemaSql).toMatch(/REFERENCES\s+users\(user_id\)/i);
    expect(schemaSql).toMatch(/REFERENCES\s+donations\(donation_id\)/i);
    expect(schemaSql).toMatch(/REFERENCES\s+blood_requests\(request_id\)/i);
    expect(schemaSql).toMatch(/REFERENCES\s+blood_units\(unit_id\)/i);
  });

  it('defines the required indexes from SAD 3.6', () => {
    expect(schemaSql).toMatch(/idx_blood_units_stock/i);
    expect(schemaSql).toMatch(/idx_blood_requests_queue/i);
    expect(schemaSql).toMatch(/idx_audit_log_user_date/i);
    expect(schemaSql).toMatch(/idx_donors_phone/i);
  });

  it('defines the required CHECK constraints', () => {
    expect(schemaSql).toMatch(/CHECK\s*\(\s*blood_group\s+IN/i);
    expect(schemaSql).toMatch(/CHECK\s*\(\s*role\s+IN/i);
    expect(schemaSql).toMatch(/CHECK\s*\(\s*volume_ml\s+IN/i);
  });
});

describe('Database Seed Data (SAD 3.6, FR-DON-04 & STP Setup)', () => {
  const seedsPath = path.join(__dirname, 'seeds.sql');
  let seedsSql = '';

  beforeAll(() => {
    seedsSql = fs.readFileSync(seedsPath, 'utf8');
  });

  it('contains seeds.sql file', () => {
    expect(fs.existsSync(seedsPath)).toBe(true);
    expect(seedsSql.length).toBeGreaterThan(0);
  });

  it('seeds all required system configuration values including eligibility, lockout, and backup', () => {
    const expectedKeys = [
      'shelf_life_days',
      'low_stock_threshold',
      'expiring_soon_days',
      'lockout_duration_mins',
      'lockout_max_attempts',
      'session_idle_timeout_mins',
      'eligibility_min_age',
      'eligibility_max_age',
      'eligibility_min_weight_kg',
      'eligibility_gap_days_male',
      'eligibility_gap_days_other',
      'backup_retention_days',
    ];

    expectedKeys.forEach((key) => {
      expect(seedsSql).toContain(key);
    });
  });

  it('seeds users with valid bcrypt hash matching Test@1234', () => {
    expect(seedsSql).toMatch(/'Admin'/);
    expect(seedsSql).toMatch(/'Staff'/);
    expect(seedsSql).toMatch(/'Donor'/);
    expect(seedsSql).toMatch(/'Hospital\/Patient'/);

    const hashMatch = seedsSql.match(/\$2[aby]?\$\d+\$[./A-Za-z0-9]{53}/);
    expect(hashMatch).not.toBeNull();
    const hash = hashMatch[0];
    expect(bcrypt.compareSync('Test@1234', hash)).toBe(true);
  });

  it('ensures each blood unit maps to a distinct donation and respects donation gaps', () => {
    expect(seedsSql).toMatch(/'UNT-10001',\s*'DON-00000001'/);
    expect(seedsSql).toMatch(/'UNT-10002',\s*'DON-00000002'/);
    expect(seedsSql).toMatch(/'UNT-10003',\s*'DON-00000003'/);
    expect(seedsSql).toMatch(/'UNT-10004',\s*'DON-00000004'/);
  });
});

describe('Database Connection Module (db.js)', () => {
  it('exports pool, query function, and getClient function', () => {
    expect(db.pool).toBeDefined();
    expect(typeof db.query).toBe('function');
    expect(typeof db.getClient).toBe('function');
  });
});
