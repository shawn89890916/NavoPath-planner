# Reading v2 preview

Unpublished, SDK-only migration candidate. Build with `node scripts/build-plugin-preview.mjs reading <output-file>`. The production catalog and existing Reading v1 remain unchanged. The v2 namespace is separate and initially empty; this is a clean-library preview only, not an existing-user migration. Do not promote until the legacy library import, mixed-version preference/catalog compatibility, conflict recovery UI, undo parity and real desktop/browser checks are complete. No host-private import or separate timer collector is used.
