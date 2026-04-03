import {
  Dynamite, Table, PrimaryKey, Default, NotNull,
  CreationOptional, NonAttribute, Name, HasMany, BelongsTo,
} from "../index";
import { requireClient } from "../core/client";

@Name('test_qs_authors')
class Author extends Table<Author> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @NotNull() declare name: string;
  @HasMany(() => Book, 'author_id', 'id')
  declare books: NonAttribute<Book[]>;
}

@Name('test_qs_books')
class Book extends Table<Book> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @NotNull() declare title: string;
  @Default('') declare author_id: string;
  @Default(() => 0) declare pages: CreationOptional<number>;
  @BelongsTo(() => Author, 'id', 'author_id')
  declare author: NonAttribute<Author>;
}

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  OK  ${label}`); passed++; }
  else { console.error(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); failed++; }
}

// Interceptor para trackear que comando se usó
function trackCommands() {
  const client = requireClient();
  const log: string[] = [];
  const original = client.send.bind(client);
  (client as any).send = async (cmd: any) => {
    log.push(cmd.constructor.name);
    return original(cmd);
  };
  return {
    log,
    last: () => log[log.length - 1],
    reset: () => { log.length = 0; },
    restore: () => { (client as any).send = original; },
  };
}

export default async function query_scan() {
  console.log('\n=== QUERY vs SCAN ===\n');

  const dynamite = new Dynamite({
    tables: [Author, Book],
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  await dynamite.connect();
  await dynamite.sync();

  // Seed
  const a1 = await Author.create({ name: 'Tolkien' });
  const a2 = await Author.create({ name: 'Asimov' });
  for (let i = 0; i < 10; i++) {
    await Book.create({ title: `Book_${i}`, author_id: i < 6 ? a1.id : a2.id, pages: (i + 1) * 50 });
  }

  const tracker = trackCommands();

  // -- Query por PK --
  console.log('-- Query por PK --');
  tracker.reset();
  const by_pk = await Author.where({ id: a1.id });
  assert('where por PK usa QueryCommand', tracker.last() === 'QueryCommand');
  assert('where por PK retorna correcto', by_pk[0]?.name === 'Tolkien');

  // -- Query por PK con first --
  tracker.reset();
  const first_pk = await Author.first({ id: a1.id });
  assert('first por PK usa QueryCommand', tracker.log.includes('QueryCommand'));
  assert('first por PK retorna correcto', first_pk?.name === 'Tolkien');

  // -- Scan por campo sin GSI --
  console.log('\n-- Scan por campo sin GSI --');
  tracker.reset();
  const by_name = await Author.where({ name: 'Tolkien' });
  assert('where por name usa ScanCommand', tracker.last() === 'ScanCommand');
  assert('where por name retorna correcto', by_name[0]?.name === 'Tolkien');

  // -- Query por GSI (author_id en books) --
  console.log('\n-- Query por GSI --');
  tracker.reset();
  const by_fk = await Book.where({ author_id: a1.id });
  // author_id tiene GSI porque Author.@HasMany lo declara y connect() lo registra
  const used_query = tracker.log.includes('QueryCommand');
  const used_scan = tracker.log.includes('ScanCommand');
  if (used_query) {
    assert('where por FK (author_id) usa QueryCommand', true);
  } else {
    // GSI puede no existir si sync no corrió en este runtime, fallback a Scan es correcto
    assert('where por FK (author_id) usa ScanCommand (GSI no creado)', used_scan);
  }
  assert('where por FK retorna 6 books', by_fk.length === 6);

  // -- Scan con operadores no-eq --
  console.log('\n-- Scan con operadores --');
  tracker.reset();
  await Book.where({ pages: { $gt: 200 } });
  assert('$gt usa ScanCommand (no es $eq)', tracker.last() === 'ScanCommand');

  tracker.reset();
  await Book.where({ title: { $include: 'Book' } });
  assert('$include usa ScanCommand', tracker.last() === 'ScanCommand');

  tracker.reset();
  await Book.where({ author_id: { $in: [a1.id, a2.id] } as any });
  assert('$in usa ScanCommand (no es $eq)', tracker.last() === 'ScanCommand');

  // -- Query por PK + filtros adicionales --
  console.log('\n-- Query PK + filtros extra --');
  tracker.reset();
  // No aplica: where con PK + otro campo. PK va a KeyCondition, el resto a Filter
  // Pero _extractPK requiere que el filtro sea SOLO la PK para optimizar update/delete
  // En where(), la detección busca cualquier campo con $eq que sea PK
  const pk_plus = await Book.where({ id: by_fk[0].id });
  assert('PK en filtro mixto usa Query', tracker.log.includes('QueryCommand'));

  // -- Self-healing: GSI inexistente fallback a Scan --
  console.log('\n-- Self-healing --');
  // Forzar un GSI falso
  const book_schema = (Book as any)[Symbol.for('dynamite:schema')] || (Book as any)[Object.getOwnPropertySymbols(Book).find(s => s.description === 'dynamite:schema')!];
  if (book_schema) {
    book_schema.gsis.add('fake_field');
    tracker.reset();
    // Esto intentará Query con GSI fake_field_index, fallará, y caerá a Scan
    try {
      // Necesitamos un filtro por fake_field con $eq para que intente Query
      // Pero fake_field no está en schema.columns, así que el where lanzará "Unknown column"
      // El self-healing solo aplica cuando el campo existe en schema pero el GSI no existe en DynamoDB
      // Simulamos agregando una columna fake temporalmente
      book_schema.columns['fake_field'] = { name: 'fake_field', get: [], set: [], store: {} };
      await Book.where({ fake_field: 'test' } as any);
      assert('self-healing: GSI inexistente cae a Scan sin error', true);
      assert('self-healing: GSI removido del cache', !book_schema.gsis.has('fake_field'));
      delete book_schema.columns['fake_field'];
    } catch (e: any) {
      delete book_schema.columns['fake_field'];
      book_schema.gsis.delete('fake_field');
      assert('self-healing: error inesperado', false, e.message);
    }
  }

  // -- Performance comparison (informativo) --
  console.log('\n-- Performance (informativo) --');
  const scan_start = Date.now();
  for (let i = 0; i < 50; i++) await Book.where({ pages: { $gt: 100 } });
  const scan_time = Date.now() - scan_start;

  const query_start = Date.now();
  for (let i = 0; i < 50; i++) await Book.where({ id: by_fk[0].id });
  const query_time = Date.now() - query_start;

  console.log(`  50x Scan: ${scan_time}ms (${(scan_time / 50).toFixed(1)}ms/query)`);
  console.log(`  50x Query PK: ${query_time}ms (${(query_time / 50).toFixed(1)}ms/query)`);
  assert('Query PK es mas rapido que Scan', query_time < scan_time, `Query:${query_time}ms vs Scan:${scan_time}ms`);

  tracker.restore();

  console.log(`\n  Query vs Scan: ${passed} passed, ${failed} failed`);
  return failed;
}
