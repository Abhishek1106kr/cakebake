export type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image: string;
  tag?: string;
  searchTerms: string[];
  dietary?: string[];
  prepMinutes?: number;
  featured?: boolean;
};

export const products: Product[] = [
  { id:'almond-croissant', name:'Almond Croissant', category:'Pastry', description:'Laminated pastry, almond frangipane and toasted flakes.', price:190, image:'c1', tag:'Bestseller', searchTerms:['almond','croissant','nutty','breakfast','pastry','flaky','buttery'], dietary:['Vegetarian'], prepMinutes:8, featured:true },
  { id:'pain-au-chocolat', name:'Pain au Chocolat', category:'Pastry', description:'Dark chocolate wrapped in our signature laminated dough.', price:175, image:'c2', tag:'Crowd favourite', searchTerms:['chocolate','pain','pastry','breakfast','dark chocolate','sweet'], dietary:['Vegetarian'], prepMinutes:8, featured:true },
  { id:'tresor-latte', name:'Tresor Latte', category:'Coffee', description:'Double espresso, silky milk and a little house sweetness.', price:210, image:'c3', tag:'House favourite', searchTerms:['coffee','latte','milk','espresso','creamy','caffeine','hot'], dietary:['Vegetarian'], prepMinutes:6, featured:true },
  { id:'cold-brew', name:'Vanilla Cold Brew', category:'Coffee', description:'Slow-steeped coffee with vanilla cream and ice.', price:240, image:'c4', tag:'Cold', searchTerms:['coffee','cold','cold brew','iced','vanilla','refreshing','caffeine'], dietary:['Vegetarian'], prepMinutes:5, featured:true },
  { id:'basque-cheesecake', name:'Basque Cheesecake', category:'Cake', description:'Caramelised top, soft centre and a pinch of sea salt.', price:320, image:'c5', tag:'New', searchTerms:['cheesecake','cake','creamy','caramelised','dessert','soft'], dietary:['Vegetarian'], prepMinutes:4, featured:true },
  { id:'pistachio-tart', name:'Pistachio Tart', category:'Cake', description:'Pistachio cream, crisp shell and seasonal fruit.', price:290, image:'c6', tag:'Seasonal', searchTerms:['pistachio','tart','fruit','nutty','dessert','cake'], dietary:['Vegetarian'], prepMinutes:6 },
  { id:'chocolate-brownie', name:'Dark Chocolate Brownie', category:'Dessert', description:'Fudgy 70% chocolate brownie with roasted cocoa nibs.', price:160, image:'c7', tag:'Rich', searchTerms:['brownie','chocolate','cocoa','fudgy','dessert','sweet'], dietary:['Vegetarian'], prepMinutes:3, featured:true },
  { id:'citrus-tea', name:'Citrus Iced Tea', category:'Drinks', description:'Black tea, citrus peel and a bright house syrup.', price:180, image:'c8', tag:'Bright', searchTerms:['tea','citrus','iced','refreshing','light','drink'], dietary:['Vegetarian'], prepMinutes:4 },
  { id:'mushroom-toast', name:'Mushroom Sourdough Toast', category:'Savoury', description:'Roasted mushrooms, whipped ricotta, herbs and toasted sourdough.', price:330, image:'c9', tag:'Brunch', searchTerms:['mushroom','toast','sourdough','savoury','brunch','ricotta','herbs'], dietary:['Vegetarian'], prepMinutes:12 },
  { id:'truffle-fries', name:'Truffle Parmesan Fries', category:'Savoury', description:'Crisp fries, parmesan, truffle oil and cracked pepper.', price:280, image:'c10', tag:'Sharing', searchTerms:['fries','truffle','parmesan','snack','sharing','savoury'], dietary:['Vegetarian'], prepMinutes:10 },
  { id:'berry-parfait', name:'Berry Yogurt Parfait', category:'Dessert', description:'Greek yogurt, berry compote, toasted granola and honey.', price:260, image:'c11', tag:'Fresh', searchTerms:['berry','yogurt','parfait','fruit','light','breakfast','honey'], dietary:['Vegetarian'], prepMinutes:5 },
  { id:'matcha-cloud', name:'Matcha Cloud', category:'Drinks', description:'Ceremonial matcha, cold milk and a soft vanilla foam.', price:260, image:'c12', tag:'Trending', searchTerms:['matcha','green','latte','cold','milk','tea','calm'], dietary:['Vegetarian'], prepMinutes:6 },
];

export const categories = ['All', 'Coffee', 'Pastry', 'Cake', 'Dessert', 'Drinks', 'Savoury'];

export const semanticSuggestions = [
  'something chocolatey',
  'a cold coffee',
  'light and refreshing',
  'something for brunch',
  'nutty pastry',
  'not too sweet',
];
