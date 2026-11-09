import {endpoint,method,originCheck,bodyOf,admin,db,rpc,json,HttpError} from '../server/core.js';
export default endpoint(async(req,res)=>{
 method(req,['GET','PATCH']);const user=await admin(req);
 if(req.method==='PATCH'){
  originCheck(req);const input=await bodyOf(req);
  if(!/^[0-9a-f-]{36}$/i.test(input?.id||'')||!['New','Processing','Shipped','Completed','Cancelled'].includes(input.status)||typeof input.updatedAt!=='string')throw new HttpError(400,'Invalid order update.');
  const order=await rpc('update_store_order',{p_id:input.id,p_status:input.status,p_expected:input.updatedAt,p_actor:user.id});return json(res,200,{order:Array.isArray(order)?order[0]:order});
 }
 const url=new URL(req.url,'http://internal');const page=Number(url.searchParams.get('page')||0);if(!Number.isInteger(page)||page<0||page>100000)throw new HttpError(400,'Invalid page.');
 const orders=await db('orders?select=id,number,created_at,updated_at,status,payment_status,details&order=created_at.desc&limit=25&offset='+page*25);
 const ids=orders.map(o=>o.id);const notifications=ids.length?await db('order_notifications?select=order_id,kind,state,attempts,last_error&order_id=in.('+ids.join(',')+')'):[];
 return json(res,200,{orders:orders.map(o=>({...o,notifications:notifications.filter(n=>n.order_id===o.id)}))});
});
