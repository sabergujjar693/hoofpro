# Public image loading fix

The default catalogue now renders on public hostnames without IndexedDB. Vite copies all public assets into dist, and Vercel has a React Router fallback. The optional photo manager remains local to a browser. This supersedes earlier local-only default-image build instructions; no deployment was performed.

## Verified primary matches

| Product | Public image URL |
| --- | --- |
| Hoof Nippers | `/images/hoof%20kniper.jpeg` |
| Hoof Knife | `/images/hook%20knife.jpeg` |
| Hoof Rasp | `/images/Hoof%20Rasp.jpeg` |
| Rasp Handle | `/images/products/rasp-handle/rasp-handle-01.webp` |
| Hoof Stand | `/images/Hoof%20Stand.jpeg` |
| Hoof Testers | `/images/products/hoof-testers/hoof-testers-01.webp` |
| Farrier Shoe Puller | `/images/products/farrier-shoe-puller/farrier-shoe-puller-01.webp` |
| Crease Nail Puller | `/images/products/crease-nail-puller/crease-nail-puller-01.webp` |
| Clinch Cutter | `/images/products/clinch-cutter/clinch-cutter-01.webp` |
| Clincher | `/images/products/clincher/clincher-01.webp` |
| Driving Hammer | `/images/products/driving-hammer/driving-hammer-01.webp` |
| Horseshoe Nails | `/images/products/horseshoe-nails/horseshoe-nails-01.webp` |
| Short Leather Farrier Chaps | `/images/products/short-farrier-chaps/short-farrier-chaps-01.webp` |
| Long Reinforced Leather Farrier Chaps | `/images/products/long-farrier-chaps/long-farrier-chaps-01.webp` |
| Leather Farrier Tool Roll | `/images/products/leather-tool-roll/leather-tool-roll-01.webp` |

The four readable JPEG filenames were confirmed visually as nippers, a hooked hoof knife with wooden handle, a handled rasp and a hoof stand. Existing mappings for the other 11 products were retained, based on the prior visual inventory, rather than inferred from opaque filenames. Additional original JPEGs depict those same products (including duplicate nipper, rasp, stand and hoof-tester images); no images remain unidentified. No brand, model or knife handedness was inferred.

Original image files were not edited, renamed, overwritten or deleted. Prices and catalogue behavior are unchanged.

## Validation

- `npm run build` passed.
- `node scripts/check-catalogue.cjs` passed.
- `scripts/check-public-images.cjs` passed against the production preview on a simulated public hostname with IndexedDB unavailable: all 15 product images and dimensions, homepage, shop, categories, related cards, full-screen viewer and cart.
