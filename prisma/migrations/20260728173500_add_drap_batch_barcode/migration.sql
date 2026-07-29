-- AlterTable
ALTER TABLE `drap_batch_registry` ADD COLUMN `barcode` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `drap_batch_registry_barcode_idx` ON `drap_batch_registry`(`barcode`);
