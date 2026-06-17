-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `orderNo` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING_PAYMENT', 'PENDING_SHIPMENT', 'PENDING_RECEIPT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `designName` VARCHAR(191) NULL,
    `items` JSON NOT NULL,
    `totalPrice` DOUBLE NOT NULL,
    `wristSize` DOUBLE NULL,
    `wearingStyle` VARCHAR(191) NULL,
    `shopifyDraftOrderId` VARCHAR(191) NULL,
    `shopifyOrderId` VARCHAR(191) NULL,
    `shopifyOrderName` VARCHAR(191) NULL,
    `shopifyCheckoutUrl` TEXT NULL,
    `shopifySyncStatus` ENUM('PENDING', 'SYNCED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `shopifySyncError` TEXT NULL,
    `carrier` VARCHAR(191) NULL,
    `trackingNumber` VARCHAR(191) NULL,
    `trackingUrl` TEXT NULL,
    `trackingEvents` JSON NULL,
    `paidAt` DATETIME(3) NULL,
    `shippedAt` DATETIME(3) NULL,
    `receivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_orderNo_key`(`orderNo`),
    UNIQUE INDEX `orders_shopifyOrderId_key`(`shopifyOrderId`),
    INDEX `orders_userId_idx`(`userId`),
    INDEX `orders_status_idx`(`status`),
    INDEX `orders_shopifyDraftOrderId_idx`(`shopifyDraftOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
