import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const FILE_PATH = path.join(__dirname, 'locales.json');

const hasVietnamese = (s: string) => /[àáạảãăắằẳẵặâấầẩẫậđèéẹẻẽêếềểễệìíịỉĩòóọỏõôốồổỗộơớờởỡợùúụủũưứừửữựỳýỵỷỹ]/i.test(s);

const extractAll = (val: any, dict: Record<string, string>) => {
  if (!val) return;
  let parsed = val;
  if (typeof val === 'string') {
    try { parsed = JSON.parse(val); } catch (e) { return; }
  }
  if (Array.isArray(parsed)) { parsed.forEach(item => extractAll(item, dict)); return; }
  if (typeof parsed === 'object' && parsed !== null) {
    const vi = typeof parsed.vi === 'string' ? parsed.vi.trim() : '';
    const en = typeof parsed.en === 'string' ? parsed.en.trim() : '';
    if (!vi && !en) return;
    if (hasVietnamese(vi) || (!hasVietnamese(en) && vi)) {
      if (dict[vi] === undefined) dict[vi] = (en !== vi) ? en : '';
    } else if (hasVietnamese(en)) {
      if (dict[en] === undefined) dict[en] = (vi !== en) ? vi : '';
    } else if (vi) {
      if (dict[vi] === undefined) dict[vi] = en !== vi ? en : '';
    }
  }
};

const applyTranslation = (val: any, dict: Record<string, string>): any => {
  if (!val) return val;
  let parsed = val;
  if (typeof val === 'string') {
    try { parsed = JSON.parse(val); } catch (e) { return val; }
  }
  if (Array.isArray(parsed)) return parsed.map(item => applyTranslation(item, dict));
  if (typeof parsed === 'object' && parsed !== null) {
    const vi = typeof parsed.vi === 'string' ? parsed.vi.trim() : '';
    const en = typeof parsed.en === 'string' ? parsed.en.trim() : '';
    if (hasVietnamese(vi)) {
      const t = dict[vi];
      if (t && t.trim()) return { ...parsed, en: t.trim() };
    } else if (hasVietnamese(en)) {
      const t = dict[en];
      if (t && t.trim()) return { ...parsed, vi: t.trim() };
    }
    return parsed;
  }
  return val;
};

async function exportData() {
  console.log('⏳ Đang hút dữ liệu từ Database...');
  const dict: Record<string, string> = {};

  const pets = await prisma.pet.findMany();
  console.log(`📊 Tìm thấy ${pets.length} pet`);
  pets.forEach(p => {
    extractAll(p.species, dict); extractAll(p.breed, dict); extractAll(p.description, dict);
    extractAll(p.color, dict); extractAll(p.traits, dict); extractAll(p.idealHome, dict);
    extractAll(p.lostDetails, dict); extractAll(p.goodWith, dict); extractAll(p.badWith, dict);
  });

  const traits = await prisma.petTrait.findMany();
  console.log(`📊 Tìm thấy ${traits.length} traits`);
  traits.forEach(t => extractAll(t.name, dict));

  const meds = await prisma.medicalRecord.findMany();
  console.log(`📊 Tìm thấy ${meds.length} medical records`);
  meds.forEach(m => { extractAll(m.recordName, dict); extractAll(m.nextDueName, dict); });

  const needTranslation = Object.entries(dict).filter(([k, v]) => !v);
  const alreadyDone = Object.entries(dict).filter(([k, v]) => !!v);
  console.log(`✅ Đã dịch: ${alreadyDone.length} cụm`);
  console.log(`⚠️  Chưa dịch: ${needTranslation.length} cụm`);

  fs.writeFileSync(FILE_PATH, JSON.stringify(dict, null, 2), 'utf-8');
  console.log(`✅ Đã xuất thành công ${Object.keys(dict).length} cụm từ!`);
}

async function importData() {
  if (!fs.existsSync(FILE_PATH)) { console.error('❌ Không tìm thấy file locales.json!'); return; }
  console.log('⏳ Đang cập nhật bản dịch vào Database...');
  const dict = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));

  const pets = await prisma.pet.findMany();
  for (const p of pets) {
    await prisma.pet.update({
      where: { id: p.id },
      data: {
        species: applyTranslation(p.species, dict), breed: applyTranslation(p.breed, dict),
        description: applyTranslation(p.description, dict), color: applyTranslation(p.color, dict),
        traits: applyTranslation(p.traits, dict), idealHome: applyTranslation(p.idealHome, dict),
        lostDetails: applyTranslation(p.lostDetails, dict), goodWith: applyTranslation(p.goodWith, dict),
        badWith: applyTranslation(p.badWith, dict),
      }
    });
  }

  const traits = await prisma.petTrait.findMany();
  for (const t of traits) {
    await prisma.petTrait.update({ where: { id: t.id }, data: { name: applyTranslation(t.name, dict) } });
  }

  const meds = await prisma.medicalRecord.findMany();
  for (const m of meds) {
    await prisma.medicalRecord.update({
      where: { id: m.id },
      data: { recordName: applyTranslation(m.recordName, dict), nextDueName: applyTranslation(m.nextDueName, dict) }
    });
  }
  console.log('✅ Hoàn tất! Toàn bộ Database đã được đồng bộ bản dịch.');
}

const mode = process.argv[2];
if (mode === 'export') exportData().finally(() => prisma.$disconnect());
else if (mode === 'import') importData().finally(() => prisma.$disconnect());
else console.log('⚠️ Cú pháp: npx ts-node src/database/prisma/manual-translator.ts [export | import]');
