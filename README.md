# Tresor V2 Website

A responsive Next.js mock implementation of the **Tresor — Art Direction v2** Figma screens.

## Stack
- Next.js App Router + TypeScript
- Framer Motion
- Lucide React
- CSS variables + responsive CSS
- Local state + localStorage cart

## Customer flows
Home → Menu → Semantic-style search → Product → Cart → Checkout → Mock payment → Order confirmation → Tracking.

Additional pages: About, Contact, Account.

## Run
```bash
npm install
npm run dev
```

## Config
Copy `.env.example` to `.env.local` and replace the Zomato / Swiggy URLs with the actual restaurant listing URLs.

## Notes
Product photography is represented by local editorial placeholders because the Figma v2 reference does not contain actual Tresor photography. Replace those blocks with local assets when supplied.
Payment is explicitly simulated; no real transaction is performed.
