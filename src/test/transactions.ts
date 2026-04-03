import {
  Dynamite, Table, PrimaryKey, Default, NotNull, CreatedAt,
  CreationOptional, Name,
} from "../index";
import { TransactionContext } from "../core/client";

@Name('test_tx_accounts')
class Account extends Table<Account> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @NotNull() declare name: string;
  @Default(() => 0) declare balance: CreationOptional<number>;
  @CreatedAt() declare created_at: CreationOptional<string>;
}

@Name('test_tx_logs')
class TxLog extends Table<TxLog> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @Default('') declare account_id: string;
  @Default('') declare action: string;
  @Default(() => 0) declare amount: CreationOptional<number>;
}

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  OK  ${label}`); passed++; }
  else { console.error(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); failed++; }
}

export default async function transactions() {
  console.log('\n=== TRANSACTIONS ===\n');

  const dynamite = new Dynamite({
    tables: [Account, TxLog],
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  await dynamite.connect();
  await dynamite.sync();

  // -- Multi-create en tx --
  console.log('-- Multi-create --');
  let a1: Account | undefined, a2: Account | undefined;
  await dynamite.tx(async (tx) => {
    a1 = await Account.create({ name: 'Alice', balance: 1000 }, tx);
    a2 = await Account.create({ name: 'Bob', balance: 500 }, tx);
  });
  assert('tx multi-create: ambos persistidos', (a1 as any).__isPersisted && (a2 as any).__isPersisted);
  const alice = await Account.first({ id: a1!.id });
  const bob = await Account.first({ id: a2!.id });
  assert('tx multi-create: Alice en DB', alice?.name === 'Alice' && alice?.balance === 1000);
  assert('tx multi-create: Bob en DB', bob?.name === 'Bob' && bob?.balance === 500);

  // -- Create + increment en tx --
  console.log('\n-- Create + increment --');
  let log1: TxLog | undefined;
  await dynamite.tx(async (tx) => {
    log1 = await TxLog.create({ account_id: a1!.id, action: 'deposit', amount: 200 }, tx);
    await Account.increment('balance', 200, { id: a1!.id }, tx);
  });
  const alice_after = await Account.first({ id: a1!.id });
  assert('tx increment: balance +200', alice_after?.balance === 1200);
  assert('tx increment: log creado', (log1 as any).__isPersisted === true);
  const log_check = await TxLog.first({ id: log1!.id });
  assert('tx increment: log en DB', log_check?.action === 'deposit');

  // -- Transferencia atomica (decrement + increment + log) --
  console.log('\n-- Transferencia atomica --');
  await dynamite.tx(async (tx) => {
    await Account.decrement('balance', 300, { id: a1!.id }, tx);
    await Account.increment('balance', 300, { id: a2!.id }, tx);
    await TxLog.create({ account_id: a1!.id, action: 'transfer_out', amount: 300 }, tx);
    await TxLog.create({ account_id: a2!.id, action: 'transfer_in', amount: 300 }, tx);
  });
  const alice_transfer = await Account.first({ id: a1!.id });
  const bob_transfer = await Account.first({ id: a2!.id });
  assert('transferencia: Alice 1200-300=900', alice_transfer?.balance === 900);
  assert('transferencia: Bob 500+300=800', bob_transfer?.balance === 800);

  // -- Tx fallida: nada se persiste --
  console.log('\n-- Tx fallida --');
  const alice_before_fail = alice_transfer!.balance;
  let failed_account: Account | undefined;
  try {
    await dynamite.tx(async (tx) => {
      failed_account = await Account.create({ name: 'Ghost' }, tx);
      await Account.increment('balance', 99999, { id: a1!.id }, tx);
      throw new Error('Simulated failure');
    });
  } catch {}
  assert('tx fallida: instancia no persistida', (failed_account as any).__isPersisted === false);
  const alice_after_fail = await Account.first({ id: a1!.id });
  assert('tx fallida: balance intacto', alice_after_fail?.balance === alice_before_fail);
  const ghost = await Account.where({ name: 'Ghost' });
  assert('tx fallida: Ghost no existe', ghost.length === 0);

  // -- Tx con multiples operaciones (>25, auto-chunk) --
  console.log('\n-- Auto-chunk (30 creates) --');
  const ids: string[] = [];
  await dynamite.tx(async (tx) => {
    for (let i = 0; i < 30; i++) {
      const acc = await Account.create({ name: `Bulk_${i}`, balance: i }, tx);
      ids.push(acc.id);
    }
  });
  const bulk_check = await Account.where({ name: { $include: 'Bulk_' } });
  assert('auto-chunk: 30 registros creados', bulk_check.length === 30);

  console.log(`\n  Transactions: ${passed} passed, ${failed} failed`);
  return failed;
}
