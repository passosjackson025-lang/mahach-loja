-- Aplicar somente após backup/restauração testados e aprovação para produção.
-- Nenhum produto é ativado, removido ou recebe estoque nesta migração.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE mahach_stage.products ADD COLUMN IF NOT EXISTS stock_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE mahach_stage.products ADD COLUMN IF NOT EXISTS shipping_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE mahach_stage.orders ADD COLUMN IF NOT EXISTS stock_reserved boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS mahach_products_sku_unique ON mahach_stage.products (sku) WHERE sku IS NOT NULL AND sku <> '';
COMMIT;
