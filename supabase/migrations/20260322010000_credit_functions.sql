-- Add credit_balance column to organizations if it doesn't exist
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS credit_balance integer NOT NULL DEFAULT 50;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- RPC: Add credits to an org (called by Stripe webhook after purchase)
CREATE OR REPLACE FUNCTION add_credits(p_org_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE organizations
  SET credit_balance = credit_balance + p_amount
  WHERE id = p_org_id
  RETURNING credit_balance INTO new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found: %', p_org_id;
  END IF;

  RETURN new_balance;
END;
$$;

-- RPC: Deduct credits (called by credit middleware)
CREATE OR REPLACE FUNCTION deduct_credits(p_org_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE organizations
  SET credit_balance = credit_balance - p_amount
  WHERE id = p_org_id
    AND credit_balance >= p_amount
  RETURNING credit_balance INTO new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient credits or organization not found';
  END IF;

  RETURN new_balance;
END;
$$;
