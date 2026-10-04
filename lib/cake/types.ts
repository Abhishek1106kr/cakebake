// Cake Playground domain. A CakeConfiguration is the product specification:
// the preview renders from it, pricing and rules read it, the bakery bakes from it.
// It is renderer-agnostic, so a future 3D preview reads the same object.

/** ACTIVE: offered. INACTIVE: shown but unavailable. ARCHIVED: hidden; kept so past orders and drafts still resolve. */
export type OptionStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type OptionBase = {
  id: string;
  name: string;
  description?: string;
  status?: OptionStatus;
  /** Price added to the cake (₹). Sample values: see config.ts. */
  price: number;
  available: boolean;
  /** Extra hours of production this option adds. */
  productionHours?: number;
  allergens?: string[];
  /** Ingredient use (inventory ids → kg/L/pcs per cake) so availability can follow real stock. */
  ingredients?: Record<string, number>;
  /** Months (1–12, Bengaluru) the option is in season. Absent = all year. */
  seasonMonths?: number[];
  note?: string;
};

export type SizeOption = OptionBase & { inches: number; servings: string; diameterCm: number; layers: number };
export type ShapeOption = OptionBase & { kind: 'round' | 'square' | 'heart' | 'rectangle' };
export type SpongeOption = OptionBase & { color: string; crumb: string; flavor: string };
export type FillingOption = OptionBase & { color: string };
export type FrostingOption = OptionBase & { sheen: number; soft: boolean };
export type FinishOption = OptionBase & { kind: 'smooth' | 'ruffled' | 'textured' | 'semi-naked' };
export type ColorOption = OptionBase & { hex: string; shade: string };
export type ToppingOption = OptionBase & { kind: 'berry' | 'curl' | 'nut' | 'macaron' | 'flower' | 'gold' | 'cookie' | 'fruit'; maxQuantity: number; perUnit: number; compatibleShapes?: ShapeOption['kind'][]; color: string };
export type DecorationOption = OptionBase & { kind: 'drip' | 'gold-leaf' | 'pearls' | 'piped-border' | 'ribbon' | 'shards' };
export type TopperOption = OptionBase & { kind: 'none' | 'birthday' | 'number' | 'name'; needsText?: boolean; maxChars?: number };
export type CandleOption = OptionBase & { kind: 'none' | 'thin' | 'number' | 'sparkler'; needsText?: boolean };
export type PackagingOption = OptionBase;
export type FontOption = { id: string; name: string; family: string; note: string; lineHeight: number; widthFactor: number; status?: OptionStatus };
export type MessageColorOption = { id: string; name: string; hex: string; status?: OptionStatus };

/** Edible print rules: price, extra hours, resolution (dots per cm), upload limits and the safe-area inset. */
export type PrintRules = { price: number; productionHours: number; minDotsPerCm: number; maxUploadBytes: number; minSourcePx: number; acceptedTypes: string[]; printableInset: number; minSizeInches?: number };

export type OptionGroupId = 'size' | 'shape' | 'sponge' | 'filling' | 'frosting' | 'finish' | 'color' | 'decorations' | 'toppings' | 'topper' | 'candles' | 'packaging' | 'print';

export type CakeMessage = {
  text: string;
  font: string;
  color: string;
  /** Font size as a share of the printable diameter (0.06–0.16). */
  size: number;
  align: 'left' | 'center' | 'right';
  /** Vertical centre within the printable area, 0 (top) – 1 (bottom). */
  y: number;
  rotation: number;
};

export type CakePrint = {
  enabled: boolean;
  /** Reference to the customer's upload in browser storage. Never the image itself. */
  assetId: string | null;
  /** Source pixel size, for print-resolution checks. */
  sourceWidth: number;
  sourceHeight: number;
  /** Centre of the image within the printable area, 0–1. */
  x: number;
  y: number;
  /** Image width as a share of the printable diameter. */
  scale: number;
  rotation: number;
};

export type CakeConfiguration = {
  version: 1;
  size: string;
  shape: string;
  sponge: string;
  filling: string;
  frosting: string;
  finish: string;
  color: string;
  toppings: { id: string; qty: number }[];
  decorations: string[];
  topper: { id: string; text: string };
  candles: { id: string; text: string };
  packaging: string;
  message: CakeMessage;
  print: CakePrint;
  notes: string;
};

export type RuleScope = { [K in keyof Omit<CakeConfiguration, 'version' | 'message' | 'print' | 'notes' | 'toppings' | 'decorations' | 'topper' | 'candles'>]?: string[] } & {
  topping?: string[];
  decoration?: string[];
  topper?: string[];
  candles?: string[];
  print?: boolean;
};

/** A compatibility rule: if `when` matches, the options in `block` are not allowed, with a reason. */
export type CompatibilityRule = { id: string; when: RuleScope; block: RuleScope; reason: string; enabled?: boolean };

export type Issue = { field: OptionGroupId | 'message' | 'print' | 'notes'; level: 'error' | 'warning'; message: string; ruleId?: string };
