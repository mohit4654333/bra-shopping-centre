# Smart Product Importer

Zip wale project me ye futher update Krna h  
Do not modify or break my existing website design, pages, or routes. Add a dedicated, smart Bulk CSV/JSON Product Importer tool for admins:

1. NEW ADMIN IMPORTER SCREEN:
- Create an "Import Products" tool accessible in the admin panel (or at `/admin/import`).
- Mobile-friendly File Picker: Allows selecting and uploading .csv or .json files directly from phone storage (e.g. Apify/Zivame exports).

2. SMART COLUMN MAPPING & NESTED FIELD PARSER:
- Auto-detect column headers even if names vary:
  * Title / Name: `title`, `name`, `product_name`
  * Prices: `price`, `currentPrice`, `offer_price`, `originalPrice`, `mrp`
  * Images: handles comma-separated URLs, semicolon-separated, or JSON arrays (extracts all image links into the product gallery)
  * Unique Identifier: `url`, `productUrl`, `id`, `sku`
  * Details: `description`, `brand`, `category`, `sizes`, `colors`

3. 100% DUPLICATE PROTECTION:
- Before inserting any product, check the existing database by `url` or `product_id`.
- If a product already exists, automatically SKIP it (do not create duplicate entries).
- Only insert completely new products.

4. PREVIEW & STATUS SUMMARY:
- Before final database save, show a quick preview counter and table:
  * "Total scanned in file: X"
  * "New products to add: Y"
  * "Duplicates skipped: Z"
- A green "Confirm & Save to Store" button that adds them to the existing products table with progress feedback.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6972cf4b-b40a-463a-a1b2-d9fb0863c014).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
