#!/usr/bin/env bash
cd "$(dirname "$0")/.." || exit 1
mkdir -p logs
RANGES=("801 3100" "3101 5400" "5401 7700" "7701 10000")   # mỗi dải 2300 thẻ
TS="npx ts-node -T"
P=src/database/prisma

echo "== BƯỚC 1: kiểm tra nội dung QR (chỉ đọc) =="
for r in "${RANGES[@]}"; do
  read -r a b <<< "$r"
  $TS $P/upload-qr-by-content.ts --from=$a --to=$b --fast --dry-run > "logs/verify_${a}_${b}.log" 2>&1 &
done
wait

ok=1
for r in "${RANGES[@]}"; do
  read -r a b <<< "$r"
  n=$((b - a + 1))
  f="logs/verify_${a}_${b}.log"
  if ! grep -q "ID hợp lệ từ ${a}: ${n} | file bị đặt sai tên: 0" "$f" \
     || ! grep -q "Trùng ID: 0 | định dạng lạ: 0 | không đọc được: 0" "$f"; then
    echo "⛔ Dải ${a}-${b} có vấn đề, xem $f"; ok=0
  fi
done
[ "$ok" = 1 ] || { echo "DỪNG, chưa upload gì."; exit 1; }
echo "✅ Nội dung QR khớp tên file cho toàn bộ dải."

echo "== BƯỚC 2: upload lên qr-codes/v2/ và key cũ =="
for r in "${RANGES[@]}"; do
  read -r a b <<< "$r"
  $TS $P/update-qr-images.ts --version=2 --from=$a --to=$b > "logs/upload_${a}_${b}.log" 2>&1 &
done
wait
grep -H "Xong:" logs/upload_*.log