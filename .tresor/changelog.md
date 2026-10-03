# Tresor Changelog

## Unreleased

### Changed
- v2 storefront imported unchanged as the final base (commit 99aae89), replacing the earlier sage build in the repository tree.

### Known Issues
- `next build` fails on the imported v2 because of a typedRoutes type error in `app/admin/layout.tsx`.
- Admin pages show hard-coded sample rows and have no styles.
- The product page shows "Large +₹40" but the cart charges the regular price.
