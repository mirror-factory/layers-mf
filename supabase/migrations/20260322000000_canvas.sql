-- Canvas data model for visual context mapping

CREATE TABLE IF NOT EXISTS canvases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,

  -- Viewport state
  viewport jsonb DEFAULT '{"x": 0, "y": 0, "zoom": 1}',

  -- Canvas settings
  settings jsonb DEFAULT '{}',

  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canvas_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id uuid NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  context_item_id uuid REFERENCES context_items(id) ON DELETE SET NULL,

  -- Position and size
  x real NOT NULL DEFAULT 0,
  y real NOT NULL DEFAULT 0,
  width real NOT NULL DEFAULT 300,
  height real NOT NULL DEFAULT 200,

  -- Visual style
  color text,
  style jsonb DEFAULT '{}',

  -- For non-context items (notes, labels)
  item_type text NOT NULL DEFAULT 'context' CHECK (item_type IN ('context', 'note', 'label', 'group')),
  content text, -- for notes/labels

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canvas_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id uuid NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  from_item_id uuid NOT NULL REFERENCES canvas_items(id) ON DELETE CASCADE,
  to_item_id uuid NOT NULL REFERENCES canvas_items(id) ON DELETE CASCADE,

  label text,
  style jsonb DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(canvas_id, from_item_id, to_item_id)
);

-- Indexes
CREATE INDEX idx_canvases_org ON canvases(org_id, updated_at DESC);
CREATE INDEX idx_canvas_items_canvas ON canvas_items(canvas_id);
CREATE INDEX idx_canvas_connections_canvas ON canvas_connections(canvas_id);

-- RLS
ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage org canvases" ON canvases FOR ALL
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Users can manage canvas items" ON canvas_items FOR ALL
  USING (canvas_id IN (SELECT id FROM canvases WHERE org_id IN (SELECT get_user_org_ids())));
CREATE POLICY "Users can manage canvas connections" ON canvas_connections FOR ALL
  USING (canvas_id IN (SELECT id FROM canvases WHERE org_id IN (SELECT get_user_org_ids())));
