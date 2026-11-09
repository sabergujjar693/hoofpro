import {orderCatalogue} from '../server/products.js';
import {endpoint,method,originCheck,env,bodyOf,rateLimit,validateOrder,hash,rpc,db,cookie,setCookie,json,HttpError,receipt} from '../server/core.js';
export default endpoint(async(req,res)=>{
 method(req,['POST','GET']);
 if(req.method==='GET'){
  const token=cookie(req,'hoofpro_receipt');if(!/^[0-9a-f-]{36}$/i.test(token))throw new HttpError(404,'No recent order receipt.');
  const rows=await db('orders?receipt_hash=eq.'+hash(token)+'&created_at=gte.'+encodeURIComponent(new Date(Date.now()-86400000).toISOString())+'&select=id,number,created_at,status,payment_status,details&limit=1');
  if(!rows.length)throw new HttpError(404,'No recent order receipt.');return json(res,200,{order:receipt(rows[0])});
 }
 originCheck(req);if(env('ORDERING_ENABLED')!=='true')throw new HttpError(503,'Online ordering is not yet enabled. Please contact the store.');
 // Fail closed until both persistent storage and the real email sender are configured.
 env('RESEND_API_KEY');env('ORDER_FROM_EMAIL');env('CRON_SECRET');
 const key=req.headers['idempotency-key'];if(typeof key!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))throw new HttpError(400,'A valid submission key is required.');
 await rateLimit(req,'checkout',20);const input=await bodyOf(req);if(input?.website)throw new HttpError(400,'Unable to submit order.');
 const details=validateOrder(input,await orderCatalogue());const fingerprint=hash(JSON.stringify({customer:details.customer,items:details.items.map(({productId,variant,quantity})=>({productId,variant,quantity}))}));
 const saved=await rpc('create_store_order',{p_key:key,p_hash:fingerprint,p_details:details,p_receipt_hash:hash(key),p_owner:env('ORDER_NOTIFICATION_EMAIL'),p_sender:env('ORDER_FROM_EMAIL')});
 const order=Array.isArray(saved)?saved[0]:saved;
 setCookie(res,'hoofpro_receipt',key,86400);
 // The database transaction queued both emails; the protected cron processes them.
 return json(res,201,{order:receipt(order)});
});
