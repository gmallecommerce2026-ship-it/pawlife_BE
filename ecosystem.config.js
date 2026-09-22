module.exports = {
     apps: [
       {
         name: 'nestjs-app',
         script: 'dist/src/main.js', // Đường dẫn file chạy sau khi build
         instances: 'max',       // Chạy tối đa số lượng nhân CPU (hoặc điền số cụ thể như 2, 4)
         exec_mode: 'cluster',   // Chế độ Cluster giúp zero-downtime khi reload
         watch: false,
         max_memory_restart: '1G', // Tự động restart nếu rò rỉ bộ nhớ vượt quá 1GB
         env: {
           NODE_ENV: 'production',
           PORT: 4001 // Port mà NestJS của bạn đang chạy
         }
       }
     ]
   };
