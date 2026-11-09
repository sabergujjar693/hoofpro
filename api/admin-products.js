import {endpoint,method,admin,originCheck,bodyOf,db,rpc,json,HttpError} from '../server/core.js';
import {productRows,validateProduct} from '../server/products.js';
export default endpoint(async(req,res)=>{
 method(req,['GET','PATCH']);const user=await admin(req);
 if(req.method==='GET')return json(res,200,{products:await productRows()});
 originCheck(req);const input=await bodyOf(req);
 if(!Number.isInteger(input?.id)||typeof input.updatedAt!=='string')throw new HttpError(400,'Invalid product update.');
 const rows=await db('store_products?id=eq.'+input.id+'&select=*');if(!rows.length)throw new HttpError(404,'Product not found.');
 const data=validateProduct(input,rows[0]);const product=await rpc('manage_store_product',{p_id:input.id,p_data:data,p_price:input.priceCents,p_stock:input.stock,p_active:input.active,p_sale:input.saleEnabled,p_expected:input.updatedAt,p_actor:user.id});
 json(res,200,{product:Array.isArray(product)?product[0]:product});
});
