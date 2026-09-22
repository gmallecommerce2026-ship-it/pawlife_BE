-- 1. Đóng gói dữ liệu Text hiện tại thành chuỗi JSON song ngữ
UPDATE `PetTrait` SET `name` = JSON_OBJECT('vi', `name`, 'en', `name`) WHERE `name` IS NOT NULL;
UPDATE `MedicalRecord` SET `recordName` = JSON_OBJECT('vi', `recordName`, 'en', `recordName`) WHERE `recordName` IS NOT NULL;
UPDATE `MedicalRecord` SET `nextDueName` = JSON_OBJECT('vi', `nextDueName`, 'en', `nextDueName`) WHERE `nextDueName` IS NOT NULL;

-- 2. Đổi kiểu dữ liệu của các cột sang JSON
ALTER TABLE `PetTrait` MODIFY COLUMN `name` JSON NOT NULL;
ALTER TABLE `MedicalRecord` MODIFY COLUMN `recordName` JSON NOT NULL;
ALTER TABLE `MedicalRecord` MODIFY COLUMN `nextDueName` JSON NULL;
