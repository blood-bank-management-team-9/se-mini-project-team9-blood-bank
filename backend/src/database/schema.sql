-- BBMS Database Schema Migration
-- As per SRS 7.1 Database Requirements, Appendix B & SAD 3.6 Main Tables

-- Drop tables in reverse dependency order if migrating fresh
DROP TABLE IF EXISTS blood_request_units CASCADE;
DROP TABLE IF EXISTS blood_requests CASCADE;
DROP TABLE IF EXISTS blood_units CASCADE;
DROP TABLE IF EXISTS donations CASCADE;
DROP TABLE IF EXISTS donors CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users table (SRS B.1, SAD 3.6)
CREATE TABLE users (
    user_id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    email VARCHAR(60) NOT NULL UNIQUE,
    phone VARCHAR(10) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Donor', 'Hospital/Patient', 'Staff', 'Admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Locked')),
    failed_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Donors table (SRS B.2, SAD 3.6)
CREATE TABLE donors (
    donor_id VARCHAR(10) PRIMARY KEY,
    full_name VARCHAR(60) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    blood_group VARCHAR(5) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    weight_kg NUMERIC(5, 2) NOT NULL CHECK (weight_kg > 0),
    phone VARCHAR(10) NOT NULL UNIQUE,
    email VARCHAR(60),
    address VARCHAR(120),
    city VARCHAR(40) NOT NULL,
    pin_code VARCHAR(6) NOT NULL,
    last_donation_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Donations table (SRS B.3, SAD 3.6)
CREATE TABLE donations (
    donation_id VARCHAR(12) PRIMARY KEY,
    donor_id VARCHAR(10) NOT NULL REFERENCES donors(donor_id) ON DELETE RESTRICT,
    collection_date DATE NOT NULL,
    volume_ml INT NOT NULL CHECK (volume_ml IN (350, 450)),
    blood_group VARCHAR(5) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    screening_status VARCHAR(20) NOT NULL CHECK (screening_status IN ('Passed', 'Failed')),
    donation_status VARCHAR(30) NOT NULL CHECK (donation_status IN ('Recorded', 'Failed Screening')),
    recorded_by VARCHAR(10) NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    medical_notes VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Blood Units table (SRS B.4, SAD 3.6)
CREATE TABLE blood_units (
    unit_id VARCHAR(12) PRIMARY KEY,
    donation_id VARCHAR(12) NOT NULL REFERENCES donations(donation_id) ON DELETE RESTRICT,
    blood_group VARCHAR(5) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    volume_ml INT NOT NULL CHECK (volume_ml > 0),
    collection_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Reserved', 'Issued', 'Expired', 'Discarded')),
    discard_reason VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Blood Requests table (SRS B.5, SAD 3.6)
CREATE TABLE blood_requests (
    request_id VARCHAR(12) PRIMARY KEY,
    requester_id VARCHAR(10) NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    patient_name VARCHAR(60) NOT NULL,
    blood_group VARCHAR(5) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    units INT NOT NULL CHECK (units BETWEEN 1 AND 10),
    required_by_date DATE NOT NULL,
    hospital_name VARCHAR(80) NOT NULL,
    contact_number VARCHAR(10) NOT NULL,
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('Normal', 'Urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Issued', 'Cancelled')),
    rejection_reason VARCHAR(100),
    decided_by VARCHAR(10) REFERENCES users(user_id) ON DELETE RESTRICT,
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Blood Request Units (SAD 3.6: link request to reserved units)
CREATE TABLE blood_request_units (
    request_id VARCHAR(12) NOT NULL REFERENCES blood_requests(request_id) ON DELETE CASCADE,
    unit_id VARCHAR(12) NOT NULL UNIQUE REFERENCES blood_units(unit_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (request_id, unit_id)
);

-- 7. Audit Log table (SRS 7.1, SAD 3.6, C12)
CREATE TABLE audit_log (
    log_id SERIAL PRIMARY KEY,
    user_id VARCHAR(10) REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    original_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. System Config table (SAD 3.6, C13)
CREATE TABLE system_config (
    key VARCHAR(50) PRIMARY KEY,
    value VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Password Reset Tokens (SAD 3.6)
CREATE TABLE password_reset_tokens (
    token_hash VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(10) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Sessions table (SAD 3.6 for PostgreSQL session store)
CREATE TABLE sessions (
    sid VARCHAR(255) PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Performance and Integrity Indexes (SAD 3.6)
CREATE INDEX idx_blood_units_stock ON blood_units (blood_group, status, expiry_date);
CREATE INDEX idx_blood_requests_queue ON blood_requests (status, priority, created_at);
CREATE INDEX idx_audit_log_user_date ON audit_log (created_at, user_id);
CREATE INDEX idx_donors_phone ON donors (phone);
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_phone ON users (phone);
CREATE INDEX idx_sessions_expire ON sessions (expire);
