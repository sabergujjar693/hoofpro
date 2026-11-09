import {endpoint,method,env,secretEqual,json,HttpError} from '../server/core.js';
import {dispatch} from '../server/notifications.js';
export default endpoint(async(req,res)=>{
 method(req,['GET']);if(!secretEqual(req.headers.authorization,'Bearer '+env('CRON_SECRET')))throw new HttpError(401,'Unauthorized.');
 return json(res,200,await dispatch());
});
