const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const hasVietnamese = s => /[àáạảãăắằẳẵặâấầẩẫậđèéẹẻẽêếềểễệìíịỉĩòóọỏõôốồổỗộơớờởỡợùúụủũưứừửữựỳýỵỷỹ]/i.test(s||'');

// Đổi chỗ en <-> vi nếu en đang chứa tiếng Việt
const fixSwap = (val) => {
  if (!val) return val;
  const obj = typeof val === 'string' ? JSON.parse(val) : val;
  if (!obj || typeof obj !== 'object') return val;

  const vi = (obj.vi||'').trim();
  const en = (obj.en||'').trim();

  // en có tiếng Việt, vi không có → swap
  if (hasVietnamese(en) && !hasVietnamese(vi)) {
    return { vi: en, en: vi };
  }
  return obj;
};

const FIELDS = ['species','breed','description','color','traits','idealHome','lostDetails','goodWith','badWith'];

async function run() {
  const pets = await p.pet.findMany();
  console.log(`Xử lý ${pets.length} pet...`);
  let fixed = 0;

  for (const pet of pets) {
    const data = {};
    let changed = false;
    for (const f of FIELDS) {
      if (!pet[f]) continue;
      const original = typeof pet[f] === 'string' ? JSON.parse(pet[f]) : pet[f];
      const result = fixSwap(pet[f]);
      const en_before = (original||{}).en||'';
      const en_after = (result||{}).en||'';
      if (en_before !== en_after) {
        data[f] = result;
        changed = true;
      }
    }
    if (changed) {
      await p.pet.update({ where: { id: pet.id }, data });
      fixed++;
      console.log(`✅ Fixed: ${pet.name}`);
    }
  }

  // Fix petTrait
  const traits = await p.petTrait.findMany();
  for (const t of traits) {
    if (!t.name) continue;
    const result = fixSwap(t.name);
    const original = typeof t.name === 'string' ? JSON.parse(t.name) : t.name;
    if ((original.en||'') !== (result.en||'')) {
      await p.petTrait.update({ where: { id: t.id }, data: { name: result } });
      console.log(`✅ Fixed trait: ${result.vi}`);
    }
  }

  // Fix medicalRecord
  const meds = await p.medicalRecord.findMany();
  for (const m of meds) {
    const data = {};
    let changed = false;
    for (const f of ['recordName','nextDueName']) {
      if (!m[f]) continue;
      const result = fixSwap(m[f]);
      const original = typeof m[f] === 'string' ? JSON.parse(m[f]) : m[f];
      if ((original.en||'') !== (result.en||'')) { data[f] = result; changed = true; }
    }
    if (changed) await p.medicalRecord.update({ where: { id: m.id }, data });
  }

  console.log(`\n✅ Hoàn tất! Đã fix ${fixed} pet.`);
}

run().finally(() => p.$disconnect());
