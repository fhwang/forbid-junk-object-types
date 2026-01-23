# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-23

### Added
- Inline object type detection - now flags all anonymous object types (e.g., `{ a: number }`)
- Context-aware error messages for inline violations
- Line:column based suppressions for inline objects
- Grouped output separating named and inline violations

### Changed
- BREAKING: Violation type is now a discriminated union with `kind` field ('named' or 'inline')
- Enhanced reporter to handle both violation kinds
- Suppression format now supports both named types and line:column keys

### Technical
- Added `collectInlineObjectViolations` function to parser
- Refactored analyzer to merge named and inline violations
- Updated all tests to cover inline object detection

## [1.0.0] - Previous release

Initial release with named type and interface detection.
