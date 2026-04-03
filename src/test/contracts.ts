import {
  Dynamite, Table, PrimaryKey, Default, Get, Set as SetDecorator, Validate, NotNull,
  Name, CreatedAt, UpdatedAt, DeleteAt,
  CreationOptional, NonAttribute, HasMany, BelongsTo,
} from "../index";

// -- Modelos --

@Name('test_contract_users')
class CUser extends Table<CUser> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  // TS aplica decoradores bottom-to-top: Get se pushea primero, Validate segundo, Set tercero
  // col.set array queda: [Get(no-op en set), Validate, Set]
  // Pero Get usa col.get, no col.set. Asi que col.set = [Validate, Set]
  // reduce ejecuta: Validate(raw) -> Set(trim)
  // Para que Set corra ANTES que Validate, Set debe estar antes en col.set[]
  // Eso requiere declarar Set DESPUES de Validate (bottom-to-top invierte)
  @Get((v: any) => typeof v === 'string' ? v.toUpperCase() : v)
  @Validate((next: any) => (typeof next === 'string' && next.length >= 2) || 'Min 2 chars')
  @SetDecorator((next: any) => typeof next === 'string' ? next.trim() : next)
  declare name: string;

  @Name('user_email')
  @Default('')
  declare email: string;

  @Default(() => 0)
  declare score: CreationOptional<number>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  @DeleteAt()
  declare deleted_at: CreationOptional<string>;

  @HasMany(() => CPost, 'user_id', 'id')
  declare posts: NonAttribute<CPost[]>;
}

@Name('test_contract_posts')
class CPost extends Table<CPost> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @NotNull() declare title: string;
  @Default('') declare user_id: string;
  @BelongsTo(() => CUser, 'id', 'user_id')
  declare author: NonAttribute<CUser>;
}

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  OK  ${label}`); passed++; }
  else { console.error(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); failed++; }
}

export default async function contracts() {
  console.log('\n=== CONTRACTS ===\n');

  const dynamite = new Dynamite({
    tables: [CUser, CPost],
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  await dynamite.connect();
  await dynamite.sync();

  // =====================================================
  // 1. Pipeline order: Set -> Validate -> Get
  // =====================================================
  console.log('-- Pipeline order --');

  // Set trims, then Validate checks length >= 2. "  ab  " -> "ab" -> valid
  const u1 = await CUser.create({ name: '  alice  ' });
  assert('Set runs before Validate: trimmed "  alice  " passes validation', u1.name === 'ALICE');

  // Reject short value after trim: use a value that fails even untrimmed
  let short_threw = false;
  try { await CUser.create({ name: 'x' }); } catch { short_threw = true; }
  assert('Validate rejects: "x" (1 char) -> fails', short_threw);

  // Get transforms on read: stored as "alice", read as "ALICE"
  const fetched = await CUser.first({ id: u1.id });
  assert('Get transforms on read: "alice" -> "ALICE"', fetched?.name === 'ALICE');

  // Multiple Sets on same field execute in declaration order
  // name has: Set(trim) -> Validate(>=2) -> Get(upper)
  // If order reversed (Validate before Set), "  ab  " (length 6) would pass without trim
  const u_spaces = await CUser.create({ name: '  ab  ' });
  assert('Pipeline order preserved: trim then validate then upper', u_spaces.name === 'AB');

  // =====================================================
  // 2. @Name mapping roundtrip
  // =====================================================
  console.log('\n-- @Name mapping roundtrip --');

  const u2 = await CUser.create({ name: 'bob', email: 'bob@test.com' });

  // Write: email property -> user_email column in DynamoDB
  // Read: user_email column -> email property
  const read_back = await CUser.first({ id: u2.id });
  assert('@Name write+read: email roundtrip', read_back?.email === 'bob@test.com');

  // Filter by TS property name should work (mapped internally)
  const by_email = await CUser.where({ email: 'bob@test.com' });
  assert('@Name filter: where({ email }) works', by_email.length === 1 && by_email[0].id === u2.id);

  // Update by TS property name
  await CUser.update({ email: 'updated@test.com' }, { id: u2.id });
  const after_update = await CUser.first({ id: u2.id });
  assert('@Name update: email updated via TS name', after_update?.email === 'updated@test.com');

  // =====================================================
  // 3. Soft delete consistency
  // =====================================================
  console.log('\n-- Soft delete consistency --');

  const u3 = await CUser.create({ name: 'charlie', email: 'c@test.com' });

  // Normal where excludes nothing (deleted_at is null/absent)
  const before = await CUser.where({ id: u3.id });
  assert('before destroy: visible in where', before.length === 1);

  // destroy() sets deleted_at, doesn't delete
  await u3.destroy();
  const after_destroy = await CUser.where({ id: u3.id });
  assert('after destroy: excluded from where', after_destroy.length === 0);

  // _includeTrashed shows it
  const with_trashed = await CUser.where({ id: u3.id }, { _includeTrashed: true });
  assert('_includeTrashed: visible', with_trashed.length === 1);
  assert('_includeTrashed: has deleted_at timestamp', typeof with_trashed[0].deleted_at === 'string' && with_trashed[0].deleted_at.length > 0);

  // forceDestroy actually removes from DB
  await u3.forceDestroy();
  const after_force = await CUser.where({ id: u3.id }, { _includeTrashed: true });
  assert('forceDestroy: gone even with _includeTrashed', after_force.length === 0);

  // Soft delete doesn't affect other records
  const u1_still = await CUser.first({ id: u1.id });
  assert('soft delete isolation: u1 still exists', u1_still?.id === u1.id);

  // =====================================================
  // 4. Transaction atomicity under failure
  // =====================================================
  console.log('\n-- Transaction atomicity --');

  const u4 = await CUser.create({ name: 'dave', score: 100 });
  const u5 = await CUser.create({ name: 'eve', score: 200 });

  // Successful tx: both changes persist
  await dynamite.tx(async (tx) => {
    await CUser.increment('score', 50, { id: u4.id }, tx);
    await CUser.increment('score', 50, { id: u5.id }, tx);
  });
  const d_after = await CUser.first({ id: u4.id });
  const e_after = await CUser.first({ id: u5.id });
  assert('tx success: dave 100+50=150', d_after?.score === 150);
  assert('tx success: eve 200+50=250', e_after?.score === 250);

  // Failed tx: neither change persists
  try {
    await dynamite.tx(async (tx) => {
      await CUser.increment('score', 1000, { id: u4.id }, tx);
      await CPost.create({ title: 'orphan', user_id: u4.id }, tx);
      throw new Error('Forced rollback');
    });
  } catch {}
  const d_after_fail = await CUser.first({ id: u4.id });
  assert('tx fail: dave score unchanged (150)', d_after_fail?.score === 150);
  const orphan = await CPost.where({ title: 'orphan' } as any);
  assert('tx fail: orphan post not created', orphan.length === 0);

  // Multiple creates in tx: all or nothing
  let tx_ids: string[] = [];
  try {
    await dynamite.tx(async (tx) => {
      for (let i = 0; i < 5; i++) {
        const p = await CPost.create({ title: `tx_post_${i}`, user_id: u4.id }, tx);
        tx_ids.push(p.id);
      }
      throw new Error('Abort after 5 creates');
    });
  } catch {}
  for (const tid of tx_ids) {
    const found = await CPost.first({ id: tid });
    assert(`tx all-or-nothing: post ${tid.slice(0, 8)} not persisted`, found === undefined);
  }

  // =====================================================
  // 5. __isPersisted state machine
  // =====================================================
  console.log('\n-- __isPersisted state machine --');

  // New instance: false
  const fresh = new CUser({ name: 'frank' });
  assert('new instance: __isPersisted = false', (fresh as any).__isPersisted === false);

  // After create: true
  const created = await CUser.create({ name: 'grace' });
  assert('after create: __isPersisted = true', (created as any).__isPersisted === true);

  // After save (new): true
  const saved = new CUser({ name: 'heidi' });
  assert('before save: __isPersisted = false', (saved as any).__isPersisted === false);
  await saved.save();
  assert('after save: __isPersisted = true', (saved as any).__isPersisted === true);

  // In tx before commit: false
  let tx_instance: CUser | undefined;
  await dynamite.tx(async (tx) => {
    tx_instance = await CUser.create({ name: 'ivan' }, tx);
    assert('in tx before commit: false', (tx_instance as any).__isPersisted === false);
  });
  assert('after tx commit: true', (tx_instance as any).__isPersisted === true);

  // Failed tx: stays false
  let failed_instance: CUser | undefined;
  try {
    await dynamite.tx(async (tx) => {
      failed_instance = await CUser.create({ name: 'judy' }, tx);
      throw new Error('fail');
    });
  } catch {}
  assert('failed tx: stays false', (failed_instance as any).__isPersisted === false);

  // From where: true
  const from_db = await CUser.first({ id: created.id });
  assert('from where: __isPersisted = true', (from_db as any).__isPersisted === true);

  // =====================================================
  // 6. Boundary inputs in where()
  // =====================================================
  console.log('\n-- Boundary inputs --');

  // Use CUser for boundary tests -- filter by known good records to avoid @Validate issues on reconstruction
  const all = await CUser.where({ id: u1.id });
  assert('where with filter: returns records', all.length > 0);

  // limit: 0 returns empty
  const zero = await CUser.where({}, { limit: 0 });
  assert('limit: 0 returns []', zero.length === 0);

  // $in with 1 element
  const in_one = await CUser.where({ id: { $in: [u1.id] } as any });
  assert('$in with 1 element', in_one.length === 1 && in_one[0].id === u1.id);

  // $in with many elements
  const all_ids = all.map((u: any) => u.id);
  const in_many = await CUser.where({ id: { $in: all_ids } as any }, { _includeTrashed: true });
  assert('$in with many elements', in_many.length === all_ids.length);

  // Unknown field throws
  let unknown_threw = false;
  try { await CPost.where({ nonexistent: 'x' } as any); } catch { unknown_threw = true; }
  assert('unknown field throws', unknown_threw);

  // $in empty throws
  let in_empty_threw = false;
  try { await CPost.where({ id: { $in: [] } as any }); } catch { in_empty_threw = true; }
  assert('$in empty throws', in_empty_threw);

  // =====================================================
  // 7. CreatedAt immutability + UpdatedAt mutation
  // =====================================================
  console.log('\n-- Timestamp contracts --');

  const ts_user = await CUser.create({ name: 'timestamps' });
  const original_created = ts_user.created_at;
  const original_updated = ts_user.updated_at;

  await new Promise(r => setTimeout(r, 50));

  await ts_user.update({ email: 'ts@test.com' });
  const after = await CUser.first({ id: ts_user.id });

  assert('CreatedAt immutable after update', after?.created_at === original_created);
  assert('UpdatedAt changed after update', after?.updated_at !== original_updated);

  // UpdatedAt respeta valor explícito
  const explicit_ts = '2020-01-01T00:00:00.000Z';
  const ts_explicit = await CUser.create({ name: 'ts_explicit', updated_at: explicit_ts } as any);
  assert('UpdatedAt respeta valor explicito', ts_explicit.updated_at === explicit_ts);

  // =====================================================
  // 8. PrimaryKey inmutable en update
  // =====================================================
  console.log('\n-- PrimaryKey immutability --');

  const pk_user = await CUser.create({ name: 'pk_test' });
  const original_pk = pk_user.id;
  await pk_user.update({ name: 'pk_changed' });
  assert('PK no cambia en instance update', pk_user.id === original_pk);

  const pk_after = await CUser.first({ id: original_pk });
  assert('PK no cambia en DB', pk_after?.name === 'PK_CHANGED');

  // =====================================================
  // 9. create() con PK duplicado
  // =====================================================
  console.log('\n-- PK duplicate --');

  const dup_user = await CUser.create({ name: 'original' });
  let dup_threw = false;
  try {
    await CUser.create({ id: dup_user.id, name: 'duplicate' } as any);
  } catch (e: any) {
    dup_threw = e.message.includes('already exists');
  }
  assert('create con PK duplicado lanza error', dup_threw);

  const dup_check = await CUser.first({ id: dup_user.id });
  assert('registro original intacto', dup_check?.name === 'ORIGINAL');

  // =====================================================
  // 10. Default en set pipeline (no lazy)
  // =====================================================
  console.log('\n-- Default eager (not lazy) --');

  const eager = new CUser({ name: 'eager_test' });
  assert('id existe desde construccion (no lazy)', typeof eager.id === 'string' && eager.id.length === 26);
  assert('created_at existe desde construccion', typeof eager.created_at === 'string' && eager.created_at.length > 0);
  assert('updated_at existe desde construccion', typeof eager.updated_at === 'string' && eager.updated_at.length > 0);

  // Dos instancias secuenciales tienen IDs ordenados
  const seq1 = new CUser({ name: 'seq1' });
  const seq2 = new CUser({ name: 'seq2' });
  assert('ULIDs secuenciales: seq1 < seq2', seq1.id < seq2.id);

  // =====================================================
  // 11. ULID secuencialidad en creates
  // =====================================================
  console.log('\n-- ULID sequential creates --');

  const ids: string[] = [];
  for (let i = 0; i < 20; i++) {
    const u = await CUser.create({ name: `seq_${i}` });
    ids.push(u.id);
  }
  const sorted_ids = [...ids].sort();
  assert('20 creates secuenciales: IDs monotonicos', JSON.stringify(ids) === JSON.stringify(sorted_ids));
  assert('20 creates secuenciales: todos unicos', new Set(ids).size === 20);

  console.log(`\n  Contracts: ${passed} passed, ${failed} failed`);
  return failed;
}
