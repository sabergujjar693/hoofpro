import {randomUUID} from 'node:crypto';
import {endpoint,method,admin,originCheck,bodyOf,rateLimit,db,rpc,external,env,json,HttpError} from '../server/core.js';
export default endpoint(async(req,res)=>{
 method(req,['POST']);const user=await admin(req);originCheck(req);await rateLimit(req,'photo-upload',20);
 const input=await bodyOf(req,3000000);
 if(!Number.isInteger(input?.productId)||input.rightsConfirmed!==true||typeof input.base64!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)||typeof input.alt!=='string'||input.alt.trim().length<3||input.alt.length>300||typeof input.updatedAt!=='string')throw new HttpError(400,'Supply an image description and confirm publication rights.');
 const bytes=Buffer.from(input.base64,'base64');if(bytes.length<12||bytes.length>2097152)throw new HttpError(400,'Choose a JPEG, PNG or WebP image up to 2 MB.');
 let ext,type;
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){ext='jpg';type='image/jpeg';}
 else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){ext='png';type='image/png';}
 else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){ext='webp';type='image/webp';}
 else throw new HttpError(400,'Unsupported image format.');
 const rows=await db('store_products?id=eq.'+input.productId+'&select=*');const old=rows[0];if(!old)throw new HttpError(404,'Product not found.');if(old.updated_at!==input.updatedAt)throw new HttpError(409,'Product changed. Refresh and try again.');if((old.data.images||[]).length>=20)throw new HttpError(400,'Gallery limit reached.');
 const id=randomUUID(),path=`${input.productId}/${id}.${ext}`;
 const upload=await external(env('SUPABASE_URL')+'/storage/v1/object/product-images/'+path,{method:'POST',headers:{apikey:env('SUPABASE_SECRET_KEY'),'Content-Type':type,'x-upsert':'false'},body:bytes});
 if(!upload.ok)throw new HttpError(503,'Photo upload failed. Please retry.');
 const photo={id,src:env('SUPABASE_URL')+'/storage/v1/object/public/product-images/'+path,alt:input.alt.trim(),originalName:typeof input.originalName==='string'?input.originalName.slice(0,200):id+'.'+ext,source:'Store administrator upload',permission:'Publication rights confirmed by administrator'};
 try{
  const product=await rpc('manage_store_product',{p_id:old.id,p_data:{...old.data,images:[...(old.data.images||[]),photo]},p_price:old.price_cents,p_stock:old.stock,p_active:old.active,p_sale:old.sale_enabled,p_expected:old.updated_at,p_actor:user.id});
  return json(res,201,{product:Array.isArray(product)?product[0]:product});
 }catch(error){
  // Only the just-created object may be removed after a failed metadata update.
  try{await external(env('SUPABASE_URL')+'/storage/v1/object/product-images',{method:'DELETE',headers:{apikey:env('SUPABASE_SECRET_KEY'),'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]})});}catch{}
  throw error;
 }
});
