-- 1. Đóng gói dữ liệu Text hiện tại thành chuỗi JSON song ngữ (bảo toàn 100% dữ liệu cũ)
UPDATE `Pet` SET `species` = JSON_OBJECT('vi', `species`, 'en', `species`) WHERE `species` IS NOT NULL;
UPDATE `Pet` SET `breed` = JSON_OBJECT('vi', `breed`, 'en', `breed`) WHERE `breed` IS NOT NULL;
UPDATE `Pet` SET `description` = JSON_OBJECT('vi', `description`, 'en', `description`) WHERE `description` IS NOT NULL;
UPDATE `Pet` SET `color` = JSON_OBJECT('vi', `color`, 'en', `color`) WHERE `color` IS NOT NULL;
UPDATE `Pet` SET `traits` = JSON_OBJECT('vi', `traits`, 'en', `traits`) WHERE `traits` IS NOT NULL;
UPDATE `Pet` SET `idealHome` = JSON_OBJECT('vi', `idealHome`, 'en', `idealHome`) WHERE `idealHome` IS NOT NULL;
UPDATE `Pet` SET `lostDetails` = JSON_OBJECT('vi', `lostDetails`, 'en', `lostDetails`) WHERE `lostDetails` IS NOT NULL;

-- 2. Đổi kiểu dữ liệu của các cột sang JSON để sẵn sàng sử dụng
ALTER TABLE `Pet` 
  MODIFY COLUMN `species` JSON NOT NULL,
  MODIFY COLUMN `breed` JSON NULL,
  MODIFY COLUMN `description` JSON NULL,
  MODIFY COLUMN `color` JSON NULL,
  MODIFY COLUMN `traits` JSON NULL,
  MODIFY COLUMN `idealHome` JSON NULL,
  MODIFY COLUMN `lostDetails` JSON NULL;
