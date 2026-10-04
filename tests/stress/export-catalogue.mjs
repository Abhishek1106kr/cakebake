// Exports the cake catalogue (lib/cake/config.ts) as JSON so the stress harness
// can compute expected prices and lead times independently of the app's engine.
import { build } from 'esbuild';
import { writeFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const out = 'tests/stress/.catalogue.mjs';
await build({ entryPoints: ['lib/cake/config.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' });
const c = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
rmSync(out);
const pick = ({ id, name, price, available, productionHours = 0, seasonMonths = null, ingredients = null, ...rest }) => ({ id, name, price, available, productionHours, seasonMonths, ingredients, ...rest });
const data = Object.fromEntries(['sizes', 'shapes', 'sponges', 'fillings', 'frostings', 'finishes', 'colors', 'toppings', 'decorations', 'toppers', 'candles', 'packaging'].map((k) => [k, c[k].map(pick)]));
Object.assign(data, { rules: c.rules, printRules: c.printRules, messageLimits: c.messageLimits, BASE_PRODUCTION_HOURS: c.BASE_PRODUCTION_HOURS, version: c.CAKE_CONFIG_VERSION });
writeFileSync('tests/stress/catalogue.json', JSON.stringify(data, null, 1));
console.log('catalogue exported:', Object.keys(data).length, 'keys');
