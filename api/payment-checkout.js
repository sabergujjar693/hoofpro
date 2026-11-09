import {endpoint,method,originCheck,rateLimit,cookie,hash,db,rpc,env,json,HttpError} from '../server/core.js';
import {stripeClient} from '../server/payments.js';
export default endpoint(async(req,res)=>{
 method(req,['POST']);originCheck(req);await rateLimit(req,'payment',10);const stripe=stripeClient();
 const token=cookie(req,'hoofpro_receipt');if(!/^[0-9a-f-]{36}$/i.test(token))throw new HttpError(401,'Your order receipt is required.');
 const rows=await db('orders?receipt_hash=eq.'+hash(token)+'&created_at=gte.'+encodeURIComponent(new Date(Date.now()-86400000).toISOString())+'&select=*');const order=rows[0];
 if(!order)throw new HttpError(404,'Recent order not found.');
 let reservation=await rpc('reserve_payment_session',{p_order_id:order.id});if(Array.isArray(reservation))reservation=reservation[0];
 let session;
 if(reservation.stripe_session_id){session=await stripe.checkout.sessions.retrieve(reservation.stripe_session_id);}
 else{
  if(Date.now()-new Date(reservation.created_at).getTime()>23*3600000)throw new HttpError(409,'The checkout window expired. Contact the store before paying.');
  const d=order.details;
  session=await stripe.checkout.sessions.create({mode:'payment',customer_email:d.customer.email,client_reference_id:order.id,metadata:{order_id:order.id,reservation_id:reservation.id},
   line_items:[...d.items.map(i=>({quantity:i.quantity,price_data:{currency:'aud',unit_amount:i.unitCents,product_data:{name:i.name+(i.variant?' — '+i.variant:'')}}})),...(d.shippingCents?[{quantity:1,price_data:{currency:'aud',unit_amount:d.shippingCents,product_data:{name:'Shipping'}}}]:[])],
   success_url:new URL('/confirmation?payment=return',env('SITE_URL')).href,cancel_url:new URL('/confirmation?payment=cancelled',env('SITE_URL')).href
  },{idempotencyKey:'hoofpro-checkout/'+reservation.id});
  await db('payment_sessions?id=eq.'+reservation.id,{method:'PATCH',body:{stripe_session_id:session.id}});
 }
 if(session.status!=='open'||!session.url?.startsWith('https://checkout.stripe.com/'))throw new HttpError(409,'Checkout is no longer open. Refresh your receipt or contact the store.');
 json(res,200,{url:session.url});
});
