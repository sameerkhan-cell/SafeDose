-- Migration: add_blockchain_job_queue_and_pill_status
-- Adds:
--   1. blockchainStatus column to `pill` table (mirrors what Batch already has)
--   2. `blockchain_job` table — DB-backed queue for on-chain anchoring operations

-- 1. Add blockchainStatus to pill
ALTER TABLE `pill`
  ADD COLUMN `blockchainStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING'
  COMMENT 'PENDING | CONFIRMED | FAILED';

-- 2. Create blockchain_job table
CREATE TABLE `blockchain_job` (
  `id`          VARCHAR(191) NOT NULL,
  `entityType`  VARCHAR(191) NOT NULL COMMENT '"BATCH" | "PILL" | "VERIFICATION_ANCHOR"',
  `entityId`    VARCHAR(191) NOT NULL COMMENT 'batch.id / pill.id / verificationLog.id',
  `entityRef`   VARCHAR(191) NULL        COMMENT 'human-readable ref for debugging',
  `status`      VARCHAR(191) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING | PROCESSING | CONFIRMED | FAILED',
  `attempts`    INT NOT NULL DEFAULT 0,
  `lastError`   TEXT NULL,
  `txHash`      VARCHAR(191) NULL,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `blockchain_job_status_createdAt_idx` (`status`, `createdAt`),
  INDEX `blockchain_job_entityType_entityId_idx` (`entityType`, `entityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
