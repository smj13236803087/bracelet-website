-- AlterTable
ALTER TABLE `pending_users` ADD COLUMN `role` ENUM('USER', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `role` ENUM('USER', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX `users_role_idx` ON `users`(`role`);
