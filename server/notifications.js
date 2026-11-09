import {db,rpc,external,env} from './core.js';
const aud=cents=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(cents/100);
export function emailFor(order,job){
 const d=order.details,c=d.customer;
 const address=[c.street,c.unit,`${c.suburb}, ${c.state} ${c.postcode}`,c.country].filter(Boolean).join('\n');
 return {from:job.sender,to:[job.recipient],subject:job.kind==='owner'?`New unpaid order ${order.number}`:`HoofPro order received: ${order.number} — unpaid`,text:[
  job.kind==='owner'?'A new order has been saved.':'Thank you. Your order has been saved.',
  `Order: ${order.number}`,`Date: ${new Date(order.created_at).toLocaleString('en-AU',{timeZone:'Australia/Melbourne'})} (Australia/Melbourne)`,
  'Payment status at order submission: Unpaid. This order-submission email is not a payment receipt. Refer to your secure order receipt for the current verified payment status.',
  `Customer: ${c.first} ${c.last}`,`Email: ${c.email}`,`Phone: ${c.phone}`,'Delivery:',address,'Products:',
  ...d.items.map(i=>`${i.name}${i.variant?' — '+i.variant:''}: ${i.quantity} × ${aud(i.unitCents)} = ${aud(i.lineCents)}`),
  `Subtotal: ${aud(d.subtotalCents)}`,`Shipping: ${aud(d.shippingCents)}`,`Total: ${aud(d.totalCents)} AUD`,
  'The store will contact you about availability and payment arrangements. Do not send card details by email.'
 ].join('\n\n')};
}
export async function dispatch(orderId=null,limit=2){
 const jobs=await rpc('claim_order_notifications',{p_order_id:orderId,p_limit:limit});const result={accepted:0,retry:0,failed:0};
 for(const job of jobs){
  try{
   const orders=await db('orders?id=eq.'+job.order_id+'&select=number,created_at,details');if(!orders.length)throw new Error('Order missing');
   const response=await external('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env('RESEND_API_KEY'),'Content-Type':'application/json','Idempotency-Key':'hoofpro-order/'+job.id},body:JSON.stringify(emailFor(orders[0],job))});
   const data=await response.json().catch(()=>({}));
   if(response.ok&&typeof data.id==='string'){
    await rpc('finish_order_notification',{p_id:job.id,p_lease:job.lease_token,p_state:'sent',p_provider_id:data.id,p_error:null});result.accepted++;
   }else{
    const permanent=response.status>=400&&response.status<500&&![408,409,429].includes(response.status);
    const failed=permanent||job.attempts>=10;
    await rpc('finish_order_notification',{p_id:job.id,p_lease:job.lease_token,p_state:failed?'failed':'pending',p_provider_id:null,p_error:`Email provider HTTP ${response.status}.`});result[failed?'failed':'retry']++;
   }
  }catch{
   // A crash during acknowledgement may leave a lease. The queue reclaims it
   // with the same provider idempotency key, never a new order or email key.
   try{await rpc('finish_order_notification',{p_id:job.id,p_lease:job.lease_token,p_state:job.attempts>=10?'failed':'pending',p_provider_id:null,p_error:'Temporary delivery or acknowledgement failure.'});}catch{/* Lease expiry is the durable fallback. */}result.retry++;
  }
 }
 return result;
}
