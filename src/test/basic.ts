import {
  Dynamite, Table, PrimaryKey, Default, Get, Set, Validate, NotNull,
  Name, CreatedAt, UpdatedAt, DeleteAt, Index, IndexSort,
  CreationOptional, NonAttribute, HasMany, BelongsTo,
} from "../index";
import type { InferAttributes } from "../index";

// -- Modelos con naming aislado --

@Name('test_basic_users')
class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @NotNull('Name is required')
  declare name: string;

  @Default('')
  declare email: string;

  @Set((next: any) => typeof next === 'number' ? next : 0)
  @Default(() => 0)
  declare score: CreationOptional<number>;

  @Get((v: any) => v?.toUpperCase())
  @Default('')
  declare role: CreationOptional<string>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  @DeleteAt()
  declare deleted_at: CreationOptional<string>;

  @HasMany(() => Task, 'user_id', 'id')
  declare tasks: NonAttribute<Task[]>;
}

@Name('test_basic_tasks')
class Task extends Table<Task> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @NotNull()
  declare title: string;

  @Default('')
  declare user_id: string;

  @Default(() => false)
  declare done: CreationOptional<boolean>;

  @BelongsTo(() => User, 'id', 'user_id')
  declare user: NonAttribute<User>;
}

// -- Helpers --

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  OK  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
    failed++;
  }
}

// -- Test --

export default async function basic() {
  console.log('\n=== BASIC ===\n');

  const dynamite = new Dynamite({
    tables: [User, Task],
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });

  await dynamite.connect();
  await dynamite.sync();
  console.log('  Connected + synced\n');

  // -- Decoradores y pipelines --
  console.log('-- Decoradores --');

  const u1 = await User.create({ name: 'Daniel', email: 'dan@test.com', role: 'admin' });
  assert('@Default genera id', typeof u1.id === 'string' && u1.id.length > 0);
  assert('@Default genera score = 0', u1.score === 0);
  assert('@Get transforma role a uppercase', u1.role === 'ADMIN');
  assert('@CreatedAt genera timestamp', typeof u1.created_at === 'string' && u1.created_at.length > 0);
  assert('@UpdatedAt genera timestamp', typeof u1.updated_at === 'string');
  assert('__isPersisted es true', (u1 as any).__isPersisted === true);

  // @NotNull lanza en campo omitido
  let not_null_threw = false;
  try { await User.create({} as any); } catch { not_null_threw = true; }
  assert('@NotNull lanza en campo omitido', not_null_threw);

  // @NotNull lanza en string vacio
  let not_null_empty = false;
  try { await User.create({ name: '' } as any); } catch { not_null_empty = true; }
  assert('@NotNull lanza en string vacio', not_null_empty);

  // @Set transforma valor
  const u2 = await User.create({ name: 'Test', score: 'invalid' as any });
  assert('@Set transforma non-number a 0', u2.score === 0);

  // -- CRUD --
  console.log('\n-- CRUD --');

  // where por PK (Query)
  const found = await User.where({ id: u1.id });
  assert('where por PK retorna 1', found.length === 1);
  assert('where por PK retorna el correcto', found[0]?.id === u1.id);

  // where por campo (Scan)
  const by_name = await User.where({ name: 'Daniel' });
  assert('where por campo retorna resultado', by_name.length >= 1);

  // where con operador
  const by_op = await User.where('name', '$eq', 'Daniel');
  assert('where con operador $eq', by_op.length >= 1);

  // first / last
  const first = await User.first({ id: u1.id });
  assert('first retorna instancia', first?.id === u1.id);

  const last = await User.last();
  assert('last retorna instancia', last !== undefined);

  // update estatico por PK
  await User.update({ email: 'updated@test.com' }, { id: u1.id });
  const updated = await User.first({ id: u1.id });
  assert('update estatico por PK', updated?.email === 'updated@test.com');

  // update de instancia
  const prev_updated_at = updated!.updated_at;
  await new Promise(r => setTimeout(r, 50));
  await updated!.update({ email: 'instance@test.com' });
  const after_update = await User.first({ id: u1.id });
  assert('update de instancia cambia valor', after_update?.email === 'instance@test.com');

  // save (nuevo)
  const u3 = new User({ name: 'SaveTest' });
  await u3.save();
  assert('save crea registro nuevo', (u3 as any).__isPersisted === true);
  const saved = await User.first({ id: u3.id });
  assert('save persiste en DB', saved?.name === 'SaveTest');

  // save (existente)
  (u3 as any).email = 'saved@test.com';
  await u3.save();
  const re_saved = await User.first({ id: u3.id });
  assert('save actualiza existente', re_saved?.email === 'saved@test.com');

  // delete por PK
  const u4 = await User.create({ name: 'ToDelete' });
  await User.delete({ id: u4.id });
  const deleted = await User.first({ id: u4.id });
  assert('delete por PK elimina', deleted === undefined);

  // -- Increment / Decrement --
  console.log('\n-- Increment / Decrement --');

  await User.increment('score', 10, { id: u1.id });
  const inc = await User.first({ id: u1.id });
  assert('increment estatico +10', inc?.score === 10);

  await User.decrement('score', 3, { id: u1.id });
  const dec = await User.first({ id: u1.id });
  assert('decrement estatico -3', dec?.score === 7);

  const inst = (await User.first({ id: u1.id }))!;
  await inst.increment('score', 5);
  assert('increment instancia +5 (memoria)', inst.score === 12);
  const db_check = await User.first({ id: u1.id });
  assert('increment instancia +5 (DB)', db_check?.score === 12);

  // -- Soft delete --
  console.log('\n-- Soft Delete --');

  const u5 = await User.create({ name: 'SoftDel' });
  await u5.destroy();
  const soft = await User.where({ id: u5.id });
  assert('destroy excluye de where', soft.length === 0);

  const with_trashed = await User.where({ id: u5.id }, { _includeTrashed: true });
  assert('_includeTrashed lo incluye', with_trashed.length === 1);

  await u5.forceDestroy();
  const force = await User.where({ id: u5.id }, { _includeTrashed: true });
  assert('forceDestroy elimina definitivamente', force.length === 0);

  // -- Relaciones --
  console.log('\n-- Relaciones --');

  const t1 = await Task.create({ title: 'Task 1', user_id: u1.id });
  const t2 = await Task.create({ title: 'Task 2', user_id: u1.id });

  const with_tasks = await User.where({ id: u1.id }, { include: { tasks: true } });
  assert('HasMany carga relacion', with_tasks[0]?.tasks?.length === 2);

  const with_user = await Task.where({ id: t1.id }, { include: { user: true } });
  assert('BelongsTo carga relacion', with_user[0]?.user?.id === u1.id);

  // -- Transacciones --
  console.log('\n-- Transacciones --');

  let tx_user: User | undefined;
  await dynamite.tx(async (tx) => {
    tx_user = await User.create({ name: 'TxUser', email: 'tx@test.com' }, tx);
    assert('tx: instancia tiene id antes del commit', typeof tx_user!.id === 'string');
    assert('tx: __isPersisted es false antes del commit', (tx_user as any).__isPersisted === false);
  });
  assert('tx: __isPersisted es true despues del commit', (tx_user as any).__isPersisted === true);
  const tx_found = await User.first({ id: tx_user!.id });
  assert('tx: registro existe en DB', tx_found?.name === 'TxUser');

  // tx fallida
  let tx_failed_user: User | undefined;
  try {
    await dynamite.tx(async (tx) => {
      tx_failed_user = await User.create({ name: 'TxFail' }, tx);
      throw new Error('Rollback');
    });
  } catch {}
  assert('tx fallida: __isPersisted sigue false', (tx_failed_user as any).__isPersisted === false);

  // -- Validacion de campos en where --
  console.log('\n-- Validacion --');

  let unknown_threw = false;
  try { await User.where({ nonexistent: 'value' } as any); } catch { unknown_threw = true; }
  assert('where lanza en campo inexistente', unknown_threw);

  // -- Resumen --
  console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===\n`);
  return failed;
}
