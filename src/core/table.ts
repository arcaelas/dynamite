/* src/core/table.ts
 * Dinamite ORM — runtime
 * --------------------------------------------------
 * CRUD + autocreación de tablas (DynamoDB v3)
 * Serialización estricta mediante toJSON()
 * © 2025 Miguel Alejandro
 */
import {
  CreateTableCommand,
  DeleteItemCommand,
  DynamoDBClient,
  DynamoDBClientConfig,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import wrapper, { STORE, WrapperEntry } from "./wrapper";

/* ────────────────────────── Conexión global ────────────────────────── */
let client: DynamoDBClient | undefined;
export function connect(cfg: DynamoDBClientConfig): void {
  client = new DynamoDBClient(cfg);
}

/* ─────────── Creación automática de tablas a partir del wrapper ────── */
async function createTable(ctor: Function): Promise<void> {
  if (!client) throw new Error("connect() no llamado");
  const meta = wrapper.get(ctor);
  if (!meta) throw new Error(`Clase ${ctor.name} no registrada en wrapper`);

  const cols = [...meta.columns.values()];
  const pk = cols.find((c) => c.index);
  if (!pk) throw new Error(`PartitionKey faltante en ${ctor.name}`);

  const sk = cols.find((c) => c.indexSort);

  const attr = new Map<string, "S" | "N" | "B">();
  attr.set(pk.name, "S");
  if (sk) attr.set(sk.name, "S");

  type KS = { AttributeName: string; KeyType: "HASH" | "RANGE" };
  const schema: KS[] = [{ AttributeName: pk.name, KeyType: "HASH" }];
  if (sk && sk.name !== pk.name)
    schema.push({ AttributeName: sk.name, KeyType: "RANGE" });

  await client.send(
    new CreateTableCommand({
      TableName: meta.name,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [...attr].map(([AttributeName, AttributeType]) => ({
        AttributeName,
        AttributeType,
      })),
      KeySchema: schema,
    })
  );
}

/* ────────────────────────────── Table ──────────────────────────────── */
export default class Table<T extends object = object> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  private [STORE]!: { [K in keyof T]?: T[K] };

  constructor(data: Partial<T> = {}) {
    requireClient();
    const meta = mustMeta(Object.getPrototypeOf(this).constructor);

    /* defaults via setters */
    meta.columns.forEach((c) => {
      if (!(c.name in data)) (this as any)[c.name] = undefined;
    });

    Object.assign(this, data);
  }

  /* -------- serializa SOLO columnas válidas -------- */
  toJSON(): Record<string, unknown> {
    const meta = mustMeta(Object.getPrototypeOf(this).constructor);
    const buf = (this as any)[STORE] ?? {};
    const out: Record<string, unknown> = {};

    for (const [prop, col] of meta.columns) {
      if (prop in buf) out[col.name] = buf[prop];
      else if (prop in this) out[col.name] = (this as any)[prop];
    }
    return out;
  }

  /* ────────────── Métodos de instancia ────────────── */
  async save(): Promise<this> {
    // @ts-ignore
    const id: unknown = this.id;
    const Ctor = this.constructor as typeof Table<any>;
    const record = this.toJSON();

    if (id === undefined || id === null) {
      delete (record as any).id;
      const fresh = await (Ctor as any).create(record);
      Object.assign(this, fresh);
    } else {
      await (Ctor as any).update(String(id), record);
    }
    return this;
  }

  async update(patch: Partial<T>): Promise<this> {
    // @ts-ignore
    const id: unknown = this.id;
    if (id === undefined || id === null)
      throw new Error("update() requiere id");

    Object.assign(this, patch);
    const Ctor = this.constructor as typeof Table<any>;
    await (Ctor as any).update(String(id), this.toJSON());
    return this;
  }

  async destroy(): Promise<void> {
    // @ts-ignore
    const id: unknown = this.id;
    if (id === undefined || id === null)
      throw new Error("destroy() requiere id");
    const Ctor = this.constructor as typeof Table<any>;
    await (Ctor as any).destroy(String(id));
  }

  /* ─────────────── CRUD estáticos ──────────────── */

  static async create<M extends Table>(
    this: new (d?: Partial<M>) => M,
    data: Partial<M>
  ): Promise<M> {
    const meta = mustMeta(this);
    const payload = new this(data).toJSON(); // filtrado

    const put = () =>
      client!.send(
        new PutItemCommand({
          TableName: meta.name,
          Item: marshall(payload, { removeUndefinedValues: true }),
        })
      );

    try {
      await put();
    } catch (err: any) {
      if (err?.name === "ResourceNotFoundException") {
        await createTable(this);
        await put();
      } else throw err;
    }
    return new this(data);
  }

  static async update<M extends Table>(
    this: new (d?: Partial<M>) => M,
    id: string,
    record: Partial<M> // ← ya es JSON completo desde instancia
  ): Promise<void> {
    const meta = mustMeta(this);
    const payload = { ...record, id };

    const put = () =>
      client!.send(
        new PutItemCommand({
          TableName: meta.name,
          Item: marshall(payload, { removeUndefinedValues: true }),
        })
      );

    try {
      await put();
    } catch (err: any) {
      if (err?.name === "ResourceNotFoundException") {
        await createTable(this);
        await put();
      } else throw err;
    }
  }

  static async destroy<M extends Table>(
    this: new () => M,
    id: string
  ): Promise<null> {
    requireClient();
    try {
      await client!.send(
        new DeleteItemCommand({
          TableName: mustMeta(this).name,
          Key: marshall({ id }),
        })
      );
    } catch (err: any) {
      if (err.name === "ResourceNotFoundException") return null;
      throw err;
    }
    return null;
  }

  static async where<M extends Table>(this: new (d?: any) => M): Promise<M[]> {
    requireClient();
    try {
      const res = await client!.send(
        new ScanCommand({ TableName: mustMeta(this).name })
      );
      return (res.Items ?? []).map((i) => new this(unmarshall(i)));
    } catch (err: any) {
      if (err.name === "ResourceNotFoundException") return [];
      throw err;
    }
  }
}

/* ─────────────────── Utilidades internas ─────────────────── */
function requireClient(): void {
  if (!client) throw new Error("connect() debe llamarse antes de usar Table");
}
function mustMeta(ctor: Function): WrapperEntry {
  const meta = wrapper.get(ctor);
  if (!meta) throw new Error(`Metadata no encontrada para ${ctor.name}`);
  return meta;
}

/* ─────────────────── Exportaciones internas ───────────────── */
export { STORE };
export type { WrapperEntry };
