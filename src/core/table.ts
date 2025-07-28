import {
  DeleteItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  clearRelationCache,
  processIncludes,
  separateQueryOptions,
} from "../utils/relations";
import { getGlobalClient } from "./client";
import wrapper, { InferAttributes, STORE, WrapperEntry } from "./wrapper";

/** Get required DynamoDB client */
const requireClient = () => getGlobalClient();

/** Get metadata for constructor or throw error */
const mustMeta = (ctor: Function): WrapperEntry => {
  const meta = wrapper.get(ctor);
  if (!meta) throw new Error(`Class ${ctor.name} not registered in wrapper`);
  return meta;
};

/** Base Table class for DynamoDB ORM with CRUD operations */
export default class Table<T extends {} = any> {
  protected [STORE]!: { [K in keyof T]?: T[K] };

  /** Initialize table instance with data */
  constructor(data: InferAttributes<T>) {
    requireClient();
    const meta = mustMeta(Object.getPrototypeOf(this).constructor);
    meta.columns.forEach((c) => {
      if (!(c.name in data)) (this as any)[c.name] = undefined;
    });
    Object.assign(this, data);
  }

  /** Save instance to database (create or update) */
  async save(): Promise<this> {
    const id: unknown = this["id"];
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

  /** Update instance with partial data */
  async update(patch: Partial<InferAttributes<T>>): Promise<this> {
    const id: unknown = this["id"];
    if (id === undefined || id === null)
      throw new Error("update() requiere id");

    Object.assign(this, patch);
    const Ctor = this.constructor as typeof Table<any>;
    await (Ctor as any).update(String(id), this.toJSON());
    return this;
  }

  /** Delete instance from database */
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
    const client = requireClient();
    const meta = mustMeta(this);
    const payload = new this(data).toJSON();

    await client.send(
      new PutItemCommand({
        TableName: meta.name,
        Item: marshall(payload, { removeUndefinedValues: true }),
      })
    );

    return new this(data);
  }

  // prettier-ignore
  static async update<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    id: string,
    record: InferAttributes<M>,
  ): Promise<void> {
    const client = requireClient();
    const meta = mustMeta(this);
    const payload = { ...record, id };

    await client.send(
      new PutItemCommand({
        TableName: meta.name,
        Item: marshall(payload, { removeUndefinedValues: true }),
      })
    );
  }

  /**
   * Actualiza múltiples registros que coincidan con los filtros especificados
   * @param updates - Objeto con los valores a actualizar
   * @param filters - Filtros para seleccionar qué registros actualizar
   * @returns Número de registros actualizados
   */
  // prettier-ignore
  static async updateWhere<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    updates: Partial<InferAttributes<M>>,
    filters: Partial<InferAttributes<M>>
  ): Promise<number> {
    // Buscar todos los registros que coincidan con los filtros
    const records = await (this as any).where(filters);
    
    // Actualizar cada registro individualmente
    let updatedCount = 0;
    for (const record of records) {
      try {
        await (this as any).update(record.id, { ...record.toJSON(), ...updates } as InferAttributes<M>);
        updatedCount++;
      } catch (error) {
        // Continuar con el siguiente registro si hay un error
        console.warn(`Error actualizando registro ${record.id}:`, error);
      }
    }
    
    return updatedCount;
  }

  // prettier-ignore
  static async destroy<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    id: string,
  ): Promise<null> {
    const client = requireClient();
    const meta = mustMeta(this);

    try {
      await client.send(
        new DeleteItemCommand({
          TableName: meta.name,
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
    options?: {
      limit?: number;
      skip?: number;
      order?: "ASC" | "DESC";
      include?: Record<string, any>;
    }
  ): Promise<M[]>;
  static async where<M extends Table, K extends keyof InferAttributes<M>>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    key: K,
    op: "=" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "not-in",
    value: InferAttributes<M>[K] | InferAttributes<M>[K][],
    options?: {
      limit?: number;
      skip?: number;
      order?: "ASC" | "DESC";
      include?: Record<string, any>;
    }
  ): Promise<M[]>;
  static async where<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    filters: Partial<{
      [K in keyof InferAttributes<M>]:
        | InferAttributes<M>[K]
        | InferAttributes<M>[K][];
    }>,
    options?: {
      limit?: number;
      skip?: number;
      order?: "ASC" | "DESC";
      include?: Record<string, any>;
    }
  ): Promise<M[]>;
  static async where<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    ...args: any[]
  ): Promise<M[]> {
    try {
      requireClient();
      const meta = mustMeta(this);

      type Entry = { key: string; op: string; value: unknown };
      const conditions: Entry[] = [];

      // Detección y extracción de opciones
      const last = args.at(-1);
      const hasOptions =
        typeof last === "object" &&
        last !== null &&
        ("limit" in last ||
          "skip" in last ||
          "order" in last ||
          "include" in last);
      const options = hasOptions ? args.pop() : {};

      // Separar opciones de query e include
      const { queryOptions, includeOptions } = separateQueryOptions(options);

      // Validar opciones de query
      if (queryOptions.limit !== undefined && queryOptions.limit < 0) {
        throw new Error("Argumentos inválidos");
      }
      if (queryOptions.skip !== undefined && queryOptions.skip < 0) {
        throw new Error("Argumentos inválidos");
      }
      if (
        queryOptions.order !== undefined &&
        !["ASC", "DESC"].includes(queryOptions.order)
      ) {
        throw new Error("Argumentos inválidos");
      }

      const limit = queryOptions.limit ?? 100;
      const skip = queryOptions.skip ?? 0;
      const order = (queryOptions.order ?? "ASC") as "ASC" | "DESC";

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
          // Detectar arrays y convertir a operador 'in'
          if (Array.isArray(value)) {
            if (value.length === 0) {
              throw new Error("Array vacío no permitido en filtros");
            }
            if (value.length > 100) {
              throw new Error("Operador 'in' limitado a 100 valores máximo");
            }
            conditions.push({ key, op: "in", value });
          } else {
            conditions.push({ key, op: "=", value });
          }
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
        const validOps = ["=", "!=", "<", "<=", ">", ">=", "in", "not-in"];
        if (!validOps.includes(op)) {
          throw new Error("Argumentos inválidos");
        }
        // Validar arrays para operadores in/not-in
        if (op === "in" || op === "not-in") {
          if (!Array.isArray(value)) {
            throw new Error(`Operador '${op}' requiere un array`);
          }
          if (value.length === 0) {
            throw new Error(`Operador '${op}' requiere array no vacío`);
          }
          if (value.length > 100) {
            throw new Error(`Operador '${op}' limitado a 100 valores máximo`);
          }
        } else if (Array.isArray(value)) {
          throw new Error(`Operador '${op}' no acepta arrays`);
        }
        // Validar que el campo existe en el modelo
        if (!meta.columns.has(key)) {
          return [];
        }
        conditions.push({ key, op, value });
      } else {
        throw new Error("Argumentos inválidos");
      }

      // Si no hay condiciones, hacer scan completo
      if (conditions.length === 0) {
        const client = requireClient();
        const res = await client.send(
          new ScanCommand({
            TableName: meta.name,
          })
        );
        let items = (res.Items ?? []).map(
          (i) => new this(unmarshall(i) as InferAttributes<M>)
        );

        const paginatedItems = items.slice(skip, skip + limit);

        // Procesar includes si están presentes
        if (includeOptions && Object.keys(includeOptions).length > 0) {
          console.log("DEBUG: processIncludes called with:", includeOptions);
          const result = await processIncludes(
            this,
            [...paginatedItems],
            includeOptions
          );
          console.log("DEBUG: processIncludes result:", result.length, "items");
          return result;
        }

        return paginatedItems;
      }

      // Query optimizado si es por PK/SK e igualdad
      const column = meta.columns.get(conditions[0].key);
      const isIndex = column?.index || column?.indexSort;

      if (conditions.length === 1 && isIndex && conditions[0].op === "=") {
        const client = requireClient();
        const { key, value } = conditions[0];
        const res = await client.send(
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

        const paginatedItems =
          skip > 0 ? items.slice(skip, skip + limit) : items;

        // Procesar includes si están presentes
        if (includeOptions && Object.keys(includeOptions).length > 0) {
          console.log(
            "DEBUG: processIncludes called with (optimized path):",
            includeOptions
          );
          const result = await processIncludes(
            this,
            [...paginatedItems],
            includeOptions
          );
          console.log(
            "DEBUG: processIncludes result (optimized path):",
            result.length,
            "items"
          );
          return result;
        }

        return paginatedItems;
      }

      // Fallback: Scan + FilterExpression
      const normalize = (op: string) => (op === "!=" ? "<>" : op);
      const exprParts: string[] = [];
      const names: Record<string, string> = {};
      const vals: Record<string, any> = {};

      conditions.forEach((c, i) => {
        const nk = `#k${i}`;
        names[nk] = c.key;

        if (c.op === "in" || c.op === "not-in") {
          // Manejar arrays para operadores IN/NOT-IN
          const values = c.value as any[];
          const placeholders = values
            .map((_, idx) => `:v${i}_${idx}`)
            .join(", ");
          const expression =
            c.op === "in"
              ? `${nk} IN (${placeholders})`
              : `NOT (${nk} IN (${placeholders}))`;
          exprParts.push(expression);

          // Agregar cada valor del array
          values.forEach((val, idx) => {
            vals[`:v${i}_${idx}`] = val;
          });
        } else {
          // Operadores simples
          const nv = `:v${i}`;
          exprParts.push(`${nk} ${normalize(c.op)} ${nv}`);
          vals[nv] = c.value;
        }
      });

      const client = requireClient();
      const res = await client.send(
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
          if (typeof aVal === "number" && typeof bVal === "number") {
            return order === "ASC" ? aVal - bVal : bVal - aVal;
          } else {
            const comparison = String(aVal).localeCompare(String(bVal));
            return order === "ASC" ? comparison : -comparison;
          }
        });
      }

      const paginatedItems = items.slice(skip, skip + limit);

      // Procesar includes si están presentes
      if (includeOptions && Object.keys(includeOptions).length > 0) {
        console.log("DEBUG: processIncludes called with:", includeOptions);
        const result = await processIncludes(
          this,
          [...paginatedItems],
          includeOptions
        );
        console.log("DEBUG: processIncludes result:", result.length, "items");
        return result;
      }

      return paginatedItems;
    } finally {
      // Limpiar cache de relaciones al finalizar
      clearRelationCache(this);
    }
  }

  /**
   * Obtiene el primer elemento que coincida con la condición especificada.
   * Equivalente a where() con { limit: 1, skip: 0, order: "ASC" }.
   *
   * @template M Instancia de la clase Table.
   * @template K Clave de atributos inferida.
   *
   * @param key   - Clave a filtrar (ej. "id").
   * @param value - Valor a comparar (equivalente a '=' implícito).
   *
   * @example
   *   const user = await User.first('id', 'u1');
   *   const firstActive = await User.first('status', '=', 'active');
   *   const firstMatch = await User.first({ email: 'test@example.com' });
   *
   * @returns - El primer elemento encontrado o undefined si no hay coincidencias.
   */
  static async first<M extends Table, K extends keyof InferAttributes<M>>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    key: K,
    value: InferAttributes<M>[K]
  ): Promise<M | undefined>;
  static async first<M extends Table, K extends keyof InferAttributes<M>>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    key: K,
    op: "=" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "not-in",
    value: InferAttributes<M>[K] | InferAttributes<M>[K][]
  ): Promise<M | undefined>;
  static async first<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    filters: Partial<{
      [K in keyof InferAttributes<M>]:
        | InferAttributes<M>[K]
        | InferAttributes<M>[K][];
    }>
  ): Promise<M | undefined>;
  static async first<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    ...args: any[]
  ): Promise<M | undefined> {
    const results = await (this as any).where(...args, {
      limit: 1,
      skip: 0,
      order: "ASC",
    });
    return results[0] || undefined;
  }

  /**
   * Obtiene el último elemento que coincida con la condición especificada.
   * Equivalente a where() con { limit: 1, skip: 0, order: "DESC" }.
   *
   * @template M Instancia de la clase Table.
   * @template K Clave de atributos inferida.
   *
   * @param key   - Clave a filtrar (ej. "id").
   * @param value - Valor a comparar (equivalente a '=' implícito).
   *
   * @example
   *   const user = await User.last('id', 'u1');
   *   const lastActive = await User.last('status', '=', 'active');
   *   const lastMatch = await User.last({ email: 'test@example.com' });
   *
   * @returns - El último elemento encontrado o undefined si no hay coincidencias.
   */
  static async last<M extends Table, K extends keyof InferAttributes<M>>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    key: K,
    value: InferAttributes<M>[K]
  ): Promise<M | undefined>;
  static async last<M extends Table, K extends keyof InferAttributes<M>>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    key: K,
    op: "=" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "not-in",
    value: InferAttributes<M>[K] | InferAttributes<M>[K][]
  ): Promise<M | undefined>;
  static async last<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    filters: Partial<{
      [K in keyof InferAttributes<M>]:
        | InferAttributes<M>[K]
        | InferAttributes<M>[K][];
    }>
  ): Promise<M | undefined>;
  static async last<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    ...args: any[]
  ): Promise<M | undefined> {
    const results = await (this as any).where(...args, {
      limit: 1,
      skip: 0,
      order: "DESC",
    });
    return results[0] || undefined;
  }

  /**
   * Obtiene los metadatos del modelo para uso interno del sistema de relaciones.
   *
   * @template M Instancia de la clase Table.
   * @returns Los metadatos del wrapper del modelo.
   */
  static getMeta<M extends Table>(this: {
    new (data: InferAttributes<M>): M;
    prototype: M;
  }): WrapperEntry {
    return mustMeta(this);
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
