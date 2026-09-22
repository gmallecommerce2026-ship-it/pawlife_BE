-- 1. Bọc JSON cho Event
UPDATE `Event` SET `title` = JSON_OBJECT('vi', `title`, 'en', `title`) WHERE `title` IS NOT NULL AND JSON_VALID(`title`) = 0;
UPDATE `Event` SET `category` = JSON_OBJECT('vi', `category`, 'en', `category`) WHERE `category` IS NOT NULL AND JSON_VALID(`category`) = 0;
UPDATE `Event` SET `description` = JSON_OBJECT('vi', `description`, 'en', `description`) WHERE `description` IS NOT NULL AND JSON_VALID(`description`) = 0;
UPDATE `Event` SET `locationName` = JSON_OBJECT('vi', `locationName`, 'en', `locationName`) WHERE `locationName` IS NOT NULL AND JSON_VALID(`locationName`) = 0;

-- 2. Bọc JSON cho Organizer
UPDATE `Organizer` SET `about` = JSON_OBJECT('vi', `about`, 'en', `about`) WHERE `about` IS NOT NULL AND JSON_VALID(`about`) = 0;

-- 3. Bọc JSON cho Pet (Xử lý dứt điểm cảnh báo Drift của bảng Pet)
UPDATE `Pet` SET `species` = JSON_OBJECT('vi', `species`, 'en', `species`) WHERE `species` IS NOT NULL AND JSON_VALID(`species`) = 0;
UPDATE `Pet` SET `breed` = JSON_OBJECT('vi', `breed`, 'en', `breed`) WHERE `breed` IS NOT NULL AND JSON_VALID(`breed`) = 0;
UPDATE `Pet` SET `description` = JSON_OBJECT('vi', `description`, 'en', `description`) WHERE `description` IS NOT NULL AND JSON_VALID(`description`) = 0;
UPDATE `Pet` SET `color` = JSON_OBJECT('vi', `color`, 'en', `color`) WHERE `color` IS NOT NULL AND JSON_VALID(`color`) = 0;
UPDATE `Pet` SET `traits` = JSON_OBJECT('vi', `traits`, 'en', `traits`) WHERE `traits` IS NOT NULL AND JSON_VALID(`traits`) = 0;
UPDATE `Pet` SET `idealHome` = JSON_OBJECT('vi', `idealHome`, 'en', `idealHome`) WHERE `idealHome` IS NOT NULL AND JSON_VALID(`idealHome`) = 0;
UPDATE `Pet` SET `lostDetails` = JSON_OBJECT('vi', `lostDetails`, 'en', `lostDetails`) WHERE `lostDetails` IS NOT NULL AND JSON_VALID(`lostDetails`) = 0;
