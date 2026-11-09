import {paymentsEnabled} from '../server/payments.js';
import {endpoint,method,json} from '../server/core.js';
import {productRows,publicProduct} from '../server/products.js';
export default endpoint(async(req,res)=>{method(req,['GET']);const rows=await productRows();json(res,200,{products:rows.filter(p=>p.active).map(publicProduct),orderingEnabled:process.env.ORDERING_ENABLED==='true',paymentsEnabled:paymentsEnabled()});});
