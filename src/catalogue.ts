import raw from './products.json';
import type {Photo} from './photos';
export type Product={managed?:boolean;stock?:number|null;saleEnabled?:boolean;updatedAt?:string;id:number;name:string;price:number;category:string;purpose:string;description:string;specs:string[];variants:string[];images?:Photo[];historicalSupplierUrl?:string;historicalSupplier?:string;brand?:string;defaultVariant?:string;priceStatus?:string;priceVerifiedOn?:string;gstStatus?:string;supplier?:string;supplierUrl?:string;variantDetails?:Record<string,{price:number;sku:string;supplierAvailable?:boolean;imageSource?:string}>};
export type Item={product:Product;variant:string;quantity:number};
export const products=raw as Product[];
export const defaultVariant=(p:Product)=>p.defaultVariant||p.variants[0]||'';
export function unitPrice(p:Product,variant=defaultVariant(p)){
  if(p.variantDetails){const option=p.variantDetails[variant];if(!option)throw new Error('Unknown product variant');return option.price;}
  if(p.variants.length&&!p.variants.includes(variant))throw new Error('Unknown product variant');
  return p.price;
}
export const money=(n:number)=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n);
export const priceLabel=(p:Product)=>p.priceStatus==='verified'?'Supplier price verified '+p.priceVerifiedOn:p.priceStatus==='store'?'Store price · AUD':'Listed price · confirmation required';
export const gstLabel=(p:Product)=>p.gstStatus==='included'?'GST included':p.gstStatus==='not-registered'?'No GST charged':'GST status to be confirmed';
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export const calc=(items:Item[])=>{const subtotal=round(items.reduce((a,i)=>a+unitPrice(i.product,i.variant)*i.quantity,0));const shipping=subtotal>=150||subtotal===0?0:12.95;return{subtotal,shipping,total:round(subtotal+shipping)}};
export const key=(i:Item)=>`${i.product.id}:${i.variant}`;
export function addItem(items:Item[],product:Product,variant:string,quantity:number):Item[]{
  unitPrice(product,variant);
  if(!Number.isInteger(quantity)||quantity<1||quantity>99)throw new Error('Invalid quantity');
  const item={product,variant,quantity};const exists=items.some(i=>key(i)===key(item));
  return exists?items.map(i=>key(i)===key(item)?{...i,quantity:Math.min(99,i.quantity+quantity)}:i):[...items,item];
}
