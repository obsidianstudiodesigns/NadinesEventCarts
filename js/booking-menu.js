// Nadine's Charcuterie Cart booking menu and mini cake range, copied from her
// "Client enquiry and booking form" (NADINE'S CHARCUTERIE CART.pdf) and mini cake order form, October 2026.
// Prices are rands per person.

export const TRAVEL_FEE = 1500;   // travelling, cart setup and breakdown, and 3 hours hosting
export const GUESTS = { min: 15, max: 50 };
export const ORDER_NOTICE_DAYS = 3; // mini cakes

const CHEESE = ['Cheddar', 'Gouda', 'Camembert sliced', 'Blue', 'Cream cheese balls coated in nuts and cranberries'];
const MEATS = ['Smoked chicken fillet slices', 'Peppered salami', 'Country ham sliced', 'Beef pastrami'];
const FRUIT = ['Strawberries', 'Grapes', 'Blueberries'];
const BREADS = ['Ciabatta slices', 'French baguette slices', 'Salted crackers with pepper', 'Wholewheat crackers', 'Mixed nut selection', 'Rice crackers'];
const SPREADS = ['Hot honey', 'Blueberry jam', 'Honey drizzle', 'Spicy hummus, served in individual portions'];
const SWEETS = ['Lindt chocolate balls', 'Nougat squares', 'Caramel popcorn'];

export const EXPERIENCES = {
  classic: {
    label: 'Classic',
    price: 195,
    groups: [
      { id: 'cheese', title: 'Cheese selection', choose: 3, items: CHEESE },
      { id: 'meats', title: 'Cured and smoked cold meats', choose: 3, items: [...MEATS, 'Dried wors sticks', 'Biltong, thickly sliced'] },
      {
        id: 'fruit', title: 'Fruit and vegetables', choose: 3, note: 'Beautifully arranged on cocktail sticks',
        items: [...FRUIT, 'Dried fruit stick', 'Cocktail tomatoes', 'Cucumber sticks (baby cucumbers)', 'Marinated olives'],
      },
      { id: 'breads', title: 'Breads and biscuits', choose: 2, items: BREADS },
      { id: 'spreads', title: 'Drizzles, spreads and dips', choose: 2, items: [...SPREADS, 'Creamed feta and garlic dip, served in individual portions'] },
      { id: 'sweets', title: 'Sweets', choose: 1, note: 'Individually wrapped', items: [...SWEETS, 'Fudge squares'] },
    ],
  },
  deluxe: {
    label: 'Deluxe',
    price: 230,
    groups: [
      { id: 'cheese', title: 'Cheese selection', choose: 3, items: [...CHEESE, 'Brie', 'Emmentaler'] },
      { id: 'meats', title: 'Cured and smoked cold meats', choose: 3, items: [...MEATS, 'Hickory ham', 'Biltong, thickly sliced', 'Chorizo sausage slices'] },
      {
        id: 'fruit', title: 'Fruit and vegetables', choose: 3, note: 'Beautifully arranged on cocktail sticks',
        items: [...FRUIT, 'Cocktail tomatoes', 'Cucumber sticks (baby cucumbers)', 'Marinated olives', 'Peppadews filled with cream cheese',
          'Cocktail tomato, mozzarella slice and basil leaf drizzled with balsamic reduction', 'Dried pears', 'Orange slices'],
      },
      { id: 'breads', title: 'Breads and biscuits', choose: 2, items: [...BREADS, 'Quiche Lorraine, individual serving', 'Rissoles, spinach and feta', 'Mini croissant'] },
      {
        id: 'spreads', title: 'Dips, drizzles and spreads', choose: 2,
        items: [...SPREADS, 'Whipped feta and garlic dip, individual portions', 'Bacon jam, individual portion', 'Mushroom pâté, individual portion', 'Cream cheese and sweet chilli dip'],
      },
      {
        id: 'sweets', title: 'Sweets', choose: 1, note: 'Individually wrapped',
        items: [...SWEETS, 'Date bites (cinnamon cream cheese filled dates)', 'Fudge squares', 'Macaroons', 'Cinnamon churros dipped in chocolate'],
      },
    ],
  },
};

// Optional for both experiences, R50 per person each.
export const EXTRAS = [
  {
    id: 'drinks', title: 'Drinks', price: 50, note: 'Elegantly served in stemmed glasses', none: 'No drinks',
    items: ['Champagne', 'Orange juice with sparkling water', 'Sparkling red grape juice', 'Sparkling white grape juice'],
  },
  {
    id: 'desserts', title: 'Desserts', price: 50, note: 'Served in individual portions', none: 'No desserts',
    items: ['Tiramisu cups', 'Chocolate mousse with black cherry compote', 'Cheesecake cups with berry compote', 'Lemon curd cup'],
  },
];

export const MINI_CAKES = [
  { name: 'Rich chocolate', detail: 'Mocha mousse, chocolate chips and a drizzle of chocolate syrup' },
  { name: 'Vanilla', detail: 'Cream mousse, sprinkles and condensed milk drizzle' },
  { name: 'Cappuccino', detail: 'Coffee cream mousse, crumbed Oreo biscuits and a chocolate syrup drizzle' },
  { name: 'Black Forest', detail: 'Chocolate cake topped with cherry filling and vanilla cream, drizzled with a dark cherry chocolate syrup' },
  { name: 'Spicy carrot cake', detail: 'Cinnamon vanilla mousse sprinkled with crushed nuts and a light cinnamon pineapple drizzle' },
  { name: 'Moist red velvet', detail: 'Ermine frosting topped with crushed cookies and condensed milk drizzle' },
  { name: 'Moist vanilla', detail: 'A soft rose lemonade frosting topped with crushed pistachios and sugared rose petals' },
];
