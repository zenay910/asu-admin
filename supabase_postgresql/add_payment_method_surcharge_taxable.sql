-- Payment method, CC surcharge, and per-line taxable flag for invoice math.
-- Idempotent: safe to re-run.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS surcharge numeric NOT NULL DEFAULT 0;

ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS taxable boolean NOT NULL DEFAULT true;
