import {endpoint,method,originCheck,bodyOf,rateLimit,external,env,admin,setCookie,json,HttpError} from '../server/core.js';
export default endpoint(async(req,res)=>{
 method(req,['GET','POST','DELETE']);
 if(req.method==='GET'){const user=await admin(req);return json(res,200,{email:user.email});}
 originCheck(req);
 if(req.method==='DELETE'){setCookie(res,'hoofpro_admin','',0);return json(res,200,{ok:true});}
 await rateLimit(req,'login',8);const body=await bodyOf(req);
 if(typeof body?.email!=='string'||body.email.length>254||typeof body.password!=='string'||body.password.length<8||body.password.length>256)throw new HttpError(400,'Enter your admin email and password.');
 const response=await external(env('SUPABASE_URL')+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env('SUPABASE_PUBLISHABLE_KEY'),'Content-Type':'application/json'},body:JSON.stringify({email:body.email.trim(),password:body.password})});
 if(!response.ok)throw new HttpError(401,'Unable to sign in. Check your credentials.');const session=await response.json();
 await admin({...req,headers:{...req.headers,cookie:'hoofpro_admin='+encodeURIComponent(session.access_token)}});
 setCookie(res,'hoofpro_admin',session.access_token,Math.min(session.expires_in||3600,3600));return json(res,200,{ok:true});
});
