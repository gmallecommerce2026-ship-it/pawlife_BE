const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const FIELDS = ['species','breed','description','color','traits','idealHome','lostDetails','goodWith','badWith'];

p.pet.findMany().then(pets => {
  pets.forEach(pet => {
    const out = {};
    FIELDS.forEach(f => {
      if (!pet[f]) return;
      const obj = typeof pet[f] === 'string' ? JSON.parse(pet[f]) : pet[f];
      out[f] = obj;
    });
    console.log(pet.name, '->', JSON.stringify(out));
  });
}).finally(() => p.$disconnect());
