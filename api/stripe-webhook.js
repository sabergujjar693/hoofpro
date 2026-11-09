import {endpoint,method,env,db,rpc,json,HttpError} from '../server/core.js';
import {stripeClient,paymentState} from '../server/payments.js';
export const config={api:{bodyParser:false}};
export async function rawBody(req){const chunks=[];let length=0;for await(const chunk of req){const bytes=Buffer.from(chunk);length+=bytes.length;if(length>1048576)throw new HttpError(413,'Webhook too large.');chunks.push(bytes);}return Buffer.concat(chunks);}
export default endpoint(async(req,res)=>{
 method(req,['POST']);const stripe=stripeClient();let event;
 try{event=stripe.webhooks.constructEvent(await rawBody(req),req.headers['stripe-signature'],env('STRIPE_WEBHOOK_SECRET'));}catch(error){if(error instanceof HttpError)throw error;throw new HttpError(400,'Invalid webhook signature.');}
 if(event.livemode!==(process.env.STRIPE_MODE==='live'))throw new HttpError(400,'Webhook mode mismatch.');
 const session=event.data.object;const state=paymentState(event,session);if(!state)return json(res,200,{received:true});
 if(typeof session.id!=='string'||typeof session.metadata?.order_id!=='string')throw new HttpError(400,'Missing order reference.');
 // Recover a Checkout response/DB-ack race using the private reservation id.
 // A valid signature alone is insufficient: match metadata, amount and currency.
 const orders=await db('orders?id=eq.'+encodeURIComponent(session.metadata.order_id)+'&select=*');const order=orders[0];
 if(!order||session.client_reference_id!==order.id||session.amount_total!==order.details.totalCents||session.currency!=='aud')throw new HttpError(400,'Payment does not match the order.');
 const reservations=await db('payment_sessions?order_id=eq.'+order.id+'&select=*');const reservation=reservations[0];
 if(!reservation||session.metadata.reservation_id!==reservation.id||(reservation.stripe_session_id&&reservation.stripe_session_id!==session.id))throw new HttpError(400,'Unknown payment session.');
 if(!reservation.stripe_session_id)await db('payment_sessions?id=eq.'+reservation.id,{method:'PATCH',body:{stripe_session_id:session.id}});
 await rpc('apply_payment_event',{p_event:event.id,p_order:order.id,p_session:session.id,p_state:state,p_amount:session.amount_total,p_currency:session.currency,p_kind:event.type});
 json(res,200,{received:true});
});
