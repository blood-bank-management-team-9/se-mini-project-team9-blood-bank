-- Seed Data for BBMS (all tables)
-- As per SRS 7.1, Appendix B, SAD 3.6, FR-DON-04 & STP Setup

-- 1. System Config Defaults (Configurable system parameters: shelf life, lockout, eligibility, backup)
INSERT INTO system_config (key, value, description) VALUES
('shelf_life_days', '35', 'Default shelf life in days for collected blood units (FR-STK-02)'),
('low_stock_threshold', '5', 'Minimum threshold of available units to trigger low stock alert (FR-STK-04)'),
('expiring_soon_days', '7', 'Threshold in days to flag units expiring soon (FR-STK-05)'),
('lockout_duration_mins', '15', 'Account lockout duration after failed login attempts (FR-AUTH-04)'),
('lockout_max_attempts', '5', 'Maximum failed login attempts before locking account (FR-AUTH-04)'),
('session_idle_timeout_mins', '15', 'Idle timeout before terminating user session (ADR-04)'),
('eligibility_min_age', '18', 'Minimum eligible donor age in years (FR-DON-04)'),
('eligibility_max_age', '65', 'Maximum eligible donor age in years (FR-DON-04)'),
('eligibility_min_weight_kg', '45', 'Minimum donor body weight in kg (FR-DON-04)'),
('eligibility_gap_days_male', '90', 'Minimum donation gap for male donors in days (FR-DON-04)'),
('eligibility_gap_days_other', '120', 'Minimum donation gap for female/other donors in days (FR-DON-04)'),
('backup_retention_days', '30', 'Days to retain nightly database backups (NFR-SAF-03)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Seed Users for each role (Donor, Hospital/Patient, Staff, Admin)
-- Default test password for all seed accounts is: Test@1234
-- Verified bcrypt hash (10 salt rounds): $2b$10$w3OKVq0YKqTSozS8Neu.quLt9laFtz06c0SO8RE.r0nakZtKFJu5q
INSERT INTO users (user_id, name, email, phone, password_hash, role, status) VALUES
('USR-ADM01', 'System Administrator', 'admin@bloodbank.org', '9876543210', '$2b$10$w3OKVq0YKqTSozS8Neu.quLt9laFtz06c0SO8RE.r0nakZtKFJu5q', 'Admin', 'Active'),
('USR-STF01', 'Staff Member Joy', 'staff@bloodbank.org', '9876543211', '$2b$10$w3OKVq0YKqTSozS8Neu.quLt9laFtz06c0SO8RE.r0nakZtKFJu5q', 'Staff', 'Active'),
('USR-DNR01', 'John Doe (Donor)', 'john.doe@example.com', '9876543212', '$2b$10$w3OKVq0YKqTSozS8Neu.quLt9laFtz06c0SO8RE.r0nakZtKFJu5q', 'Donor', 'Active'),
('USR-HSP01', 'City General Hospital', 'hospital@citygen.org', '9876543213', '$2b$10$w3OKVq0YKqTSozS8Neu.quLt9laFtz06c0SO8RE.r0nakZtKFJu5q', 'Hospital/Patient', 'Active')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Seed Donors covering diverse blood groups (last_donation_date matches seeded donations)
INSERT INTO donors (donor_id, full_name, date_of_birth, gender, blood_group, weight_kg, phone, email, address, city, pin_code, last_donation_date, status) VALUES
('DNR-00001', 'John Doe', '1995-04-12', 'Male', 'O+', 72.5, '9876543212', 'john.doe@example.com', '12 Brigade Road', 'Bangalore', '560001', '2026-10-01', 'Active'),
('DNR-00002', 'Anita Sharma', '1998-09-21', 'Female', 'A+', 58.0, '9876543220', 'anita.s@example.com', '45 Indiranagar 100ft Rd', 'Bangalore', '560038', '2026-10-03', 'Active'),
('DNR-00003', 'Rohan Verma', '2000-01-05', 'Male', 'B+', 65.0, '9876543221', 'rohan.v@example.com', '88 Koramangala 4th Block', 'Bangalore', '560034', '2026-10-05', 'Active'),
('DNR-00004', 'Priya Nair', '1993-11-30', 'Female', 'AB-', 54.0, '9876543222', 'priya.n@example.com', '102 Whitefield Main Rd', 'Bangalore', '560066', NULL, 'Active'),
('DNR-00005', 'Vikram Singh', '1997-03-14', 'Male', 'O+', 78.0, '9876543223', 'vikram.s@example.com', '56 MG Road', 'Bangalore', '560001', '2026-09-15', 'Active')
ON CONFLICT (donor_id) DO NOTHING;

-- 4. Seed Donations (Each donation corresponds to one collection)
INSERT INTO donations (donation_id, donor_id, collection_date, volume_ml, blood_group, screening_status, donation_status, recorded_by, medical_notes) VALUES
('DON-00000001', 'DNR-00001', '2026-10-01', 450, 'O+', 'Passed', 'Recorded', 'USR-STF01', 'Donor vitals normal, standard collection'),
('DON-00000002', 'DNR-00002', '2026-10-03', 350, 'A+', 'Passed', 'Recorded', 'USR-STF01', 'Good recovery, no adverse events'),
('DON-00000003', 'DNR-00003', '2026-10-05', 450, 'B+', 'Passed', 'Recorded', 'USR-STF01', 'Eligible and screened successfully'),
('DON-00000004', 'DNR-00005', '2026-09-15', 450, 'O+', 'Passed', 'Recorded', 'USR-STF01', 'Regular voluntary blood donation')
ON CONFLICT (donation_id) DO NOTHING;

-- 5. Seed Blood Units (1 donation = 1 unit; Available units with 35-day shelf life)
INSERT INTO blood_units (unit_id, donation_id, blood_group, volume_ml, collection_date, expiry_date, status) VALUES
('UNT-10001', 'DON-00000001', 'O+', 450, '2026-10-01', '2026-11-05', 'Available'),
('UNT-10002', 'DON-00000002', 'A+', 350, '2026-10-03', '2026-11-07', 'Available'),
('UNT-10003', 'DON-00000003', 'B+', 450, '2026-10-05', '2026-11-09', 'Available'),
('UNT-10004', 'DON-00000004', 'O+', 450, '2026-09-15', '2026-10-20', 'Available')
ON CONFLICT (unit_id) DO NOTHING;

-- 6. Seed Blood Requests
INSERT INTO blood_requests (request_id, requester_id, patient_name, blood_group, units, required_by_date, hospital_name, contact_number, priority, status) VALUES
('REQ-00000001', 'USR-HSP01', 'Ramesh Rao', 'O+', 1, '2026-10-15', 'City General Hospital', '9876543213', 'Urgent', 'Pending')
ON CONFLICT (request_id) DO NOTHING;

-- 7. Seed Initial Audit Log
INSERT INTO audit_log (user_id, action, entity, entity_id, new_value) VALUES
('USR-ADM01', 'SYSTEM_INITIALIZATION', 'system_config', 'ALL', '{"message": "Initial seed data loaded successfully"}'::jsonb);
