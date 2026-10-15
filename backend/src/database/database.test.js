const fs = require('fs');
const path = require('path');
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
      const tableRegex = new RegExp(`CREATE TABLE\\s+${table}\\b`, 'i');
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
    // Blood group validation
    expect(schemaSql).toMatch(/CHECK\s*\(\s*blood_group\s+IN/i);
    // Role validation
    expect(schemaSql).toMatch(/CHECK\s*\(\s*role\s+IN/i);
    // Volume validation
    expect(schemaSql).toMatch(/CHECK\s*\(\s*volume_ml\s+IN/i);
  });
});

describe('Database Seed Data (SAD 3.6 & STP Setup)', () => {
  const seedsPath = path.join(__dirname, 'seeds.sql');
  let seedsSql = '';

  beforeAll(() => {
    seedsSql = fs.readFileSync(seedsPath, 'utf8');
  });

  it('contains seeds.sql file', () => {
    expect(fs.existsSync(seedsPath)).toBe(true);
    expect(seedsSql.length).toBeGreaterThan(0);
  });

  it('seeds default system configuration values', () => {
    expect(seedsSql).toMatch(/shelf_life_days/i);
    expect(seedsSql).toMatch(/low_stock_threshold/i);
    expect(seedsSql).toMatch(/expiring_soon_days/i);
  });

  it('seeds users for each role (Admin, Staff, Donor, Hospital/Patient)', () => {
    expect(seedsSql).toMatch(/'Admin'/);
    expect(seedsSql).toMatch(/'Staff'/);
    expect(seedsSql).toMatch(/'Donor'/);
    expect(seedsSql).toMatch(/'Hospital\/Patient'/);
  });

  it('seeds sample donors, donations, and blood units', () => {
    expect(seedsSql).toMatch(/INSERT INTO donors/i);
    expect(seedsSql).toMatch(/INSERT INTO donations/i);
    expect(seedsSql).toMatch(/INSERT INTO blood_units/i);
    expect(seedsSql).toMatch(/INSERT INTO blood_requests/i);
  });
});

describe('Database Connection Module (db.js)', () => {
  it('exports pool, query function, and getClient function', () => {
    expect(db.pool).toBeDefined();
    expect(typeof db.query).toBe('function');
    expect(typeof db.getClient).toBe('function');
  });
});
