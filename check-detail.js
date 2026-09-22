const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.pet.findMany({ select: { id: true, name: true, species: true, breed: true, description: true, color: true, traits: true, idealHome: true, lostDetails: true, goodWith: true, badWith: true } })
  .then(pets => {
    const hasViet = s => /[àáạảãăắằẳẵặâấầẩẫậđèéẹẻẽêếềểễệìíịỉĩòóọỏõôốồổỗộơớờởỡợùúụủũưứừửữựỳýỵỷỹ]/i.test(s||'');
    
    pets.forEach(pet => {
      const fields = ['species','breed','description','color','traits','idealHome','lostDetails','goodWith','badWith'];
      let issues = [];
      fields.forEach(f => {
        const raw = pet[f];
        if (!raw) return;
        const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!obj) return;
        const vi = (obj.vi||'').trim();
        const en = (obj.en||'').trim();
        if (!vi && !en) issues.push(`${f}:empty`);
        else if (vi === en) issues.push(`${f}:CHUA_DICH(${vi})`);
        else if (hasViet(en) && !hasViet(vi)) issues.push(`${f}:NGUOC(en=${en})`);
        else if (!en) issues.push(`${f}:THIEU_EN(vi=${vi})`);
      });
      if (issues.length > 0) console.log(`[${pet.name}]`, issues.join(' | '));
    });
    console.log('--- DONE ---');
  })
  .finally(() => p.$disconnect());
