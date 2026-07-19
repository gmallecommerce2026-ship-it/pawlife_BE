#!/bin/bash
set -e

echo "📦 Backup MySQL..."
mysqldump -u root -p'PawLife@2025xZ' -h localhost pawcare > /root/backup_pawcare_$(date +%Y%m%d_%H%M%S).sql

echo "🗑️  Xoá dữ liệu Event trong MySQL..."
mysql -u root -p'PawLife@2025xZ' -h localhost -P 3306 pawcare <<EOF
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE EventImage;
TRUNCATE TABLE Event;
SET FOREIGN_KEY_CHECKS = 1;
EOF

echo "🗑️  Xoá cache Redis liên quan event..."
redis-cli -h 127.0.0.1 -p 6379 -a 'MatKhauRedisCuaAn123!@#' --scan --pattern "*event*" | xargs -r redis-cli -h 127.0.0.1 -p 6379 -a 'MatKhauRedisCuaAn123!@#' DEL

echo "🌱 Seed lại Event mới..."
cd /root/pawlife_BE
npx ts-node src/database/prisma/seed-events.ts

echo "✅ Hoàn tất!"