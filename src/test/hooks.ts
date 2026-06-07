import {
  Dynamite, Table, PrimaryKey, Default, CreationOptional, Name, DeleteAt,
  BeforeCreate, AfterCreate, BeforeUpdate, AfterUpdate, BeforeDestroy, AfterDestroy,
} from "../index";

const calls: string[] = [];

@Name('test_hook_users')
class HUser extends Table<HUser> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @Default('') declare name: string;
  @Default('') declare slug: string;
  @Default(() => 0) declare version: CreationOptional<number>;
  @DeleteAt() declare deleted_at: CreationOptional<string>;

  // Dos @BeforeCreate para validar el orden de ejecución (declaración top-to-bottom)
  @BeforeCreate()
  fill_slug() { this.slug = String(this.name).toLowerCase(); calls.push('beforeCreate'); }

  @BeforeCreate()
  mark_create() { calls.push('beforeCreate2'); }

  @AfterCreate()
  after_create() { calls.push('afterCreate'); }

  @BeforeUpdate()
  before_update(changes: any) { calls.push('beforeUpdate:' + Object.keys(changes ?? {}).sort().join(',')); }

  @AfterUpdate()
  after_update() { calls.push('afterUpdate'); }

  @BeforeDestroy()
  before_destroy() { calls.push('beforeDestroy'); }

  @AfterDestroy()
  after_destroy() { calls.push('afterDestroy'); }
}

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  OK  ${label}`); passed++; }
  else { console.error(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); failed++; }
}

export default async function hooks() {
  console.log('\n=== HOOKS ===\n');

  const dynamite = new Dynamite({
    tables: [HUser],
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  await dynamite.connect();
  await dynamite.sync();

  // =====================================================
  // 1. Opt-in vs opt-out en create
  // =====================================================
  console.log('-- create opt-in / opt-out --');

  calls.length = 0;
  const u_no = await HUser.create({ name: 'Ann' });
  assert('create sin hook: no ejecuta hooks', calls.length === 0);
  assert('create sin hook: beforeCreate no mutó slug', u_no.slug === '');

  calls.length = 0;
  const u_yes = await HUser.create({ name: 'Bob' }, { hook: true });
  assert('create con hook: orden beforeCreate -> beforeCreate2 -> afterCreate',
    JSON.stringify(calls) === JSON.stringify(['beforeCreate', 'beforeCreate2', 'afterCreate']),
    JSON.stringify(calls));
  assert('create con hook: beforeCreate mutó slug en la instancia', u_yes.slug === 'bob');
  const u_yes_db = await HUser.first({ id: u_yes.id });
  assert('create con hook: mutación persistida', u_yes_db?.slug === 'bob');

  // =====================================================
  // 2. Update de instancia
  // =====================================================
  console.log('\n-- instance update --');

  calls.length = 0;
  await u_yes.update({ name: 'Bobby' }, { hook: true });
  assert('instance update con hook: beforeUpdate recibe changes', calls.includes('beforeUpdate:name'));
  assert('instance update con hook: afterUpdate ejecutado', calls.includes('afterUpdate'));
  const bobby = await HUser.first({ id: u_yes.id });
  assert('instance update con hook: persistido', bobby?.name === 'Bobby');

  calls.length = 0;
  await u_yes.update({ name: 'Bib' });
  assert('instance update sin hook: no ejecuta hooks', calls.length === 0);
  const bib = await HUser.first({ id: u_yes.id });
  assert('instance update sin hook: persistido igual', bib?.name === 'Bib');

  // =====================================================
  // 3. Update estático masivo: una vez por entidad
  // =====================================================
  console.log('\n-- static update masivo --');

  await HUser.create({ name: 'batch' });
  await HUser.create({ name: 'batch' });

  calls.length = 0;
  const affected = await HUser.update({ version: 7 }, { name: 'batch' } as any, { hook: true });
  const before_count = calls.filter(c => c.startsWith('beforeUpdate')).length;
  const after_count = calls.filter(c => c === 'afterUpdate').length;
  assert('static update masivo: afecta 2 registros', affected === 2);
  assert('static update masivo: beforeUpdate por entidad', before_count === 2);
  assert('static update masivo: afterUpdate por entidad', after_count === 2);

  // =====================================================
  // 4. Destroy de instancia (soft delete)
  // =====================================================
  console.log('\n-- instance destroy (soft) --');

  calls.length = 0;
  await u_yes.destroy({ hook: true });
  assert('instance destroy con hook: beforeDestroy + afterDestroy', calls.includes('beforeDestroy') && calls.includes('afterDestroy'));
  const after_soft = await HUser.where({ id: u_yes.id });
  assert('instance destroy: excluido de where (soft delete)', after_soft.length === 0);

  // =====================================================
  // 5. Delete estático con hooks de destroy
  // =====================================================
  console.log('\n-- static delete --');

  const del_user = await HUser.create({ name: 'to_delete' });
  calls.length = 0;
  const deleted = await HUser.delete({ id: del_user.id } as any, { hook: true });
  assert('static delete con hook: retorna 1', deleted === 1);
  assert('static delete con hook: beforeDestroy + afterDestroy', calls.includes('beforeDestroy') && calls.includes('afterDestroy'));
  const del_check = await HUser.where({ id: del_user.id }, { _includeTrashed: true });
  assert('static delete con hook: eliminado (hard)', del_check.length === 0);

  // =====================================================
  // 6. Hooks dentro de una transacción
  // =====================================================
  console.log('\n-- hooks en transacción --');

  calls.length = 0;
  let tx_user: HUser | undefined;
  await dynamite.tx(async (tx) => {
    tx_user = await HUser.create({ name: 'TxHook' }, { hook: true, tx });
    assert('tx: afterCreate aún no corre antes del commit', !calls.includes('afterCreate'));
  });
  assert('tx: beforeCreate corrió durante create', calls.includes('beforeCreate'));
  assert('tx: afterCreate corrió tras el commit', calls.includes('afterCreate'));
  const tx_db = await HUser.first({ id: tx_user!.id });
  assert('tx: registro persistido con slug mutado', tx_db?.slug === 'txhook');

  console.log(`\n  Hooks: ${passed} passed, ${failed} failed`);
  return failed;
}
