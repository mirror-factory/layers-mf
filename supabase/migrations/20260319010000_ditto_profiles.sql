CREATE TABLE IF NOT EXISTS ditto_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Learned preferences
  interests jsonb DEFAULT '[]',           -- ["pricing", "engineering", "design"]
  preferred_sources jsonb DEFAULT '{}',    -- { "linear": 0.8, "slack": 0.3 }
  communication_style text DEFAULT 'balanced', -- 'formal', 'casual', 'balanced'
  detail_level text DEFAULT 'moderate',    -- 'brief', 'moderate', 'detailed'
  priority_topics jsonb DEFAULT '[]',      -- ["billing", "auth", "api"]
  working_hours jsonb DEFAULT '{"start": 9, "end": 17}',

  -- Profile metadata
  interaction_count integer DEFAULT 0,
  last_generated_at timestamptz,
  confidence real DEFAULT 0.0,  -- 0.0 to 1.0

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, org_id)
);

ALTER TABLE ditto_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON ditto_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON ditto_profiles FOR ALL
  USING (user_id = auth.uid());
