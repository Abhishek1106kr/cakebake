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
  /** Whole cakes carry campaign details; their imagery lives in lib/cake-assets.ts. */
  cake?: CakeDetails;
  /** False when the bakery marks it sold out for now (admin → Products). Absent = available. */
  available?: boolean;
};

export type CakeDetails = {
  slug: string;              // asset folder in the cake registry
  story: string;
  flavorProfile: string[];
  texture: string;
  sweetness: 1 | 2 | 3 | 4 | 5;
  occasion: string[];
  availability: 'Daily' | 'Order 24 h ahead';
  size: string;
  ingredients: string[];
};

/** The menu as shipped in code. Admin product changes are applied on top of this, never to it. */
export const baseProducts: Product[] = [
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
  // ---- Whole cakes (draft copy and prices: confirm with the bakery) ----
  { id:'rose-chocolate-truffle', name:'Rose Chocolate Truffle', category:'Cake', description:'Dark chocolate mousse, almond sponge and a sculpted chocolate rose.', price:2450, image:'cake:rose-truffle', tag:'Signature', searchTerms:['chocolate','chocolatey','rose','celebration','anniversary','rich','cake','dessert'], dietary:['Vegetarian'], prepMinutes:20, featured:true,
    cake:{ slug:'rose-truffle', story:'Our signature. Three layers of dark chocolate mousse and almond sponge, finished with a rose shaped petal by petal from tempered chocolate.', flavorProfile:['Dark chocolate','Almond','Cocoa butter'], texture:'Silky mousse, tender sponge, crisp petals', sweetness:3, occasion:['Anniversary','Celebration'], availability:'Order 24 h ahead', size:'800 g · serves 8–10', ingredients:['70% dark chocolate','Almond sponge','Fresh cream','Cocoa butter','Free-range eggs'] } },
  { id:'chocolate-truffle', name:'Chocolate Truffle', category:'Cake', description:'Deep chocolate sponge, ganache and a chocolate ribbon bow.', price:1950, image:'cake:chocolate-truffle', tag:'Bestseller', searchTerms:['chocolate','chocolatey','truffle','birthday','rich','ganache','cake','dessert'], dietary:['Vegetarian'], prepMinutes:15,
    cake:{ slug:'chocolate-truffle', story:'The cake people come back for: moist chocolate sponge layered with ganache, glazed to a mirror and tied with a chocolate bow.', flavorProfile:['Chocolate','Ganache','Sea salt'], texture:'Fudgy sponge, glossy glaze', sweetness:4, occasion:['Birthday','Everyday'], availability:'Daily', size:'500 g · serves 6–8', ingredients:['Belgian chocolate','Cocoa sponge','Fresh cream','Sea salt'] } },
  { id:'pistachio-cake', name:'Pistachio', category:'Cake', description:'Pistachio praline, milk chocolate mousse and a crisp green base.', price:2250, image:'cake:pistachio', searchTerms:['pistachio','nutty','green','not too sweet','cake','dessert'], dietary:['Vegetarian','Contains nuts'], prepMinutes:15,
    cake:{ slug:'pistachio', story:'Roasted pistachio praline folded into milk chocolate mousse, on a crisp pistachio sablé. Nutty first, chocolate after.', flavorProfile:['Pistachio','Milk chocolate','Praline'], texture:'Airy mousse, crunchy base', sweetness:2, occasion:['Dinner party','Everyday'], availability:'Daily', size:'500 g · serves 6–8', ingredients:['Roasted pistachio','Milk chocolate','Fresh cream','Sablé'] } },
  { id:'black-forest-cherry', name:'Black Forest Cherry', category:'Cake', description:'Chocolate sponge, sour cherry compote and whipped cream.', price:1850, image:'cake:black-forest', searchTerms:['cherry','chocolate','cream','classic','fruity','birthday','cake','dessert'], dietary:['Vegetarian'], prepMinutes:15,
    cake:{ slug:'black-forest', story:'A classic, made lighter: chocolate sponge, sour cherry compote and soft whipped cream under a cherry-red glaze.', flavorProfile:['Sour cherry','Chocolate','Cream'], texture:'Light sponge, soft cream', sweetness:3, occasion:['Birthday','Celebration'], availability:'Daily', size:'500 g · serves 6–8', ingredients:['Sour cherries','Cocoa sponge','Fresh cream','Dark chocolate'] } },
  { id:'hazelnut-crunch', name:'Hazelnut Crunch', category:'Cake', description:'Hazelnut praline crunch, milk chocolate and piped hazelnut cream.', price:2050, image:'cake:hazelnut-crunch', searchTerms:['hazelnut','nutty','crunch','praline','warm','cake','dessert'], dietary:['Vegetarian','Contains nuts'], prepMinutes:15,
    cake:{ slug:'hazelnut-crunch', story:'Caramelised hazelnuts ground into praline, layered with a feuilletine crunch and finished with a ring of piped hazelnut cream.', flavorProfile:['Hazelnut','Caramel','Milk chocolate'], texture:'Crunchy layers, smooth cream', sweetness:3, occasion:['Everyday','Gift'], availability:'Daily', size:'500 g · serves 6–8', ingredients:['Hazelnut praline','Milk chocolate','Feuilletine','Fresh cream'] } },
  { id:'strawberry-cream', name:'Strawberry Cream', category:'Cake', description:'Vanilla sponge, strawberry compote and light cream.', price:1900, image:'cake:strawberry-cream', searchTerms:['strawberry','berry','cream','light','fresh','fruity','birthday','cake','dessert'], dietary:['Vegetarian'], prepMinutes:15,
    cake:{ slug:'strawberry-cream', story:'Soft vanilla sponge with fresh strawberry compote and a cloud of light cream, finished with chocolate tulips.', flavorProfile:['Strawberry','Vanilla','Cream'], texture:'Cloud-light cream, soft sponge', sweetness:3, occasion:['Birthday','Celebration'], availability:'Order 24 h ahead', size:'500 g · serves 6–8', ingredients:['Fresh strawberries','Vanilla sponge','Fresh cream','White chocolate'] } },
  { id:'vanilla-berry', name:'Vanilla Berry', category:'Cake', description:'Vanilla bean mousse with a blueberry and blackcurrant heart.', price:2100, image:'cake:vanilla-berry', searchTerms:['vanilla','berry','blueberry','light','fruity','not too sweet','cake','dessert'], dietary:['Vegetarian'], prepMinutes:15,
    cake:{ slug:'vanilla-berry', story:'Madagascar vanilla mousse around a sharp heart of blueberry and blackcurrant, under a spiral of berry glaze.', flavorProfile:['Vanilla bean','Blueberry','Blackcurrant'], texture:'Silky mousse, jammy centre', sweetness:2, occasion:['Dinner party','Celebration'], availability:'Daily', size:'500 g · serves 6–8', ingredients:['Vanilla bean','Blueberries','Blackcurrant','Fresh cream'] } },
  { id:'mango-passion', name:'Mango Passion', category:'Cake', description:'Alphonso mango mousse, passion fruit curd and coconut sponge.', price:2150, image:'cake:mango-passion', searchTerms:['mango','passion fruit','tropical','fruity','fresh','light','cake','dessert'], dietary:['Vegetarian'], prepMinutes:15,
    cake:{ slug:'mango-passion', story:'Alphonso mango mousse with a bright passion fruit curd and a soft coconut sponge. Summer, cut into slices.', flavorProfile:['Mango','Passion fruit','Coconut'], texture:'Light mousse, tangy curd', sweetness:3, occasion:['Celebration','Everyday'], availability:'Order 24 h ahead', size:'500 g · serves 6–8', ingredients:['Alphonso mango','Passion fruit','Coconut sponge','Fresh cream'] } },
  { id:'salted-caramel', name:'Salted Caramel', category:'Cake', description:'Caramel mousse, salted caramel centre and white chocolate.', price:2000, image:'cake:salted-caramel', searchTerms:['caramel','salted','sweet','warm','white chocolate','cake','dessert'], dietary:['Vegetarian'], prepMinutes:15,
    cake:{ slug:'salted-caramel', story:'Burnt-sugar caramel mousse around a soft salted caramel centre, crowned with a white chocolate disc.', flavorProfile:['Caramel','Sea salt','White chocolate'], texture:'Creamy mousse, molten centre', sweetness:4, occasion:['Birthday','Gift'], availability:'Daily', size:'500 g · serves 6–8', ingredients:['Caramelised sugar','Sea salt','White chocolate','Fresh cream'] } },
];

/**
 * The live storefront menu. Starts as the code menu; lib/catalog replaces it (after
 * hydration) with admin changes applied: prices, copy, sold-out flags, new products,
 * and without disabled or archived ones. Read it at call time, not once at import.
 */
export let products: Product[] = baseProducts;
export function setStorefrontProducts(next: Product[]) { products = next; }

export const categories = ['All', 'Coffee', 'Pastry', 'Cake', 'Dessert', 'Drinks', 'Savoury'];

export const semanticSuggestions = [
  'something chocolatey',
  'a cold coffee',
  'light and refreshing',
  'something for brunch',
  'nutty pastry',
  'not too sweet',
];
