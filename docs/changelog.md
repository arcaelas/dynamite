# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Performance optimizations for batch operations
- Additional query operators and filters
- Improved error handling and debugging tools

---

## [1.0.23] - 2025-12-13

### Fixed
- **mkdocs.yml**: Corrected navigation structure pointing to non-existent paths (`guides/`, `api/`)
- **TOC anchors**: Fixed 47 broken anchor links across ES/DE documentation files
  - Removed accents from anchors (`#introducción` → `#introduccion`)
  - Fixed triple-dash anchors (`#primarykey---claves` → `#primarykey-claves`)
- **docs/index.es.md, docs/index.de.md**: Fixed homepage links to correct paths
- **docs/installation.*.md**: Fixed API reference links (`./api/table.md` → `./references/table.md`)
- **docs/getting-started.*.md**: Fixed core-concepts and examples links
- **docs/references/client.*.md**: Fixed decorators link format (`./decorators/` → `./decorators.md`)
- **docs/references/decorators.de.md**: Removed TOC entries for non-existent sections (file is incomplete)
- **docs/examples/relations.*.md**: Fixed decorator reference links to correct anchors
- **docs/examples/advanced.*.md**: Fixed core-concepts cross-reference link

### Documentation
- Resolved all MkDocs build warnings (from 47 to 0 broken links)
- Improved multilingual documentation consistency (EN/ES/DE)
- Fixed German navbar appearing on 404 pages due to incorrect link paths

---

## [1.0.20] - 2025-12-12

### Added
- `API.md` - Comprehensive API documentation covering decorators, schemas, and methods
- `docs/references/table.md` - Complete Table class API reference in English
- `docs/references/types.md` - Full TypeScript types documentation in English
- `src/@types/index.ts` - Centralized TypeScript type definitions for better type inference
- `eslint.config.js` - ESLint configuration for consistent code quality
- `scripts/generate_seed.ts` - Utility script for generating test seed data
- `scripts/load_seed.ts` - Utility script for loading seed data into DynamoDB
- `tsx.config.json` - TSX runtime configuration for development

### Changed
- Reorganized documentation structure from `guides/`, `api/`, `advanced/` into unified `references/` directory
- Renamed example files for consistency: `basic-model` → `basic`, `advanced-queries` → `advanced`, `relationships` → `relations`
- Moved `getting-started.md` from `guides/` to documentation root for easier access
- Updated ~40 internal documentation links to match new structure
- Simplified navigation in `index.md` with cleaner hierarchy
- Lowercase changelog filenames for cross-platform consistency
- Refactored `src/core/table.ts` with improved query handling and relationship loading
- Enhanced `src/core/decorator.ts` with optimized getter/setter pipelines
- Improved `src/core/client.ts` with better DynamoDB connection handling
- Optimized all decorators in `src/decorators/*.ts` for better performance
- Refactored `src/utils/relations.ts` with cleaner relationship resolution logic
- Updated `src/index.ts` exports for simplified module structure
- Reduced `src/index.test.ts` test suite for faster execution
- Updated `package.json` with improved scripts and dependencies
- Cleaned up `yarn.lock` removing redundant dependency entries

### Removed
- `docs/examples/validation.*` - Redundant examples, content merged into `basic` examples
- `docs/guides/relationships.*` - Duplicate content, consolidated into `relations` examples
- `docs/api/table.md` and `docs/api/types.md` - Replaced with new English versions in `references/`
- `src/core/method.ts` - Functionality consolidated into `table.ts`

### Fixed
- Corrected `table.md` and `types.md` language (were incorrectly in Spanish, now properly in English)
- Fixed all broken internal documentation links across 39 files
- Resolved inconsistent file naming conventions in examples directory

### Performance
- Reduced test file complexity for faster CI/CD execution
- Optimized yarn.lock with -2873 lines of redundant entries
- Net codebase reduction of -9220 lines while maintaining functionality

### Documentation
- Complete documentation restructure following: Get Started → Installation → Examples → References → Changelog
- Multilingual support maintained (EN/ES/DE) across all documentation files
- Improved cross-referencing between related documentation sections

---

## [1.0.17] - 2025-12-03

### Added
- `@Serialize(fromDB, toDB)` - Bidirectional data transformation decorator
- `@DeleteAt()` - Soft delete decorator with timestamp
- `Dynamite.tx()` - Atomic transactions with automatic rollback
- `TransactionContext` class for managing transactional operations
- `withTrashed()` method to include soft-deleted records
- `onlyTrashed()` method to query only soft-deleted records
- Support for `null` as fallback in `@Serialize` parameters

### Changed
- Enhanced `destroy()` method to support soft delete when `@DeleteAt` is present
- `destroy()` now accepts optional `TransactionContext` parameter for transactional operations
- Improved documentation with `@Serialize` and `@DeleteAt` examples
- Consolidated decorator documentation into `/guides/decorators.md`

### Removed
- `/api/decorators/` directory (21 files) - content merged into `/guides/decorators.md`

### Documentation
- Added comprehensive `@Serialize` documentation with encryption, compression examples
- Added `@DeleteAt` documentation with trash system patterns
- Added `Dynamite.tx()` transaction API documentation
- Updated model examples to include new decorators
- Consolidated multilingual documentation (EN/ES/DE)

---

## [1.0.13] - 2025-10-13

### Current Release
This is a stable release of @arcaelas/dynamite - a modern, decorator-first ORM for DynamoDB with full TypeScript support.

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

- **v1.0.23** (Current) - Documentation link fixes, TOC anchor corrections, multilingual consistency
- **v1.0.20** - Documentation restructure, codebase optimization, API.md creation
- **v1.0.17** - Added @Serialize, @DeleteAt, Dynamite.tx() transactions
- **v1.0.13** - Stable release with full feature set
- **v1.0.0** - Initial public release

---

## Links

- **Repository**: https://github.com/arcaelas/dynamite
- **Issues**: https://github.com/arcaelas/dynamite/issues
- **NPM Package**: https://www.npmjs.com/package/@arcaelas/dynamite
- **Author**: [Arcaelas Insiders](https://github.com/arcaelas)

---

## Migration Guides

### Upgrading to v1.0.20

#### Documentation Links
If you have external links to the documentation, update them:
- `docs/guides/getting-started.md` → `docs/getting-started.md`
- `docs/api/*` → `docs/references/*`
- `docs/guides/decorators.md` → `docs/references/decorators.md`
- `docs/examples/basic-model.md` → `docs/examples/basic.md`
- `docs/examples/advanced-queries.md` → `docs/examples/advanced.md`
- `docs/examples/relationships.md` → `docs/examples/relations.md`

No breaking changes to the API. All features are backward compatible.

### Upgrading to v1.0.13

No breaking changes from v1.0.0. All features are backward compatible.

---

## Contributing

See [GitHub Repository](https://github.com/arcaelas/dynamite#contributing) for contribution guidelines.

---

**Note**: For detailed usage examples and API documentation, please refer to the [GitHub Repository](https://github.com/arcaelas/dynamite).
