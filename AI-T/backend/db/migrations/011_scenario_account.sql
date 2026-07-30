-- 011_scenario_account.sql
-- Adds account_name to training_scenarios so scenarios can be linked to a KB account.
-- account_name matches the metadata stored in document_embeddings (e.g. "phoenix automotive")

ALTER TABLE training_scenarios
ADD COLUMN IF NOT EXISTS account_name TEXT DEFAULT NULL;

COMMENT ON COLUMN training_scenarios.account_name IS 
'Links this scenario to a Knowledge Base account (e.g. phoenix automotive). Used to filter RAG retrieval during live sessions.';
