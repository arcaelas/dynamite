import {
  Dynamite, Table, PrimaryKey, Default, CreationOptional, Name,
} from "../index";

@Name('test_bulk_logs')
class Log extends Table<Log> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @Default('') declare level: string;
  @Default('') declare message: string;
  @Default(() => 0) declare code: CreationOptional<number>;
}

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  OK  ${label}`); passed++; }
  else { console.error(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); failed++; }
}

export default async function bulk() {
  console.log('\n=== BULK (3000 registros) ===\n');

  const dynamite = new Dynamite({
    tables: [Log],
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  await dynamite.connect();
  await dynamite.sync();

  const TOTAL = 3000;
  const CHUNK = 100;
  const levels = ['info', 'warn', 'error', 'debug'];

  // -- Creacion masiva en chunks paralelos --
  console.log(`  Creando ${TOTAL} registros en chunks de ${CHUNK}...`);
  const start = Date.now();

  for (let i = 0; i < TOTAL; i += CHUNK) {
    const batch: Promise<Log>[] = [];
    for (let j = 0; j < CHUNK && i + j < TOTAL; j++) {
      const idx = i + j;
      batch.push(Log.create({
        level: levels[idx % 4],
        message: `Log entry ${idx}`,
        code: idx,
      }));
    }
    await Promise.all(batch);
  }

  const create_time = Date.now() - start;
  console.log(`  ${TOTAL} registros creados en ${create_time}ms (${(create_time / TOTAL).toFixed(2)}ms/reg)\n`);
  assert('creacion completada', true);

  // -- Count total --
  const count_start = Date.now();
  const all = await Log.where({});
  const count_time = Date.now() - count_start;
  console.log(`  Scan total: ${all.length} registros en ${count_time}ms`);
  assert('count total = 3000', all.length === TOTAL);

  // -- Filtro por level --
  const filter_start = Date.now();
  const errors = await Log.where({ level: 'error' });
  const filter_time = Date.now() - filter_start;
  console.log(`  Filtro level=error: ${errors.length} registros en ${filter_time}ms`);
  assert('filtro level=error = 750', errors.length === 750);

  // -- Filtro por rango de code --
  const range_start = Date.now();
  const range = await Log.where({ code: { $gte: 1000, $lt: 1100 } });
  const range_time = Date.now() - range_start;
  console.log(`  Filtro code 1000-1099: ${range.length} registros en ${range_time}ms`);
  assert('rango code 1000-1099 = 100', range.length === 100);

  // -- Paginacion sobre 3000 --
  const page = await Log.where({}, { order: { code: 'ASC' }, limit: 10, offset: 500 });
  assert('paginacion offset=500 limit=10', page.length === 10);
  assert('paginacion: primer item code=500', page[0].code === 500);

  // -- First / Last sobre 3000 --
  const first = await Log.first({}, { order: { code: 'ASC' } });
  assert('first code=0', first?.code === 0);

  const last = await Log.last({});
  assert('last retorna un registro', last !== undefined);

  console.log(`\n  Bulk: ${passed} passed, ${failed} failed`);
  return failed;
}
