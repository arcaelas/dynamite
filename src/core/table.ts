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
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import wrapper, { InferAttributes, STORE, WrapperEntry } from "./wrapper";

/* -------------------------------------------------------------------------- */
/* Utils internos                                                             */
/* -------------------------------------------------------------------------- */
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

  try {
    await client.send(
      new CreateTableCommand({
        TableName: meta.name,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [...attr].map(
          ([AttributeName, AttributeType]) => ({
            AttributeName,
            AttributeType,
          })
        ),
        KeySchema: schema,
      })
    );
  } catch (error: any) {
    // Ignorar error si la tabla ya existe
    if (error.name !== "ResourceInUseException") {
      throw error;
    }
  }
}

function requireClient(): void {
  if (!client) throw new Error("connect() debe llamarse antes de usar Table");
}

function mustMeta(ctor: Function): WrapperEntry {
  const meta = wrapper.get(ctor);
  if (!meta) throw new Error(`Metadata no encontrada para ${ctor.name}`);
  return meta;
}

/* -------------------------------------------------------------------------- */
/* Configuración de cliente DynamoDB                                          */
/* -------------------------------------------------------------------------- */
let client: DynamoDBClient | undefined;
export function connect(cfg: DynamoDBClientConfig): void {
  client = new DynamoDBClient(cfg);
}

/* -------------------------------------------------------------------------- */
/* Clase base Table                                                           */
/* -------------------------------------------------------------------------- */
export default class Table<T extends {} = any> {
  protected [STORE]!: { [K in keyof T]?: T[K] };

  /* ------------------------------ constructor ----------------------------- */
  constructor(data: InferAttributes<T>) {
    requireClient();
    const meta = mustMeta(Object.getPrototypeOf(this).constructor);
    /* crear todas las props declaradas como undefined si no vienen en data */
    meta.columns.forEach((c) => {
      if (!(c.name in data)) (this as any)[c.name] = undefined;
    });
    Object.assign(this, data);
  }

  /* --------------------------------- save -------------------------------- */
  async save(): Promise<this> {
    const id: unknown = this["id"];
    const Ctor = this.constructor as typeof Table<any>;
    const record = this.toJSON();

    if (id === undefined || id === null) {
      delete (record as any).id; // permitir que Dynamo genere el id, si procede
      const fresh = await (Ctor as any).create(record);
      Object.assign(this, fresh);
    } else {
      await (Ctor as any).update(String(id), record);
    }
    return this;
  }

  /* -------------------------------- update ------------------------------- */
  async update(patch: InferAttributes<T>): Promise<this> {
    const id: unknown = this["id"];
    if (id === undefined || id === null)
      throw new Error("update() requiere id");

    Object.assign(this, patch);
    const Ctor = this.constructor as typeof Table<any>;
    await (Ctor as any).update(String(id), this.toJSON());
    return this;
  }

  /* ------------------------------- destroy ------------------------------- */
  async destroy(): Promise<void> {
    const id: unknown = this["id"];
    if (id === undefined || id === null)
      throw new Error("destroy() requiere id");

    const Ctor = this.constructor as typeof Table<any>;
    await (Ctor as any).destroy(String(id));
  }

  /* ------------------------------- static CRUD --------------------------- */
  static async create<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    data: InferAttributes<M>
  ): Promise<M> {
    const meta = mustMeta(this);
    const payload = new this(data).toJSON();

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

  // prettier-ignore
  static async update<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    id: string,
    record: InferAttributes<M>,
  ): Promise<void> {
    const meta    = mustMeta(this);
    const payload = { ...record, id };

    const put = () =>
      client!.send(
        new PutItemCommand({
          TableName: meta.name,
          Item: marshall(payload, { removeUndefinedValues: true }),
        }),
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

  // prettier-ignore
  static async destroy<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    id: string,
  ): Promise<null> {
    requireClient();
    try {
      await client!.send(
        new DeleteItemCommand({
          TableName: mustMeta(this).name,
          Key: marshall({ id }),
        }),
      );
    } catch (err: any) {
      if (err.name === "ResourceNotFoundException") return null;
      throw err;
    }
    return null;
  }

  /**
   * Realiza una consulta sobre la tabla, devolviendo una lista de resultados
   * según condiciones y opciones de paginación/orden. Utiliza `QueryCommand`
   * si la condición es por PK/SK con igualdad, o `ScanCommand` como fallback.
   *
   * @template M Instancia de la clase Table.
   * @template K Clave de atributos inferida.
   *
   * @param key     - Clave a filtrar (ej. "id").
   * @param value   - Valor a comparar (equivalente a '=' implícito).
   * @param options - (Opcional) Opciones de paginación: { limit, skip, order }.
   *
   * @example
   *   await User.where('id', 'u1');
   *   await User.where('email', '=', 'a@b.com', { limit: 5, order: 'DESC' });
   *   await User.where({ email: 'x@y.com' }, { skip: 10, limit: 1 });
   *
   * @param filters - Objeto con pares clave/valor para consulta tipo AND.
   * @param options - (Opcional) Opciones de paginación: { limit, skip, order }.
   *
   * @returns       - Array de instancias de la tabla que cumplen la condición.
   */
  static async where<M extends Table, K extends keyof InferAttributes<M>>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    key: K,
    value: InferAttributes<M>[K],
    options?: { limit?: number; skip?: number; order?: "ASC" | "DESC" }
  ): Promise<M[]>;
  static async where<M extends Table, K extends keyof InferAttributes<M>>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    key: K,
    op: "=" | "!=" | "<" | "<=" | ">" | ">=",
    value: InferAttributes<M>[K],
    options?: { limit?: number; skip?: number; order?: "ASC" | "DESC" }
  ): Promise<M[]>;
  static async where<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    filters: Partial<InferAttributes<M>>,
    options?: { limit?: number; skip?: number; order?: "ASC" | "DESC" }
  ): Promise<M[]>;
  static async where<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    ...args: any[]
  ): Promise<M[]> {
    requireClient();
    const meta = mustMeta(this);

    type Entry = { key: string; op: string; value: unknown };
    const conditions: Entry[] = [];

    // Detección y extracción de opciones
    const last = args.at(-1);
    const hasOptions =
      typeof last === "object" &&
      last !== null &&
      ("limit" in last || "skip" in last || "order" in last);
    const options = hasOptions ? args.pop() : {};

    // Validar opciones
    if (options.limit !== undefined && options.limit < 0) {
      throw new Error("Argumentos inválidos");
    }
    if (options.skip !== undefined && options.skip < 0) {
      throw new Error("Argumentos inválidos");
    }
    if (
      options.order !== undefined &&
      !["ASC", "DESC"].includes(options.order)
    ) {
      throw new Error("Argumentos inválidos");
    }

    const limit = options.limit ?? 100;
    const skip = options.skip ?? 0;
    const order = (options.order ?? "ASC") as "ASC" | "DESC";

    // Parseo de condiciones según variante
    if (
      args.length === 1 &&
      typeof args[0] === "object" &&
      !Array.isArray(args[0])
    ) {
      for (const [key, value] of Object.entries(args[0])) {
        // Validar que el campo existe en el modelo
        if (!meta.columns.has(key)) {
          return [];
        }
        conditions.push({ key, op: "=", value });
      }
    } else if (args.length === 2) {
      const [key, value] = args;
      // Validar que el campo existe en el modelo
      if (!meta.columns.has(key)) {
        return [];
      }
      conditions.push({ key, op: "=", value });
    } else if (args.length === 3) {
      const [key, op, value] = args;
      // Validar operador
      const validOps = ["=", "!=", "<", "<=", ">", ">="];
      if (!validOps.includes(op)) {
        throw new Error("Argumentos inválidos");
      }
      // Validar que el campo existe en el modelo
      if (!meta.columns.has(key)) {
        return [];
      }
      conditions.push({ key, op, value });
    } else {
      throw new Error("Argumentos inválidos");
    }

    // Query optimizado si es por PK/SK e igualdad
    const column = meta.columns.get(conditions[0].key);
    const isIndex = column?.index || column?.indexSort;

    if (conditions.length === 1 && isIndex && conditions[0].op === "=") {
      const { key, value } = conditions[0];
      const res = await client!.send(
        new QueryCommand({
          TableName: meta.name,
          KeyConditionExpression: `#K = :v`,
          ExpressionAttributeNames: { "#K": key },
          ExpressionAttributeValues: marshall({ ":v": value }),
          Limit: limit,
          ScanIndexForward: order === "ASC",
        })
      );
      let items = (res.Items ?? []).map(
        (i) => new this(unmarshall(i) as InferAttributes<M>)
      );
      return skip > 0 ? items.slice(skip, skip + limit) : items;
    }

    // Fallback: Scan + FilterExpression
    const normalize = (op: string) => (op === "!=" ? "<>" : op);
    const exprParts: string[] = [];
    const names: Record<string, string> = {};
    const vals: Record<string, any> = {};

    conditions.forEach((c, i) => {
      const nk = `#k${i}`;
      const nv = `:v${i}`;
      exprParts.push(`${nk} ${normalize(c.op)} ${nv}`);
      names[nk] = c.key;
      vals[nv] = c.value;
    });

    const res = await client!.send(
      new ScanCommand({
        TableName: meta.name,
        FilterExpression: exprParts.join(" AND "),
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(vals),
      })
    );

    let items = (res.Items ?? []).map(
      (i) => new this(unmarshall(i) as InferAttributes<M>)
    );
    
    // Ordenar items según el primer campo de condición
    if (conditions.length > 0) {
      const sortKey = conditions[0].key;
      items.sort((a: any, b: any) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        
        // Ordenamiento numérico o string
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return order === 'ASC' ? aVal - bVal : bVal - aVal;
        } else {
          const comparison = String(aVal).localeCompare(String(bVal));
          return order === 'ASC' ? comparison : -comparison;
        }
      });
    }
    
    return items.slice(skip, skip + limit);
  }

  /* --------------------------- helpers de instancia ---------------------- */
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

  toString(): string {
    return JSON.stringify(this.toJSON());
  }
}

export { STORE };
export type { WrapperEntry };
