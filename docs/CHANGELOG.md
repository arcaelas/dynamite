# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Enhanced transaction support for complex operations
- Performance optimizations for batch operations
- Additional query operators and filters
- Improved error handling and debugging tools

---

## [1.0.13] - 2025-10-13

### Current Release
This is the current stable release of @arcaelas/dynamite - a modern, decorator-first ORM for DynamoDB with full TypeScript support.

### Features

#### Core Functionality
- Full-featured ORM with decorator-first approach
- Complete TypeScript support with type safety
- Auto table creation and management
- Zero boilerplate configuration

#### Decorators
- **Core Decorators**: `@PrimaryKey()`, `@Index()`, `@IndexSort()`, `@Name()`
- **Data Decorators**: `@Default()`, `@Mutate()`, `@Validate()`, `@NotNull()`
- **Timestamp Decorators**: `@CreatedAt()`, `@UpdatedAt()`
- **Relationship Decorators**: `@HasMany()`, `@BelongsTo()`

#### TypeScript Types
- `CreationOptional<T>` - Mark fields as optional during creation
- `NonAttribute<T>` - Exclude computed properties from database
- `HasMany<T>` - One-to-many relationships
- `BelongsTo<T>` - Many-to-one relationships
- `InferAttributes<T>` - Type inference for model attributes

#### Query Operations
- Basic CRUD operations (create, read, update, delete)
- Advanced query operators: `=`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not-in`, `contains`, `begins-with`
- Pagination support with `limit` and `skip`
- Sorting with `order` (ASC/DESC)
- Attribute selection with `attributes` array
- Complex filtering with multiple conditions

#### Relationships
- One-to-many relationships via `@HasMany()`
- Many-to-one relationships via `@BelongsTo()`
- Nested relationship loading with `include`
- Filtered relationship queries
- Recursive relationship support

#### Data Validation & Transformation
- Field validation with custom validators
- Data mutation/transformation before save
- Multi-step validation chains
- Not-null constraints
- Email, age, and custom format validation

#### Configuration
- AWS DynamoDB connection support
- DynamoDB Local development support
- Custom endpoint configuration
- Flexible credential management
- Environment variable support

### Dependencies
- `@aws-sdk/client-dynamodb`: ^3.329.0
- `@aws-sdk/lib-dynamodb`: ^3.329.0
- `pluralize`: ^8.0.0
- `uuid`: ^11.1.0

### Documentation
- Comprehensive README with examples
- TypeScript types documentation
- API reference guide
- Development setup instructions
- Troubleshooting guide
- Best practices and performance tips

---

## [1.0.0] - Initial Release

### Added
- Initial release of @arcaelas/dynamite
- Base Table class implementation
- Core decorator system
- DynamoDB client wrapper
- Metadata management system
- Basic CRUD operations
- Query builder functionality
- Relationship support foundation
- TypeScript definitions
- Jest testing setup

---

## Version History Summary

- **v1.0.13** (Current) - Stable release with full feature set
- **v1.0.0** - Initial public release

---

## Links

- **Repository**: https://github.com/arcaelas/dynamite
- **Issues**: https://github.com/arcaelas/dynamite/issues
- **NPM Package**: https://www.npmjs.com/package/@arcaelas/dynamite
- **Author**: [Arcaelas Insiders](https://github.com/arcaelas)

---

## Migration Guides

### Upgrading to v1.0.13

No breaking changes from v1.0.0. All features are backward compatible.

---

## Contributing

See [README.md](../README.md#-contributing) for contribution guidelines.

---

**Note**: For detailed usage examples and API documentation, please refer to the [README.md](../README.md) file.
