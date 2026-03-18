# 🚀 Deploying UniSearch

Follow these steps to deploy your production-ready student search engine on Vercel with Supabase.

## Step 1 — Supabase Setup (Database)
1.  **Create Project**: Go to [supabase.com](https://supabase.com) → New Project.
2.  **Database Password**: Set a strong password and save it.
3.  **Initialize Tables**: Once the project is ready (~2 mins), go to the **SQL Editor** in the left sidebar.
4.  **Run Schema**: Paste the entire schema from your README or the SQL below and click **Run**.
5.  **Copy API Keys**: Go to **Settings** (cog icon) → **API**.
    *   Copy **Project URL**
    *   Copy **anon public key**
    *   Copy **service_role secret key** (requires clicking 'Reveal')

## Step 2 — Environment Configuration
Create a `.env` file locally or prepare to enter these in Vercel:
```env
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_PASSWORD=your_admin_password
JWT_SECRET=any_32_character_random_string
```

## Step 3 — Deploy to Vercel
1.  **Import Repo**: Login to [vercel.com](https://vercel.com) and click **Add New** → **Project**.
2.  **Connect GitHub**: Select your UniSearch repository.
3.  **Configure**:
    *   Framework Preset: **Other**
    *   Root Directory: `./`
4.  **Add Environment Variables**: Under the "Environment Variables" section, add all 5 variables from Step 2.
5.  **Deploy**: Click **Deploy**. Vercel will automatically detect the `vercel.json` and serve your PHP API as serverless functions and `public/` as static files.

## Step 4 — Initial Seeding (Optional)
Once live, you can use the **Import Data** feature in the Admin Dashboard (`/admin`) to upload an Excel file. Use the "Download Template" button in the dashboard to get the correct format.

## Supabase Database Schema
Copy and run this in your Supabase SQL Editor:
```sql
-- DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  total_years SMALLINT     NOT NULL DEFAULT 4,
  created_at  TIMESTAMPTZ  DEFAULT now()
);

INSERT INTO departments (name, code, total_years) VALUES
  ('Computer Science',        'CS',   4),
  ('Electronics Engineering', 'EC',   4),
  ('Mechanical Engineering',  'ME',   4),
  ('Civil Engineering',       'CE',   4),
  ('MBA',                     'MBA',  2),
  ('BBA',                     'BBA',  3),
  ('Law',                     'LAW',  5),
  ('Medicine',                'MBBS', 5),
  ('Architecture',            'ARCH', 5),
  ('Data Science',            'DS',   4)
ON CONFLICT DO NOTHING;

-- STUDENTS TABLE
CREATE TABLE IF NOT EXISTS students (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        TEXT    NOT NULL,
  student_id       TEXT    NOT NULL UNIQUE,
  email            TEXT,
  phone_number     TEXT,
  address          TEXT,
  account_number   TEXT,
  department_id    INT     REFERENCES departments(id),
  department_name  TEXT,
  admission_year   SMALLINT NOT NULL,
  graduation_year  SMALLINT,
  current_year     SMALLINT,
  current_semester SMALLINT,
  enrollment_status TEXT DEFAULT 'active' CHECK (enrollment_status IN ('active', 'graduated', 'dropped', 'suspended', 'transferred')),
  date_of_birth    DATE,
  gender           TEXT CHECK (gender IN ('Male','Female','Other')),
  blood_group      TEXT,
  guardian_name    TEXT,
  guardian_phone   TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- SEMESTERS TABLE
CREATE TABLE IF NOT EXISTS semesters (
  id             SERIAL PRIMARY KEY,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  semester_number SMALLINT NOT NULL CHECK (semester_number BETWEEN 1 AND 12),
  academic_year   TEXT NOT NULL,
  sgpa            NUMERIC(4,2),
  cgpa            NUMERIC(4,2),
  attendance_pct  NUMERIC(5,2),
  result          TEXT DEFAULT 'pending' CHECK (result IN ('pending', 'pass', 'fail', 'detained', 'promoted', 'backlog')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, semester_number)
);

-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON students FOR SELECT USING (true);
CREATE POLICY "Public read sems" ON semesters FOR SELECT USING (true);
CREATE POLICY "Public read depts" ON departments FOR SELECT USING (true);
CREATE POLICY "Service bypass" ON students USING (true) WITH CHECK (true);
CREATE POLICY "Service bypass sems" ON semesters USING (true) WITH CHECK (true);
CREATE POLICY "Service bypass depts" ON departments USING (true) WITH CHECK (true);
```
