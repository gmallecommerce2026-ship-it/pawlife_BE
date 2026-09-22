const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.pet.findMany({ select: { id: true, name: true, species: true, breed: true, description: true, color: true } })
  .then(pets => {
    console.log('Tong so pet:', pets.length);
    
    let noViEn = 0, sameViEn = 0, ok = 0;
    
    pets.forEach(pet => {
      const s = pet.species;
      if (!s) { noViEn++; console.log('[NO_DATA]', pet.name, '-', pet.id); return; }
      const obj = typeof s === 'string' ? JSON.parse(s) : s;
      if (!obj.vi && !obj.en) { noViEn++; console.log('[NO_VI_EN]', pet.name, JSON.stringify(obj)); }
      else if (obj.vi === obj.en) { sameViEn++; console.log('[CHUA_DICH]', pet.name, JSON.stringify(obj)); }
      else { ok++; }
    });
    
    console.log('--- TONG KET ---');
    console.log('Da dich dung:', ok);
    console.log('Chua dich (vi===en):', sameViEn);
    console.log('Khong co data:', noViEn);
  })
  .finally(() => p.$disconnect());
