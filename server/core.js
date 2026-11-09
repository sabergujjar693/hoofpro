import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const catalogue=require('../src/products.json');
export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export const hash=value=>createHash('sha256').update(value).digest('hex');
export function env(name){const v=process.env[name];if(!v)throw new HttpError(503,'Ordering service is not configured. Please contact the store.');return v;}
export const secretEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export async function external(url,options={}){try{return await fetch(url,{...options,signal:AbortSignal.timeout(8000)});}catch{throw new HttpError(503,'Service temporarily unavailable. Please retry with the same order.');}}
export async function db(path,{method='GET',body}={}){
 const response=await external(env('SUPABASE_URL')+'/rest/v1/'+path,{method,headers:{apikey:env('SUPABASE_SECRET_KEY'),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.ok){const error=await response.json().catch(()=>({}));if(error.message==='idempotency_conflict')throw new HttpError(409,'This submission key already belongs to a different order. Start a new checkout.');if(['product_unavailable','price_changed','payment_unavailable','payment_session_active','payment_mismatch'].includes(error.message))throw new HttpError(409,'Availability, payment or price changed. Refresh and contact the store if needed.');if(error.message==='status_conflict')throw new HttpError(409,'Order changed. Refresh and try again.');if(error.message==='invalid_transition')throw new HttpError(400,'This status transition is not permitted.');throw new HttpError(503,'Order service unavailable. Your cart has been kept; retry with the same order.');}
 return response.status===204?null:response.json();
}
export const rpc=(name,body)=>db('rpc/'+name,{method:'POST',body});
export function originCheck(req){const expected=new URL(env('SITE_URL')).origin;if(req.headers.origin!==expected||req.headers['sec-fetch-site']==='cross-site')throw new HttpError(403,'Request origin not allowed.');}
export function cookie(req,name){const raw=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));return raw?decodeURIComponent(raw.slice(name.length+1)):'';}
export function setCookie(res,name,value,seconds){const secure=new URL(env('SITE_URL')).protocol==='https:';res.setHeader('Set-Cookie',`${name}=${encodeURIComponent(value)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${seconds}${secure?'; Secure':''}`);}
export async function bodyOf(req,limit=16384){if(!(req.headers['content-type']||'').startsWith('application/json'))throw new HttpError(415,'Use JSON.');let body=req.body;if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>limit)throw new HttpError(413,'Request too large.');}body=raw;}if(Buffer.byteLength(typeof body==='string'?body:JSON.stringify(body))>limit)throw new HttpError(413,'Request too large.');try{return typeof body==='string'?JSON.parse(body):body;}catch{throw new HttpError(400,'Invalid JSON.');}}
export function endpoint(handler){return async(req,res)=>{res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Content-Type-Options','nosniff');try{await handler(req,res);}catch(error){res.statusCode=error instanceof HttpError?error.status:500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:error instanceof HttpError?error.message:'Unable to process request. Please retry.'}));}};}
export function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));}
export function method(req,allowed){if(!allowed.includes(req.method))throw new HttpError(405,'Method not allowed.');}
export async function rateLimit(req,scope,limit){
 // Vercel supplies x-real-ip. Raw addresses are never stored.
 const ip=req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown';
 const key=createHmac('sha256',env('RATE_LIMIT_SECRET')).update(scope+':'+ip).digest('hex');
 if(!await rpc('consume_order_rate',{p_key:key,p_limit:limit}))throw new HttpError(429,'Too many attempts. Please wait 15 minutes and try again.');
}
function text(value,label,min,max){if(typeof value!=='string')throw new HttpError(400,`Enter ${label}.`);const v=value.trim().normalize('NFC');if(v.length<min||v.length>max||/[\u0000-\u001f\u007f]/.test(v))throw new HttpError(400,`Enter a valid ${label}.`);return v;}
export function validateOrder(input,source=catalogue){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new HttpError(400,'Invalid order.');
 const c=input.customer||{};const customer={};
 for(const [key,label,min,max] of [['first','first name',1,80],['last','last name',1,80],['email','email',3,254],['phone','phone',7,30],['street','street address',3,160],['unit','unit',0,80],['suburb','suburb',2,80],['state','state',2,3],['postcode','postcode',4,4]])customer[key]=text(c[key]??'',label,min,max);
 customer.email=customer.email.toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))throw new HttpError(400,'Enter a valid email.');
 if(!/^\+?[0-9 ()-]{7,30}$/.test(customer.phone)||customer.phone.replace(/\D/g,'').length<7)throw new HttpError(400,'Enter a valid phone.');
 if(!['VIC','NSW','QLD','WA','SA','TAS','ACT','NT'].includes(customer.state)||!/^\d{4}$/.test(customer.postcode))throw new HttpError(400,'Enter a valid Australian state and postcode.');
 customer.country='Australia';
 if(!Array.isArray(input.items)||input.items.length<1||input.items.length>30)throw new HttpError(400,'Choose between 1 and 30 items.');
 const seen=new Set();const items=input.items.map(item=>{
  if(!item||!Number.isInteger(item.productId)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>99)throw new HttpError(400,'Invalid product or quantity.');
  const product=source.find(p=>p.id===item.productId);if(!product||product.saleEnabled===false||product.stock===0)throw new HttpError(400,'Product is unavailable for ordering. Please contact the store.');
  const variant=item.variant??'';if(typeof variant!=='string'||(product.variants.length?!product.variants.includes(variant):variant!==''))throw new HttpError(400,'Invalid product variant.');
  const key=product.id+':'+variant;if(seen.has(key))throw new HttpError(400,'Duplicate product lines.');seen.add(key);
  const price=product.variantDetails?product.variantDetails[variant]?.price:product.price;
  const unitCents=Math.round(price*100);if(!Number.isSafeInteger(unitCents)||unitCents<=0)throw new HttpError(400,'Product price is unavailable.');
  return {productId:product.id,name:product.name,variant,quantity:item.quantity,unitCents,lineCents:unitCents*item.quantity};
 }).sort((a,b)=>a.productId-b.productId||a.variant.localeCompare(b.variant));
 const subtotalCents=items.reduce((sum,i)=>sum+i.lineCents,0);const shippingCents=subtotalCents>=15000?0:1295;
 return {customer,items,subtotalCents,shippingCents,totalCents:subtotalCents+shippingCents,currency:'AUD',paymentStatus:'Unpaid'};
}
export async function admin(req){
 const token=cookie(req,'hoofpro_admin');if(!token)throw new HttpError(401,'Please sign in.');
 const response=await external(env('SUPABASE_URL')+'/auth/v1/user',{headers:{apikey:env('SUPABASE_PUBLISHABLE_KEY'),Authorization:'Bearer '+token}});
 if(!response.ok)throw new HttpError(401,'Session expired. Please sign in.');const user=await response.json();
 if(!user.id||!user.email_confirmed_at)throw new HttpError(403,'Admin access denied.');
 if(user.factors?.some(f=>f.status==='verified'))throw new HttpError(403,'This admin account requires an MFA-capable sign-in flow. Contact the store administrator.');
 const allowed=await db('order_admins?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id');if(!allowed.length)throw new HttpError(403,'Admin access denied.');return user;
}
export function receipt(order){return {number:order.number,createdAt:order.created_at,status:order.status,paymentStatus:order.payment_status||'Unpaid',currency:'AUD',items:order.details.items,subtotalCents:order.details.subtotalCents,shippingCents:order.details.shippingCents,totalCents:order.details.totalCents};}
