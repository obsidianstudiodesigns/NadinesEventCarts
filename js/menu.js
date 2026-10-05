// The cake cart menu, as on Nadine's posters. Plain data so the page can use it without loading 3D.
export const BASES = {
  vanilla: { label: 'Vanilla', color: 0xd29a52, crumb: 0xf0d29a },
  chocolate: { label: 'Chocolate', color: 0x3f2418, crumb: 0x5a3626 },
  'red-velvet': { label: 'Red velvet', color: 0x5e141b, crumb: 0x8e2a31 },
};
export const FROSTINGS = {
  buttercream: { label: 'Buttercream', color: 0xf4e6c8, rough: 0.5, tintable: true },
  chocolate: { label: 'Chocolate', color: 0x5b3425, rough: 0.42, tintable: false },
  vanilla: { label: 'Vanilla', color: 0xfbf5ea, rough: 0.48, tintable: true },
  'cream-cheese': { label: 'Cream cheese', color: 0xf6efe2, rough: 0.55, tintable: true },
};
// Buttercream, vanilla and cream cheese can be coloured to match an event's colour scheme.
export const TINTS = {
  natural: { label: 'Natural', color: null },
  blush: { label: 'Blush', color: 0xf3b7c6 },
  pink: { label: 'Bright pink', color: 0xec5f98 },
  lilac: { label: 'Lilac', color: 0xc9b1e4 },
  mint: { label: 'Mint', color: 0xb9e2cc },
  sky: { label: 'Baby blue', color: 0xb6d6f2 },
};
export const TOPPINGS = {
  rainbow: { label: 'Rainbow sprinkles' },
  hundreds: { label: 'Hundreds and thousands' },
  gold: { label: 'Gold sparkles' },
  shavings: { label: 'Chocolate shavings' },
  nuts: { label: 'Chopped nuts' },
  marshmallows: { label: 'Mini marshmallows' },
  'choc-balls': { label: 'Chocolate balls' },
  flowers: { label: 'Sugar flowers' },
};
export const DRIZZLES = {
  none: { label: 'No drizzle', color: null },
  chocolate: { label: 'Chocolate', color: 0x3a1d12, rough: 0.16 },
  caramel: { label: 'Caramel', color: 0xb5621c, rough: 0.12 },
  'white-chocolate': { label: 'White chocolate', color: 0xf3e7cf, rough: 0.2 },
  strawberry: { label: 'Strawberry', color: 0xd23a5a, rough: 0.12 },
};

