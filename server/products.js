import {db,HttpError} from './core.js';
export function publicProduct(row){return {...row.data,id:row.id,price:row.price_cents/100,stock:row.stock,saleEnabled:row.sale_enabled,managed:true,updatedAt:row.updated_at};}
export async function productRows(){return db('store_products?select=*&order=id.asc');}
export async function orderCatalogue(){return (await productRows()).filter(p=>p.active).map(publicProduct);}
export function validateProduct(input,old){
 if(!input||typeof input!=='object')throw new HttpError(400,'Invalid product.');
 const data={...old.data};
 for(const [field,max] of [['name',120],['description',3000],['purpose',500]]){
  if(typeof input[field]!=='string'||!input[field].trim()||input[field].length>max||/[\u0000-\u001f]/.test(input[field]))throw new HttpError(400,'Enter a valid '+field+'.');data[field]=input[field].trim();
 }
 if(!Number.isInteger(input.priceCents)||input.priceCents<1||input.priceCents>10000000)throw new HttpError(400,'Enter a valid AUD price.');
 if(input.stock!==null&&(!Number.isInteger(input.stock)||input.stock<0||input.stock>1000000))throw new HttpError(400,'Enter a valid available quantity, or leave blank for availability on request.');
 if(typeof input.active!=='boolean'||typeof input.saleEnabled!=='boolean')throw new HttpError(400,'Invalid product visibility.');
 if(data.variantDetails){
  if(!input.variantPrices||typeof input.variantPrices!=='object')throw new HttpError(400,'Enter all variant prices.');
  data.variantDetails=Object.fromEntries(Object.entries(data.variantDetails).map(([name,value])=>{
   const cents=input.variantPrices[name];if(!Number.isInteger(cents)||cents<1||cents>10000000)throw new HttpError(400,'Invalid variant price.');return [name,{...value,price:cents/100}];
  }));
 }
 data.price=input.priceCents/100;data.priceStatus='store';
 if(!['unverified','included','not-registered'].includes(input.gstStatus))throw new HttpError(400,'Choose a GST setting.');data.gstStatus=input.gstStatus;
 // Photo metadata is chosen from images already attached by the server, not arbitrary URLs.
 if(input.imageIds!==undefined){if(!Array.isArray(input.imageIds)||input.imageIds.length>20||new Set(input.imageIds).size!==input.imageIds.length)throw new HttpError(400,'Invalid gallery.');data.images=input.imageIds.map(id=>{const photo=(old.data.images||[]).find(p=>p.id===id);if(!photo)throw new HttpError(400,'Unknown photo.');return photo;});}
 return data;
}
