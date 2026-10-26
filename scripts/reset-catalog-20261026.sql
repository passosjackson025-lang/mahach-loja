-- Limpeza única solicitada pelo proprietário para iniciar o cadastro manual.
-- Executar todas as instruções em UMA transação, somente após publicar o
-- bootstrap que aceita catálogo vazio. Nunca executar automaticamente no startup.
SET LOCAL lock_timeout = '5s';
LOCK TABLE mahach_stage.products IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF (SELECT COUNT(*) FROM mahach_stage.products) <> 1771 THEN
  RAISE EXCEPTION 'Catálogo diferente dos 1771 produtos autorizados; limpeza cancelada';
 END IF;
 IF to_regclass('mahach_stage.catalog_backup_20261026') IS NOT NULL THEN
  RAISE EXCEPTION 'A cópia desta limpeza já existe; não repetir a operação';
 END IF;
END $$;
CREATE TABLE mahach_stage.catalog_backup_20261026 AS TABLE mahach_stage.products;
COMMENT ON TABLE mahach_stage.catalog_backup_20261026 IS 'Cópia privada dos 1771 produtos retirados a pedido do proprietário em 2026-10-26. Não é catálogo ativo; não reimportar automaticamente.';
DELETE FROM mahach_stage.products WHERE id IN (SELECT id FROM mahach_stage.catalog_backup_20261026);
DO $$ BEGIN
 IF (SELECT COUNT(*) FROM mahach_stage.catalog_backup_20261026) <> 1771
  OR EXISTS (SELECT 1 FROM mahach_stage.products) THEN
  RAISE EXCEPTION 'Falha na conferência da limpeza; reverter transação';
 END IF;
END $$;
