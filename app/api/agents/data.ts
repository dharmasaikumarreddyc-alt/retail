// Data layer for the food and beverage catalog available in this app.

export interface Merchant {
  id: string;
  name: string;
  type: string;
  category: string[];
  distance: string;
  rating: number;
  image: string;
  offers: string[];
  prepTime: string;
  address: string;
  isOpen: boolean;
  aiReason?: string;
}

export interface Product {
  id: string;
  merchantId: string;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
  tags: string[];
  inStock: boolean;
  quantity: number;
  originalPrice?: number;
  discount?: number;
  rating?: number;
  aiReason?: string;
}

// =====================================================
// LOCAL FOOD & BEVERAGE MERCHANTS (Original)
// =====================================================
export const localMerchantsDB: Merchant[] = [
  {
    id: 'cafe-verde',
    name: 'Starbucks Coffee Company',
    type: 'Coffee Shop',
    category: ['coffee', 'cafe', 'breakfast', 'vegan', 'healthy'],
    distance: '0.1 mi',
    rating: 4.7,
    image: '/images/products/cafe-verde.jpg',
    offers: ['10% off orders above $10', 'Free coffee with breakfast combo'],
    prepTime: '7-10 min',
    address: '3550 Lenox Rd NE, Atlanta, GA 30326',
    isOpen: true,
  },
  {
    id: 'bean-scene-coffee',
    name: 'Truffles Cafe',
    type: 'Coffee Shop',
    category: ['coffee', 'cafe', 'breakfast', 'bakery'],
    distance: '0.3 mi',
    rating: 4.8,
    image: '/images/products/bean-scene-coffee.jpg',
    offers: ['Happy Hour 3-5 PM: 20% off', 'Student discount 15%'],
    prepTime: '5-10 min',
    address: '3500 Lenox Rd NE, Atlanta, GA 30326',
    isOpen: true,
  },
  {
    id: 'green-leaf-bistro',
    name: 'Tower Cafe',
    type: 'Health Restaurant',
    category: ['salads', 'healthy', 'vegan', 'lunch', 'organic'],
    distance: '0.2 mi',
    rating: 4.5,
    image: '/images/products/green-leaf-bistro.jpg',
    offers: ['Buy 1 Get 1 on salads (Mon-Wed)', '15% off organic items'],
    prepTime: '12-18 min',
    address: '3530 Lenox Rd NE, Atlanta, GA 30326',
    isOpen: true,
  },
  {
    id: 'daily-fresh-mart',
    name: "Peet's Coffee & Tea",
    type: 'Coffee Shop',
    category: ['coffee', 'tea', 'espresso', 'organic', 'roasts'],
    distance: '0.4 mi',
    rating: 4.6,
    image: '/images/products/daily-fresh-mart.jpg',
    offers: ['Free delivery on all orders', '10% off on first order'],
    prepTime: '5-10 min',
    address: '3393 Peachtree Rd NE, Atlanta, GA 30326',
    isOpen: true,
  },
  {
    id: 'spice-kitchen',
    name: 'Spice Kitchen',
    type: 'Indian Restaurant',
    category: ['indian', 'biryani', 'curry', 'lunch', 'dinner'],
    distance: '0.5 mi',
    rating: 4.6,
    image: '/images/products/curry.jpg',
    offers: ['20% off on Biryani combos', 'Free dessert above $15'],
    prepTime: '15-25 min',
    address: '3580 Lenox Rd NE, Atlanta, GA 30326',
    isOpen: true,
  },
  {
    id: 'south-delight',
    name: 'South Delight',
    type: 'South Indian Restaurant',
    category: ['south indian', 'dosa', 'idli', 'breakfast', 'vegetarian'],
    distance: '0.5 mi',
    rating: 4.7,
    image: '/images/products/dosa.jpg',
    offers: ['Breakfast combo at $7.99', 'Filter coffee free with meals'],
    prepTime: '8-15 min',
    address: '3424 Peachtree Rd NE, Atlanta, GA 30326',
    isOpen: true,
  },
  {
    id: 'sweet-treats-bakery',
    name: 'Sweet Treats Bakery',
    type: 'Bakery',
    category: ['bakery', 'bread', 'pastry', 'cakes', 'desserts', 'cake'],
    distance: '0.6 mi',
    rating: 4.8,
    image: '/images/products/cake.jpg',
    offers: ['15% off on birthday cakes', 'Buy 2 Get 1 on pastries'],
    prepTime: '5-8 min',
    address: '3500 Peachtree Rd NE, Atlanta, GA 30326',
    isOpen: true,
  },
];

// Local food products
export const localProductsDB: Product[] = [
  // Cafe Verde Products (Starbucks)
  { id: 'cv-1', merchantId: 'cafe-verde', name: 'Vegan Avocado Toast', price: 8.50, description: 'Sourdough with smashed avocado, cherry tomatoes & microgreens', image: '/images/products/avocado-toast.jpg', category: 'Breakfast', tags: ['vegan', 'healthy', 'breakfast', 'avocado', 'toast'], inStock: true, quantity: 50 },
  { id: 'cv-2', merchantId: 'cafe-verde', name: 'Oat Milk Latte', price: 5.75, description: 'Double shot espresso with creamy oat milk', image: '/images/products/latte.jpg', category: 'Drinks', tags: ['vegan', 'coffee', 'latte', 'oat'], inStock: true, quantity: 999 },
  { id: 'cv-3', merchantId: 'cafe-verde', name: 'Vegan Buddha Bowl', price: 12.50, description: 'Quinoa, roasted veggies, hummus & tahini dressing', image: '/images/products/buddha-bowl.jpg', category: 'Breakfast', tags: ['vegan', 'healthy', 'protein', 'bowl'], inStock: true, quantity: 30 },
  { id: 'cv-4', merchantId: 'cafe-verde', name: 'Fresh Orange Juice', price: 4.50, description: 'Freshly squeezed orange juice', image: '/images/products/orange-juice.jpg', category: 'Drinks', tags: ['vegan', 'fresh', 'healthy', 'juice', 'orange'], inStock: true, quantity: 50 },
  { id: 'cv-5', merchantId: 'cafe-verde', name: 'Almond Croissant', price: 4.25, description: 'Flaky croissant with almond paste', image: '/images/products/croissant.jpg', category: 'Bakery', tags: ['bakery', 'pastry', 'croissant'], inStock: true, quantity: 40 },
  { id: 'cv-6', merchantId: 'cafe-verde', name: 'Cappuccino', price: 5.50, description: 'Classic cappuccino with steamed milk foam', image: '/images/products/cappuccino.jpg', category: 'Drinks', tags: ['coffee', 'cappuccino'], inStock: true, quantity: 999 },
  { id: 'cv-7', merchantId: 'cafe-verde', name: 'Blueberry Muffin', price: 3.75, description: 'Fresh baked muffin with juicy blueberries', image: '/images/products/blueberry-muffin.jpg', category: 'Bakery', tags: ['bakery', 'muffin', 'blueberry'], inStock: true, quantity: 45 },

  // Bean Scene Coffee Products (Truffles Cafe)
  { id: 'bs-1', merchantId: 'bean-scene-coffee', name: 'Signature Cold Brew', price: 5.50, description: '18-hour slow steeped cold brew', image: '/images/products/cold-brew.jpg', category: 'Drinks', tags: ['coffee', 'cold brew', 'signature'], inStock: true, quantity: 999 },
  { id: 'bs-2', merchantId: 'bean-scene-coffee', name: 'Vegan Breakfast Platter', price: 14.50, description: 'Toast, avocado, mushrooms, tomatoes & hash browns', image: '/images/products/breakfast-platter.jpg', category: 'Breakfast', tags: ['vegan', 'healthy', 'breakfast', 'platter'], inStock: true, quantity: 20 },
  { id: 'bs-3', merchantId: 'bean-scene-coffee', name: 'Espresso Shot', price: 3.50, description: 'Single origin espresso', image: '/images/products/espresso.jpg', category: 'Drinks', tags: ['coffee', 'espresso', 'strong'], inStock: true, quantity: 999 },
  { id: 'bs-4', merchantId: 'bean-scene-coffee', name: 'Pancakes Stack', price: 10.50, description: 'Fluffy pancakes with maple syrup and butter', image: '/images/products/pancakes.jpg', category: 'Breakfast', tags: ['breakfast', 'pancakes', 'sweet'], inStock: true, quantity: 25 },
  { id: 'bs-5', merchantId: 'bean-scene-coffee', name: 'Belgian Waffles', price: 11.00, description: 'Crispy waffles with fresh berries', image: '/images/products/waffles.jpg', category: 'Breakfast', tags: ['breakfast', 'waffles', 'berries'], inStock: true, quantity: 20 },

  // Green Leaf Bistro Products (Tower Cafe)
  { id: 'gl-1', merchantId: 'green-leaf-bistro', name: 'Mediterranean Salad', price: 11.50, description: 'Mixed greens, olives, feta, cucumber & olive oil dressing', image: '/images/products/mediterranean-salad.jpg', category: 'Salads', tags: ['salad', 'healthy', 'mediterranean'], inStock: true, quantity: 30 },
  { id: 'gl-2', merchantId: 'green-leaf-bistro', name: 'Quinoa Power Bowl', price: 13.50, description: 'Protein-packed quinoa with roasted chickpeas & veggies', image: '/images/products/quinoa-bowl.jpg', category: 'Bowls', tags: ['vegan', 'protein', 'healthy', 'bowl', 'quinoa'], inStock: true, quantity: 25 },
  { id: 'gl-3', merchantId: 'green-leaf-bistro', name: 'Smoothie Bowl', price: 10.50, description: 'Acai, banana, berries & granola topping', image: '/images/products/smoothie-bowl.jpg', category: 'Breakfast', tags: ['vegan', 'fruits', 'breakfast', 'smoothie', 'acai'], inStock: true, quantity: 30 },
  { id: 'gl-4', merchantId: 'green-leaf-bistro', name: 'Caesar Salad', price: 10.75, description: 'Crisp romaine with parmesan and croutons', image: '/images/products/caesar-salad.jpg', category: 'Salads', tags: ['salad', 'caesar', 'classic'], inStock: true, quantity: 35 },

  // Daily Fresh Mart Products (Peet's Coffee & Tea)
  { id: 'df-1', merchantId: 'daily-fresh-mart', name: "Major Dickason's Blend", price: 5.25, description: 'Rich, smooth, and complex dark roast coffee', image: '/images/products/cold-brew.jpg', category: 'Drinks', tags: ['coffee', 'dark roast', 'signature'], inStock: true, quantity: 999 },
  { id: 'df-2', merchantId: 'daily-fresh-mart', name: 'Caffe Latte', price: 5.75, description: 'Espresso with steamed milk', image: '/images/products/latte.jpg', category: 'Drinks', tags: ['coffee', 'latte', 'espresso'], inStock: true, quantity: 999 },
  { id: 'df-3', merchantId: 'daily-fresh-mart', name: 'Chai Tea Latte', price: 5.50, description: 'Spiced black tea with steamed milk', image: '/images/products/tea.jpg', category: 'Drinks', tags: ['tea', 'chai', 'latte'], inStock: true, quantity: 999 },
  { id: 'df-4', merchantId: 'daily-fresh-mart', name: 'Iced Mocha', price: 6.25, description: 'Espresso, chocolate, milk over ice', image: '/images/products/mocha.jpg', category: 'Drinks', tags: ['coffee', 'mocha', 'iced'], inStock: true, quantity: 999 },
  { id: 'df-5', merchantId: 'daily-fresh-mart', name: 'Blueberry Scone', price: 3.95, description: 'Fresh baked scone with blueberries', image: '/images/products/blueberry-muffin.jpg', category: 'Bakery', tags: ['bakery', 'scone', 'blueberry'], inStock: true, quantity: 40 },
  { id: 'df-6', merchantId: 'daily-fresh-mart', name: 'Everything Bagel', price: 4.50, description: 'Toasted everything bagel with cream cheese', image: '/images/products/bagel.jpg', category: 'Bakery', tags: ['bakery', 'bagel', 'breakfast'], inStock: true, quantity: 35 },

  // Spice Kitchen Products
  { id: 'sk-1', merchantId: 'spice-kitchen', name: 'Chicken Biryani', price: 14.99, description: 'Fragrant basmati rice with tender chicken pieces', image: '/images/products/chicken-biryani.jpg', category: 'Biryani', tags: ['biryani', 'chicken', 'rice', 'indian'], inStock: true, quantity: 30 },
  { id: 'sk-2', merchantId: 'spice-kitchen', name: 'Veg Biryani', price: 12.99, description: 'Aromatic rice with mixed vegetables', image: '/images/products/veg-biryani.jpg', category: 'Biryani', tags: ['biryani', 'vegetarian', 'rice', 'indian'], inStock: true, quantity: 35 },
  { id: 'sk-3', merchantId: 'spice-kitchen', name: 'Hyderabadi Biryani', price: 15.99, description: 'Authentic Hyderabadi style dum biryani', image: '/images/products/biryani.jpg', category: 'Biryani', tags: ['biryani', 'hyderabadi', 'special', 'indian'], inStock: true, quantity: 25 },
  { id: 'sk-4', merchantId: 'spice-kitchen', name: 'Paneer Butter Masala', price: 13.50, description: 'Rich tomato gravy with soft paneer cubes', image: '/images/products/paneer-butter-masala.jpg', category: 'Curry', tags: ['curry', 'paneer', 'vegetarian', 'indian'], inStock: true, quantity: 30 },
  { id: 'sk-5', merchantId: 'spice-kitchen', name: 'Butter Naan', price: 3.50, description: 'Soft tandoori naan with butter', image: '/images/products/naan.jpg', category: 'Bread', tags: ['bread', 'naan', 'tandoor', 'indian'], inStock: true, quantity: 50 },

  // South Delight Products
  { id: 'sd-1', merchantId: 'south-delight', name: 'Masala Dosa', price: 9.99, description: 'Crispy dosa with spiced potato filling', image: '/images/products/dosa.jpg', category: 'Dosa', tags: ['dosa', 'masala', 'breakfast', 'south indian'], inStock: true, quantity: 40 },
  { id: 'sd-2', merchantId: 'south-delight', name: 'Idli Sambar (3 pcs)', price: 7.99, description: 'Soft steamed idlis with sambar', image: '/images/products/idli-sambar.jpg', category: 'Breakfast', tags: ['idli', 'sambar', 'breakfast', 'south indian'], inStock: true, quantity: 45 },
  { id: 'sd-3', merchantId: 'south-delight', name: 'Filter Coffee', price: 3.50, description: 'Traditional South Indian filter coffee', image: '/images/products/coffee-beans.jpg', category: 'Beverages', tags: ['coffee', 'filter', 'beverage', 'south indian'], inStock: true, quantity: 999 },

  // Sweet Treats Bakery Products
  { id: 'st-1', merchantId: 'sweet-treats-bakery', name: 'Chocolate Cake', price: 32.00, description: 'Rich Belgian chocolate layer cake', image: '/images/products/chocolate-cake.jpg', category: 'Cakes', tags: ['cake', 'chocolate', 'birthday', 'dessert'], inStock: true, quantity: 15 },
  { id: 'st-2', merchantId: 'sweet-treats-bakery', name: 'Vanilla Cake', price: 28.00, description: 'Classic vanilla sponge cake', image: '/images/products/cake.jpg', category: 'Cakes', tags: ['cake', 'vanilla', 'birthday', 'dessert'], inStock: true, quantity: 18 },
  { id: 'st-3', merchantId: 'sweet-treats-bakery', name: 'Red Velvet Cake', price: 35.00, description: 'Creamy red velvet with cream cheese frosting', image: '/images/products/cake.jpg', category: 'Cakes', tags: ['cake', 'red velvet', 'birthday', 'dessert'], inStock: true, quantity: 12 },
  { id: 'st-4', merchantId: 'sweet-treats-bakery', name: 'Donuts Box (6 pcs)', price: 12.99, description: 'Assorted glazed donuts', image: '/images/products/donuts.jpg', category: 'Pastries', tags: ['donuts', 'pastry', 'dessert', 'sweet'], inStock: true, quantity: 30 },
  { id: 'st-5', merchantId: 'sweet-treats-bakery', name: 'Chocolate Croissant', price: 4.50, description: 'Flaky croissant with chocolate filling', image: '/images/products/croissant.jpg', category: 'Pastries', tags: ['croissant', 'chocolate', 'pastry', 'bakery'], inStock: true, quantity: 35 },
  { id: 'st-6', merchantId: 'sweet-treats-bakery', name: 'Fresh Bread Loaf', price: 5.00, description: 'Freshly baked sourdough bread', image: '/images/products/fresh-bread.jpg', category: 'Bakery', tags: ['bread', 'fresh', 'sourdough'], inStock: true, quantity: 40 },
];

// =====================================================
export const merchantsDB: Merchant[] = localMerchantsDB;

// Search merchants and products from the app's food catalog.
export async function searchMerchants(query: string): Promise<Merchant[]> {
  const keywords = query.trim().toLowerCase().split(/\s+/).filter(word => word.length > 2);
  if (keywords.length === 0) return [];

  const matchingLocalMerchants = new Set<string>();
  for (const product of localProductsDB) {
    const searchableText = `${product.name} ${product.description} ${product.category} ${product.tags.join(' ')}`.toLowerCase();
    if (keywords.some(keyword => searchableText.includes(keyword))) {
      matchingLocalMerchants.add(product.merchantId);
    }
  }

  return localMerchantsDB
    .filter(merchant => matchingLocalMerchants.has(merchant.id) || keywords.some(keyword =>
      merchant.category.some(category => category.includes(keyword)) ||
      merchant.type.toLowerCase().includes(keyword) ||
      merchant.name.toLowerCase().includes(keyword)
    ))
    .sort((left, right) => parseFloat(left.distance) - parseFloat(right.distance));
}

// Search products for a specific merchant.
export async function searchProducts(merchantId: string, query: string): Promise<Product[]> {
  if (!localMerchantsDB.some(merchant => merchant.id === merchantId)) return [];
  const keywords = query.trim().toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const products = localProductsDB.filter(product => product.merchantId === merchantId && product.inStock);
  if (keywords.length === 0) return products;

  return products.filter(product => {
    const searchableText = `${product.name} ${product.description} ${product.category} ${product.tags.join(' ')}`.toLowerCase();
    return keywords.some(keyword => searchableText.includes(keyword));
  });
}

// Get all products for a merchant.
export async function getMerchantProducts(merchantId: string): Promise<Product[]> {
  if (!localMerchantsDB.some(merchant => merchant.id === merchantId)) return [];
  return localProductsDB.filter(product => product.merchantId === merchantId && product.inStock);
}

// Legacy sync functions for backward compatibility.
export function searchMerchantsSync(query: string): Merchant[] {
  const q = query.toLowerCase();
  const keywords = q.split(/\s+/).filter(word => word.length > 2);

  return merchantsDB.filter(merchant => {
    return keywords.some(keyword =>
      merchant.category.some(cat => cat.includes(keyword)) ||
      merchant.type.toLowerCase().includes(keyword) ||
      merchant.name.toLowerCase().includes(keyword)
    ) || merchant.category.some(cat => q.includes(cat));
  }).filter(m => m.isOpen);
}

export function searchProductsSync(merchantId: string, query: string): Product[] {
  const q = query.toLowerCase();
  const keywords = q.split(/\s+/).filter(word => word.length > 2);

  const merchantProducts = localProductsDB.filter(p => p.merchantId === merchantId && p.inStock);

  if (keywords.length > 0) {
    return merchantProducts.filter(product =>
      keywords.some(keyword =>
        product.tags.some(tag => tag?.includes(keyword)) ||
        product.name.toLowerCase().includes(keyword) ||
        product.category.toLowerCase().includes(keyword) ||
        product.description.toLowerCase().includes(keyword)
      )
    );
  }

  return merchantProducts;
}

// For backward compatibility
export const productsDB = localProductsDB;
