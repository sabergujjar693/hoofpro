import Stripe from 'stripe';
import {env,HttpError} from './core.js';
export function paymentsEnabled(){return process.env.STRIPE_CHECKOUT_ENABLED==='true'&&(process.env.STRIPE_MODE==='test'||(process.env.STRIPE_MODE==='live'&&process.env.STRIPE_LIVE_APPROVED==='true'));}
export function stripeClient(){
 if(!paymentsEnabled())throw new HttpError(503,'Online payment is not enabled. Your order remains unpaid.');
 const key=env('STRIPE_SECRET_KEY');const mode=env('STRIPE_MODE');
 if(!key.startsWith(mode==='live'?'sk_live_':'sk_test_'))throw new HttpError(503,'Payment account mode is not configured correctly.');
 return new Stripe(key,{timeout:8000,maxNetworkRetries:1});
}
export function paymentState(event,session){
 if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded')return session.payment_status==='paid'?'Paid':'Unpaid';
 if(event.type==='checkout.session.async_payment_failed')return 'Failed';
 if(event.type==='checkout.session.expired')return 'Unpaid';return null;
}
