# @vaa/tax

Tax fields as mapped fields, tax recomputation, and the tax-assertion bundle.

- `collectTaxFields` / `recomputeVat` / `verifyVatDeclaration` — recompute the period VAT position from the mapped tax fields.
- `checkRate` — permitted VAT rates (basis points) per jurisdiction.
- `issueTaxBundle` / `verifyTaxBundle` — prove the declaration (inclusion + mapping + chain + anchor + recompute) while revealing only the tax figures.
