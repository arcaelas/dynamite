import {
  Dynamite, Table, PrimaryKey, Default, NotNull, Index, CreatedAt, UpdatedAt,
  Set as SetDecorator, CreationOptional, NonAttribute, Name, ManyToMany,
} from "../index";
import { requireClient } from "../core/client";

@Name('test_cost_notes')
class Note extends Table<Note> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @NotNull() declare title: string;
  @Index() @Default('') declare bucket: CreationOptional<string>;
  @Default(() => 0) declare weight: CreationOptional<number>;
  @CreatedAt() declare created_at: CreationOptional<string>;
  @UpdatedAt() declare updated_at: CreationOptional<string>;
  @ManyToMany(() => Label, 'test_cost_note_labels', 'note_id', 'label_id')
  declare labels: NonAttribute<Label[]>;
}

@Name('test_cost_versioned')
class Versioned extends Table<Versioned> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @NotNull() declare title: string;
  // El segundo argumento obliga a leer el registro antes de actualizarlo
  @SetDecorator((next: any, current: any) => next ?? current ?? '')
  @Default('') declare trail: CreationOptional<string>;
}

@Name('test_cost_labels')
class Label extends Table<Label> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @NotNull() declare name: string;
  @ManyToMany(() => Note, 'test_cost_note_labels', 'label_id', 'note_id')
  declare notes: NonAttribute<Note[]>;
}

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  OK  ${label}`); passed++; }
  else { console.error(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); failed++; }
}

/**
 * @description Counts the commands the library sends: every request is a line on the DynamoDB bill.
 * @description Cuenta los comandos que emite la librería: cada petición es una línea de la factura.
 */
function tracker() {
  const client = requireClient();
  const sent: Array<{ name: string; input: any }> = [];
  const original = client.send.bind(client);
  (client as any).send = async (command: any) => {
    sent.push({ name: command.constructor.name, input: command.input });
    return original(command);
  };
  return {
    sent,
    reset: () => { sent.length = 0; },
    count: (name: string) => sent.filter(entry => entry.name === name).length,
    names: () => sent.map(entry => entry.name).join(','),
    restore: () => { (client as any).send = original; },
  };
}

export default async function costs() {
  console.log('\n=== COSTS ===\n');

  const dynamite = new Dynamite({
    tables: [Note, Label, Versioned],
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  await dynamite.connect();
  await dynamite.sync();

  const seeded = await Note.createMany(
    Array.from({ length: 60 }, (_unused, i) => ({
      title: `note_${String(i).padStart(3, '0')}`,
      bucket: i < 30 ? 'alpha' : 'beta',
      weight: i,
    }))
  );

  const probe = tracker();

  // -- Lectura por clave --
  console.log('-- Lectura por clave --');

  probe.reset();
  const one = await Note.first({ id: seeded[0].id });
  assert('first por PK: un GetItem y nada más', probe.count('GetItemCommand') === 1 && probe.sent.length === 1, probe.names());
  assert('first por PK: devuelve el registro', one?.id === seeded[0].id);

  probe.reset();
  const many_ids = seeded.slice(0, 40).map(note => note.id);
  const batch = await Note.where({ id: { $in: many_ids } as any });
  assert('$in por PK: un BatchGetItem para 40 claves', probe.count('BatchGetItemCommand') === 1 && probe.sent.length === 1, probe.names());
  assert('$in por PK: devuelve los 40', batch.length === 40);

  probe.reset();
  const filtered_key = await Note.where({ id: seeded[1].id, bucket: 'beta' } as any);
  assert('PK con filtro extra: sigue siendo un GetItem', probe.sent.length === 1 && probe.count('GetItemCommand') === 1, probe.names());
  assert('PK con filtro extra: el filtro se respeta', filtered_key.length === 0);

  // -- Lectura por índice --
  console.log('\n-- Lectura por índice --');

  probe.reset();
  const by_index = await Note.where({ bucket: 'alpha' });
  assert('@Index: Query sobre bucket_index', probe.count('QueryCommand') === 1 && probe.count('ScanCommand') === 0, probe.names());
  assert('@Index: devuelve 30', by_index.length === 30);

  // -- Límite y cursor --
  console.log('\n-- Límite y cursor --');

  probe.reset();
  const page = await Note.where({}, { limit: 5 });
  assert('limit sin filtro: Limit viaja al servidor', probe.sent[0]?.input?.Limit === 5, JSON.stringify(probe.sent[0]?.input?.Limit));
  assert('limit sin filtro: devuelve 5', page.length === 5);
  assert('limit sin filtro: entrega cursor', !!page.cursor);

  probe.reset();
  const next_page = await Note.where({}, { limit: 5, cursor: page.cursor });
  assert('cursor: la página siguiente no repite', next_page.every(note => !page.some(seen => seen.id === note.id)));
  assert('cursor: una sola petición', probe.sent.length === 1, probe.names());

  probe.reset();
  const cheap_first = await Note.first({ bucket: 'alpha' });
  assert('first por índice: una sola Query con Limit 1', probe.sent.length === 1 && probe.sent[0]?.input?.Limit === 1, probe.names());
  assert('first por índice: devuelve un registro', cheap_first?.bucket === 'alpha');

  // -- Scan paralelo --
  console.log('\n-- Scan paralelo --');

  probe.reset();
  const everything = await Note.where({});
  assert('sin límite: el Scan se parte en 4 segmentos', probe.count('ScanCommand') === 4, probe.names());
  assert('sin límite: los segmentos no pierden registros', everything.length === 60);

  // -- Escritura --
  console.log('\n-- Escritura --');

  probe.reset();
  const affected = await Note.update({ weight: 999 }, { id: seeded[2].id });
  assert('update por PK: un UpdateItem, sin lectura previa', probe.sent.length === 1 && probe.count('UpdateItemCommand') === 1, probe.names());
  assert('update por PK: afecta 1', affected === 1);
  const updated = await Note.first({ id: seeded[2].id });
  assert('update por PK: persistido', updated?.weight === 999);
  assert('update por PK: renueva updated_at', updated!.updated_at !== seeded[2].updated_at);

  probe.reset();
  const missing = await Note.update({ weight: 1 }, { id: 'no_existe' } as any);
  assert('update de un registro ausente: devuelve 0', missing === 0);

  probe.reset();
  const instance = (await Note.first({ id: seeded[3].id }))!;
  probe.reset();
  await instance.update({ title: 'renombrado' });
  assert('update de instancia: un UpdateItem', probe.sent.length === 1 && probe.count('UpdateItemCommand') === 1, probe.names());
  const renamed = await Note.first({ id: seeded[3].id });
  assert('update de instancia: persistido', renamed?.title === 'renombrado');
  assert('update de instancia: memoria y base coinciden', renamed?.updated_at === instance.updated_at);

  probe.reset();
  const versioned = await Versioned.create({ title: 'con historial' });
  probe.reset();
  await Versioned.update({ trail: 'b' }, { id: versioned.id });
  assert('update con @Set que usa current: lee antes de escribir', probe.count('GetItemCommand') === 1 && probe.count('PutItemCommand') === 1, probe.names());

  probe.reset();
  const bulk = await Note.createMany(
    Array.from({ length: 60 }, (_unused, i) => ({ title: `bulk_${i}`, bucket: 'gamma' }))
  );
  assert('createMany: 60 registros en 3 lotes', probe.count('BatchWriteItemCommand') === 3 && probe.sent.length === 3, probe.names());
  assert('createMany: devuelve las instancias persistidas', bulk.length === 60 && (bulk[0] as any).__isPersisted === true);
  const gamma = await Note.where({ bucket: 'gamma' });
  assert('createMany: los 60 están en la tabla', gamma.length === 60);

  probe.reset();
  const removed = await Note.deleteMany(bulk.map(note => note.id));
  assert('deleteMany: 60 bajas en 3 lotes', probe.count('BatchWriteItemCommand') === 3 && probe.sent.length === 3, probe.names());
  assert('deleteMany: informa 60', removed === 60);
  assert('deleteMany: la tabla quedó limpia', (await Note.where({ bucket: 'gamma' })).length === 0);

  probe.reset();
  const deleted = await Note.delete({ bucket: 'beta' } as any);
  assert('delete masivo: una Query y dos lotes de escritura', probe.count('QueryCommand') === 1 && probe.count('BatchWriteItemCommand') === 2 && probe.count('DeleteItemCommand') === 0, probe.names());
  assert('delete masivo: informa 30', deleted === 30);

  // -- Pivote de ManyToMany --
  console.log('\n-- Pivote --');

  const label_a = await Label.create({ name: 'urgente' });
  const label_b = await Label.create({ name: 'archivado' });
  const note = seeded[0];

  probe.reset();
  await note.attach(Label, label_a.id);
  assert('attach: sin Scan sobre el pivote', probe.count('ScanCommand') === 0 && probe.count('QueryCommand') === 1, probe.names());

  probe.reset();
  await note.attach(Label, label_a.id);
  assert('attach repetido: no duplica ni escribe', probe.count('PutItemCommand') === 0, probe.names());

  probe.reset();
  const with_labels = await Note.where({ id: note.id }, { include: { labels: true } });
  assert('include ManyToMany: sin Scan sobre el pivote', probe.count('ScanCommand') === 0, probe.names());
  assert('include ManyToMany: carga la etiqueta', with_labels[0]?.labels?.length === 1);

  probe.reset();
  await note.sync(Label, [label_b.id]);
  assert('sync: una Query y un lote de escritura', probe.count('ScanCommand') === 0 && probe.count('BatchWriteItemCommand') === 1, probe.names());
  const synced = await Note.where({ id: note.id }, { include: { labels: true } });
  assert('sync: deja solo la etiqueta pedida', synced[0]?.labels?.length === 1 && synced[0]?.labels?.[0]?.name === 'archivado');

  probe.reset();
  await note.detach(Label, label_b.id);
  assert('detach: sin Scan sobre el pivote', probe.count('ScanCommand') === 0, probe.names());
  const detached = await Note.where({ id: note.id }, { include: { labels: true } });
  assert('detach: la relación desapareció', detached[0]?.labels?.length === 0);

  probe.restore();

  console.log(`\n  Costs: ${passed} passed, ${failed} failed`);
  return failed;
}
