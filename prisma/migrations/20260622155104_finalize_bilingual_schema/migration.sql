-- AlterTable
ALTER TABLE `Pet` MODIFY `species` VARCHAR(191) NOT NULL,
    MODIFY `breed` VARCHAR(191) NULL,
    MODIFY `description` TEXT NULL,
    MODIFY `color` VARCHAR(191) NULL,
    MODIFY `traits` TEXT NULL,
    MODIFY `idealHome` TEXT NULL,
    MODIFY `lostDetails` VARCHAR(191) NULL;
