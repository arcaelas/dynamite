# Relationship Decorators

## Descripción General

The `@HasMany` and `@BelongsTo` decorators define relationships between models, enabling intuitive navigation and querying of related data. These decorators implement common database relationship patterns in DynamoDB.

## Decorators

### @HasMany

Defines a one-to-many relationship where the current model has many instances of another model.

```typescript
@HasMany(model: () => ModelClass, options?: HasManyOptions)
```

### @BelongsTo

Defines a many-to-one relationship where the current model belongs to another model.

```typescript
@BelongsTo(model: () => ModelClass, options?: BelongsToOptions)
```

## Parámetros

### HasManyOptions

```typescript
interface HasManyOptions {
  /** Foreign key property name in related model */
  foreign_key?: string;

  /** Local key property name (defaults to primary key) */
  local_key?: string;

  /** Index name for efficient queries */
  index?: string;

  /** Eager load related models */
  eager?: boolean;
}
```

### BelongsToOptions

```typescript
interface BelongsToOptions {
  /** Foreign key property name (defaults to {model}_id) */
  foreign_key?: string;

  /** Owner key property name in parent model */
  owner_key?: string;

  /** Eager load parent model */
  eager?: boolean;
}
```

## Uso Básico

### One-to-Many Relationship

```typescript
import { Model, PrimaryKey, HasMany, BelongsTo } from 'dynamite-orm';

class User extends Model {
  @PrimaryKey()
  user_id!: string;

  name!: string;
  email!: string;

  @HasMany(() => Post)
  posts!: Post[];
}

class Post extends Model {
  @PrimaryKey()
  post_id!: string;

  title!: string;
  content!: string;

  @BelongsTo(() => User)
  user_id!: string;
}

// Usage
const user = await User.find('user123');
const posts = await user.posts;  // Lazy load posts

for (const post of posts) {
  console.log(post.title);
}
```

### Accessing Parent

```typescript
const post = await Post.find('post456');
const author = await post.user;  // Load parent user

console.log(`Written by: ${author.name}`);
```

## Ejemplos Avanzados

### Custom Foreign Keys

```typescript
class Company extends Model {
  @PrimaryKey()
  company_id!: string;

  name!: string;

  @HasMany(() => Employee, {
    foreign_key: 'employer_id',
    local_key: 'company_id'
  })
  employees!: Employee[];
}

class Employee extends Model {
  @PrimaryKey()
  employee_id!: string;

  name!: string;

  @BelongsTo(() => Company, {
    foreign_key: 'employer_id',
    owner_key: 'company_id'
  })
  employer_id!: string;
}
```

### Multiple Relationships

```typescript
class BlogPost extends Model {
  @PrimaryKey()
  post_id!: string;

  title!: string;
  content!: string;

  @BelongsTo(() => User)
  author_id!: string;

  @BelongsTo(() => Category)
  category_id!: string;

  @HasMany(() => Comment)
  comments!: Comment[];

  @HasMany(() => Like)
  likes!: Like[];
}

class Comment extends Model {
  @PrimaryKey()
  comment_id!: string;

  content!: string;

  @BelongsTo(() => BlogPost)
  post_id!: string;

  @BelongsTo(() => User)
  user_id!: string;
}
```

### Nested Relationships

```typescript
class Category extends Model {
  @PrimaryKey()
  category_id!: string;

  name!: string;

  @HasMany(() => Product)
  products!: Product[];
}

class Product extends Model {
  @PrimaryKey()
  product_id!: string;

  name!: string;

  @BelongsTo(() => Category)
  category_id!: string;

  @HasMany(() => Review)
  reviews!: Review[];
}

class Review extends Model {
  @PrimaryKey()
  review_id!: string;

  rating!: number;
  content!: string;

  @BelongsTo(() => Product)
  product_id!: string;

  @BelongsTo(() => User)
  user_id!: string;
}

// Navigate relationships
const category = await Category.find('cat123');
const products = await category.products;

for (const product of products) {
  const reviews = await product.reviews;
  console.log(`${product.name}: ${reviews.length} reviews`);
}
```

### Self-Referential Relationships

```typescript
class TreeNode extends Model {
  @PrimaryKey()
  node_id!: string;

  name!: string;

  @BelongsTo(() => TreeNode, {
    foreign_key: 'parent_id',
    owner_key: 'node_id'
  })
  parent_id?: string;

  @HasMany(() => TreeNode, {
    foreign_key: 'parent_id',
    local_key: 'node_id'
  })
  children!: TreeNode[];
}

// Build tree structure
const root = await TreeNode.find('root');
const children = await root.children;

for (const child of children) {
  const grandchildren = await child.children;
  console.log(`${child.name} has ${grandchildren.length} children`);
}
```

## Patrones Comunes

### Blog System

```typescript
class Author extends Model {
  @PrimaryKey()
  author_id!: string;

  name!: string;
  email!: string;
  bio!: string;

  @HasMany(() => Article)
  articles!: Article[];

  @HasMany(() => Comment)
  comments!: Comment[];
}

class Article extends Model {
  @PrimaryKey()
  article_id!: string;

  title!: string;
  content!: string;

  @BelongsTo(() => Author)
  author_id!: string;

  @HasMany(() => Comment)
  comments!: Comment[];

  @CreatedAt()
  created_at!: number;
}

class Comment extends Model {
  @PrimaryKey()
  comment_id!: string;

  content!: string;

  @BelongsTo(() => Article)
  article_id!: string;

  @BelongsTo(() => Author)
  author_id!: string;

  @CreatedAt()
  created_at!: number;
}
```

### E-Commerce System

```typescript
class Customer extends Model {
  @PrimaryKey()
  customer_id!: string;

  name!: string;
  email!: string;

  @HasMany(() => Order)
  orders!: Order[];

  @HasMany(() => Review)
  reviews!: Review[];
}

class Order extends Model {
  @PrimaryKey()
  order_id!: string;

  total_amount!: number;
  status!: string;

  @BelongsTo(() => Customer)
  customer_id!: string;

  @HasMany(() => OrderItem)
  items!: OrderItem[];

  @CreatedAt()
  created_at!: number;
}

class OrderItem extends Model {
  @PrimaryKey()
  item_id!: string;

  quantity!: number;
  price!: number;

  @BelongsTo(() => Order)
  order_id!: string;

  @BelongsTo(() => Product)
  product_id!: string;
}

class Product extends Model {
  @PrimaryKey()
  product_id!: string;

  name!: string;
  price!: number;

  @HasMany(() => OrderItem)
  order_items!: OrderItem[];

  @HasMany(() => Review)
  reviews!: Review[];
}

class Review extends Model {
  @PrimaryKey()
  review_id!: string;

  rating!: number;
  content!: string;

  @BelongsTo(() => Product)
  product_id!: string;

  @BelongsTo(() => Customer)
  customer_id!: string;
}
```

### Project Management

```typescript
class Team extends Model {
  @PrimaryKey()
  team_id!: string;

  name!: string;

  @HasMany(() => Project)
  projects!: Project[];

  @HasMany(() => Member)
  members!: Member[];
}

class Project extends Model {
  @PrimaryKey()
  project_id!: string;

  name!: string;
  description!: string;

  @BelongsTo(() => Team)
  team_id!: string;

  @HasMany(() => Task)
  tasks!: Task[];
}

class Task extends Model {
  @PrimaryKey()
  task_id!: string;

  title!: string;
  status!: string;

  @BelongsTo(() => Project)
  project_id!: string;

  @BelongsTo(() => Member)
  assigned_to!: string;
}

class Member extends Model {
  @PrimaryKey()
  member_id!: string;

  name!: string;
  role!: string;

  @BelongsTo(() => Team)
  team_id!: string;

  @HasMany(() => Task)
  tasks!: Task[];
}
```

### Social Network

```typescript
class Profile extends Model {
  @PrimaryKey()
  profile_id!: string;

  username!: string;
  bio!: string;

  @HasMany(() => Post)
  posts!: Post[];

  @HasMany(() => Follow, { foreign_key: 'follower_id' })
  following!: Follow[];

  @HasMany(() => Follow, { foreign_key: 'following_id' })
  followers!: Follow[];
}

class Post extends Model {
  @PrimaryKey()
  post_id!: string;

  content!: string;

  @BelongsTo(() => Profile)
  profile_id!: string;

  @HasMany(() => Like)
  likes!: Like[];

  @HasMany(() => Comment)
  comments!: Comment[];

  @CreatedAt()
  created_at!: number;
}

class Follow extends Model {
  @PrimaryKey()
  follow_id!: string;

  @BelongsTo(() => Profile, { foreign_key: 'follower_id' })
  follower_id!: string;

  @BelongsTo(() => Profile, { foreign_key: 'following_id' })
  following_id!: string;

  @CreatedAt()
  created_at!: number;
}

class Like extends Model {
  @PrimaryKey()
  like_id!: string;

  @BelongsTo(() => Post)
  post_id!: string;

  @BelongsTo(() => Profile)
  profile_id!: string;

  @CreatedAt()
  created_at!: number;
}
```

## Integración con Otros Decoradores

### With @IndexSort

```typescript
class OptimizedPost extends Model {
  @PrimaryKey()
  post_id!: string;

  title!: string;

  @BelongsTo(() => User)
  @IndexSort()  // Index for efficient relationship queries
  user_id!: string;

  @CreatedAt()
  @IndexSort()
  created_at!: number;
}

// Efficient query
const user_posts = await OptimizedPost.query()
  .usingIndex('user_id')
  .where('user_id', '=', 'user123')
  .execute();
```

### With @Validate

```typescript
class ValidatedRelationship extends Model {
  @PrimaryKey()
  id!: string;

  @BelongsTo(() => Parent)
  @Validate(async (value) => {
    const parent = await Parent.find(value);
    return parent !== null || 'Parent does not exist';
  })
  parent_id!: string;
}
```

### With Timestamps

```typescript
class TimestampedRelation extends Model {
  @PrimaryKey()
  id!: string;

  @BelongsTo(() => Parent)
  parent_id!: string;

  @CreatedAt()
  created_at!: number;

  @UpdatedAt()
  updated_at!: number;
}
```

## Mejores Prácticas

### 1. Use Indexes for Foreign Keys

```typescript
// Good - Indexed foreign key
class GoodRelation extends Model {
  @PrimaryKey()
  id!: string;

  @BelongsTo(() => Parent)
  @IndexSort()
  parent_id!: string;
}

// Avoid - Unindexed foreign key
class SlowRelation extends Model {
  @PrimaryKey()
  id!: string;

  @BelongsTo(() => Parent)
  parent_id!: string;  // ❌ Slow queries
}
```

### 2. Lazy Load by Default

```typescript
// Good - Lazy loading
class LazyPost extends Model {
  @HasMany(() => Comment)
  comments!: Comment[];

  async get_comments(): Promise<Comment[]> {
    return await this.comments;  // Load when needed
  }
}

// Avoid - Eager loading everything
class EagerPost extends Model {
  @HasMany(() => Comment, { eager: true })
  comments!: Comment[];  // ❌ Always loaded, even when not needed
}
```

### 3. Name Foreign Keys Clearly

```typescript
// Good - Clear naming
class ClearRelation extends Model {
  @BelongsTo(() => User)
  author_id!: string;

  @BelongsTo(() => User)
  reviewer_id!: string;
}

// Avoid - Ambiguous naming
class ConfusingRelation extends Model {
  @BelongsTo(() => User)
  user_id_1!: string;  // ❌ What does this represent?

  @BelongsTo(() => User)
  user_id_2!: string;  // ❌ Unclear purpose
}
```

### 4. Validate Relationships

```typescript
class SafeRelation extends Model {
  @PrimaryKey()
  id!: string;

  @BelongsTo(() => Parent)
  @Validate(async (value) => {
    if (!value) return 'Parent ID required';

    const exists = await Parent.find(value);
    return exists !== null || 'Parent not found';
  })
  parent_id!: string;
}
```

### 5. Document Complex Relationships

```typescript
class WellDocumented extends Model {
  @PrimaryKey()
  id!: string;

  /**
   * References the author of this post.
   * Each post has exactly one author.
   */
  @BelongsTo(() => User)
  author_id!: string;

  /**
   * References the user who last edited this post.
   * May be different from the original author.
   */
  @BelongsTo(() => User, { foreign_key: 'editor_id' })
  editor_id!: string;
}
```

## Eager Loading

### Basic Eager Loading

```typescript
class Post extends Model {
  @PrimaryKey()
  post_id!: string;

  title!: string;

  @BelongsTo(() => User, { eager: true })
  user_id!: string;
}

// User is automatically loaded
const post = await Post.find('post123');
const author_name = post.user.name;  // No additional query
```

### Selective Eager Loading

```typescript
class Article extends Model {
  @PrimaryKey()
  article_id!: string;

  @BelongsTo(() => Author)
  author_id!: string;

  @HasMany(() => Comment)
  comments!: Comment[];

  async load_with_relations(): Promise<void> {
    // Load author
    this.author = await Author.find(this.author_id);

    // Load comments
    this.comments = await Comment.query()
      .where('article_id', '=', this.article_id)
      .execute();
  }
}
```

## Performance Optimization

### Batch Loading

```typescript
async function load_posts_with_authors(post_ids: string[]): Promise<Post[]> {
  const posts = await Post.batchGet(post_ids);
  const author_ids = [...new Set(posts.map(p => p.author_id))];
  const authors = await User.batchGet(author_ids);

  const author_map = new Map(authors.map(a => [a.user_id, a]));

  for (const post of posts) {
    post.author = author_map.get(post.author_id);
  }

  return posts;
}
```

### Caching Relationships

```typescript
class CachedRelation extends Model {
  @PrimaryKey()
  id!: string;

  @BelongsTo(() => Parent)
  parent_id!: string;

  private _cached_parent?: Parent;

  async get_parent(): Promise<Parent> {
    if (!this._cached_parent) {
      this._cached_parent = await Parent.find(this.parent_id);
    }
    return this._cached_parent;
  }
}
```

### Denormalization

```typescript
class OptimizedPost extends Model {
  @PrimaryKey()
  post_id!: string;

  title!: string;

  @BelongsTo(() => User)
  author_id!: string;

  // Denormalized data for performance
  author_name!: string;
  author_avatar!: string;

  async set_author(author: User): Promise<void> {
    this.author_id = author.user_id;
    this.author_name = author.name;
    this.author_avatar = author.avatar_url;
  }
}
```

## Pruebas Relationships

```typescript
import { describe, it, expect } from 'vitest';

describe('Relationships', () => {
  it('should load related models', async () => {
    const user = new User();
    user.user_id = 'user123';
    await user.save();

    const post = new Post();
    post.post_id = 'post123';
    post.user_id = user.user_id;
    await post.save();

    const loaded_posts = await user.posts;
    expect(loaded_posts).toHaveLength(1);
    expect(loaded_posts[0].post_id).toBe(post.post_id);
  });

  it('should load parent model', async () => {
    const user = new User();
    user.user_id = 'user123';
    user.name = 'John Doe';
    await user.save();

    const post = new Post();
    post.post_id = 'post123';
    post.user_id = user.user_id;
    await post.save();

    const author = await post.user;
    expect(author.name).toBe('John Doe');
  });
});
```

## Migration Patterns

### Adding Relationships

```typescript
// Step 1: Add relationship decorators
class Post extends Model {
  @PrimaryKey()
  post_id!: string;

  // New relationship
  @BelongsTo(() => Category)
  @IndexSort()
  category_id!: string;
}

// Step 2: Backfill data
async function add_categories() {
  const posts = await Post.scan().execute();

  for (const post of posts) {
    if (!post.category_id) {
      post.category_id = 'uncategorized';
      await post.save();
    }
  }
}
```

### Changing Relationships

```typescript
// Old structure
class OldPost extends Model {
  @BelongsTo(() => User)
  user_id!: string;
}

// New structure with separate author and editor
class NewPost extends Model {
  @BelongsTo(() => User)
  author_id!: string;

  @BelongsTo(() => User)
  editor_id!: string;
}

// Migration
async function split_user_relation() {
  const posts = await OldPost.scan().execute();

  for (const post of posts) {
    const new_post = new NewPost();
    new_post.author_id = post.user_id;
    new_post.editor_id = post.user_id;  // Initially same as author
    // Copy other fields
    await new_post.save();
  }
}
```

## Ver También

- [@IndexSort](./index-sort.md) - Index foreign keys
- [@Validate](./validate.md) - Validate relationships
- [Query API](../query.md) - Query related models
- [Performance Guide](../../guides/performance.md) - Relationship optimization
