-- Migration: add_blockchain_job_gas_and_block
-- Adds real on-chain receipt fields to blockchain_job for timeline/cards display.

ALTER TABLE `blockchain_job`
  ADD COLUMN `gasUsed` VARCHAR(191) NULL,
  ADD COLUMN `blockNumber` INT NULL;
