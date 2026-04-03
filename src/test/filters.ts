import {
  Dynamite, Table, PrimaryKey, Default, NotNull,
  CreationOptional, Name,
} from "../index";

@Name('test_filter_products')
class Product extends Table<Product> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @NotNull() declare name: string;
  @Default('') declare category: string;
  @Default(() => 0) declare price: CreationOptional<number>;
  @Default(() => 0) declare stock: CreationOptional<number>;
  @Default('') declare tags: string;
  @Default(() => true) declare active: CreationOptional<boolean>;
}

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  OK  ${label}`); passed++; }
  else { console.error(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); failed++; }
}

export default async function filters() {
  console.log('\n=== FILTERS ===\n');

  const dynamite = new Dynamite({
    tables: [Product],
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  await dynamite.connect();
  await dynamite.sync();

  // -- Seed 20 products --
  const items: Promise<Product>[] = [];
  for (let i = 0; i < 20; i++) {
    items.push(Product.create({
      name: `Product_${i}`,
      category: i < 10 ? 'electronics' : 'clothing',
      price: (i + 1) * 10,
      stock: i % 3 === 0 ? 0 : (i + 1) * 5,
      tags: i < 5 ? 'featured,new' : i < 15 ? 'sale' : 'clearance',
      active: i < 18,
    }));
  }
  const products = await Promise.all(items);
  console.log(`  Seeded ${products.length} products\n`);

  // ===================== BASIC =====================
  console.log('-- Filtros basicos --');

  // $eq plano
  const by_name = await Product.where({ name: 'Product_0' });
  assert('$eq plano: name = Product_0', by_name.length === 1 && by_name[0].name === 'Product_0');

  // $eq explicito
  const by_eq = await Product.where({ name: { $eq: 'Product_5' } });
  assert('$eq explicito', by_eq.length === 1);

  // Sobrecarga key, value
  const by_kv = await Product.where('name', 'Product_3');
  assert('sobrecarga (key, value)', by_kv.length === 1);

  // Sobrecarga key, operator, value
  const by_kov = await Product.where('name', '=', 'Product_3');
  assert('sobrecarga (key, op, value)', by_kov.length === 1);

  // null ($eq null -> attribute_not_exists)
  // Todos los productos tienen name, asi que buscar uno sin category custom
  const no_results = await Product.where({ name: null as any });
  assert('$eq null -> attribute_not_exists', no_results.length === 0);

  // $ne
  const not_electronics = await Product.where({ category: { $ne: 'electronics' } });
  assert('$ne: no electronics', not_electronics.every(p => p.category !== 'electronics'));
  assert('$ne: count correcto', not_electronics.length === 10);

  // ===================== ADVANCED =====================
  console.log('\n-- Filtros avanzados --');

  // $gt
  const expensive = await Product.where({ price: { $gt: 150 } });
  assert('$gt: price > 150', expensive.every(p => p.price > 150));
  assert('$gt: count', expensive.length === 5); // 160,170,180,190,200

  // $gte
  const gte150 = await Product.where({ price: { $gte: 150 } });
  assert('$gte: price >= 150', gte150.length === 6); // 150,160,...,200

  // $lt
  const cheap = await Product.where({ price: { $lt: 50 } });
  assert('$lt: price < 50', cheap.every(p => p.price < 50));
  assert('$lt: count', cheap.length === 4); // 10,20,30,40

  // $lte
  const lte50 = await Product.where({ price: { $lte: 50 } });
  assert('$lte: price <= 50', lte50.length === 5); // 10,20,30,40,50

  // $in
  const specific = await Product.where({ name: { $in: ['Product_0', 'Product_5', 'Product_19'] } as any });
  assert('$in: 3 productos especificos', specific.length === 3);

  // $in vacio lanza error
  let in_empty_threw = false;
  try { await Product.where({ name: { $in: [] } as any }); } catch { in_empty_threw = true; }
  assert('$in vacio lanza error', in_empty_threw);

  // $include (contains)
  const featured = await Product.where({ tags: { $include: 'featured' } });
  assert('$include: tags contiene featured', featured.length === 5);

  // Multi-campo
  const multi = await Product.where({ category: 'electronics', active: true });
  assert('multi-campo: electronics + active', multi.length === 10 && multi.every(p => p.category === 'electronics'));

  // ===================== SUPREME =====================
  console.log('\n-- Filtros nivel supremo --');

  // Rango: price >= 50 AND price <= 150
  const range = await Product.where({ price: { $gte: 50, $lte: 150 } });
  assert('rango: 50 <= price <= 150', range.every(p => p.price >= 50 && p.price <= 150));
  assert('rango: count', range.length === 11); // 50,60,...,150

  // Multi-campo + operadores: electronics + price > 80 + stock > 0
  const complex = await Product.where({
    category: 'electronics',
    price: { $gt: 80 },
    stock: { $gt: 0 },
  });
  assert('supremo: electronics + price>80 + stock>0',
    complex.every(p => p.category === 'electronics' && p.price > 80 && p.stock > 0));

  // $ne null -> attribute_exists (campo existe)
  const has_category = await Product.where({ category: { $ne: null as any } });
  assert('$ne null: todos tienen category', has_category.length === 20);

  // $include + rango
  const sale_mid = await Product.where({
    tags: { $include: 'sale' },
    price: { $gte: 80, $lte: 120 },
  });
  assert('$include + rango',
    sale_mid.every(p => p.tags.includes('sale') && p.price >= 80 && p.price <= 120));

  // Combinacion de todo: category + price range + active + tags
  const ultimate = await Product.where({
    category: 'electronics',
    price: { $gte: 30, $lte: 90 },
    active: true,
    tags: { $include: 'sale' },
  });
  assert('ultimate: 4 condiciones combinadas',
    ultimate.every(p =>
      p.category === 'electronics' &&
      p.price >= 30 && p.price <= 90 &&
      p.active === true &&
      p.tags.includes('sale')
    ));

  // -- Paginacion --
  console.log('\n-- Paginacion --');

  const page1 = await Product.where({}, { limit: 5, order: { price: 'ASC' } });
  assert('limit 5', page1.length === 5);
  assert('order ASC', page1[0].price <= page1[4].price);

  const page2 = await Product.where({}, { limit: 5, offset: 5, order: { price: 'ASC' } });
  assert('offset 5 no repite', page2[0].price > page1[4].price);

  const desc = await Product.where({}, { limit: 3, order: { price: 'DESC' } });
  assert('order DESC', desc[0].price >= desc[2].price);
  assert('DESC top = 200', desc[0].price === 200);

  // -- Proyeccion --
  console.log('\n-- Proyeccion --');
  const projected = await Product.where({}, { attributes: ['name', 'price'], limit: 1 });
  assert('attributes: tiene name', projected[0]?.name !== undefined);
  assert('attributes: tiene price', projected[0]?.price !== undefined);

  console.log(`\n  Filters: ${passed} passed, ${failed} failed`);
  return failed;
}
