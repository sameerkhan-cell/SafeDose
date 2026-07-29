-- AlterTable
ALTER TABLE `drap_batch_registry` ADD COLUMN `expiryDate` DATETIME(3) NULL,
    ADD COLUMN `manufactureDate` DATETIME(3) NULL,
    ADD COLUMN `extraData` JSON NULL,
    ADD COLUMN `sourceDocumentUrl` VARCHAR(191) NULL;
