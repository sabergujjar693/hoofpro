import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {products,type Product} from './catalogue';
export type Photo={id:string;src:string;alt:string;originalName:string;source:string;permission:string;variant?:string;blob?:Blob};
type PhotoMap=Record<string,Photo[]>;
export const isLocalReview=()=>typeof window!=='undefined'&&['localhost','127.0.0.1','[::1]'].includes(window.location.hostname);
const DB='hoofpro-local-product-photos';
function openDB():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('products');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Close other HoofPro tabs to update photo storage.'));});}
async function readPhotos():Promise<PhotoMap>{const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('products','readonly');const store=tx.objectStore('products');const result:PhotoMap={};const cursor=store.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){const saved=c.value;result[String(c.key)]=Array.isArray(saved)?(products.find(p=>String(p.id)===String(c.key))?.images||[]):saved.photos;c.continue();}};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};});}
export async function persistPhotos(id:number,photos:Photo[]){const db=await openDB();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('products','readwrite');tx.objectStore('products').put({revision:'pictures-2026-11-10',photos:photos.map(p=>({...p,src:p.blob?'':p.src}))},String(id));tx.oncomplete=()=>{db.close();resolve();};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||new Error('Photo save aborted'));};});}
type PhotoContext={photos:PhotoMap;ready:boolean;error:string;update:(id:number,p:Photo[])=>void;save:(id:number)=>Promise<void>;objectURL:(blob:Blob)=>string};
const C=createContext<PhotoContext|null>(null);
export function PhotoProvider({children}:{children:React.ReactNode}){
 const[photos,setPhotos]=useState<PhotoMap>({});const[ready,setReady]=useState(false);const[error,setError]=useState('');const urls=useRef<string[]>([]);
 const objectURL=(blob:Blob)=>{const url=URL.createObjectURL(blob);urls.current.push(url);return url;};
 useEffect(()=>{let active=true;if(!isLocalReview()){setReady(true);return;}const defaults:PhotoMap=Object.fromEntries(products.map(p=>[p.id,p.images||[]]));setPhotos(defaults);readPhotos().then(stored=>{if(!active)return;for(const id of Object.keys(stored)){stored[id]=stored[id].filter(photo=>!['3p-farrier-chaps-full','3p-farrier-chaps-pockets','3p-farrier-chaps-waist-clip'].includes(photo.id));for(const p of stored[id])if(p.blob)p.src=objectURL(p.blob);}setPhotos({...defaults,...stored});setReady(true);}).catch(()=>{if(active){setError('Browser photo storage is unavailable. Existing local photos remain visible; uploads cannot be saved.');setReady(true);}});return()=>{active=false;urls.current.forEach(URL.revokeObjectURL);urls.current=[];};},[]);
 const update=(id:number,list:Photo[])=>{if(isLocalReview())setPhotos(prev=>({...prev,[id]:list}));};
 const save=async(id:number)=>{if(!isLocalReview()||!ready||error)throw new Error('Local browser storage is unavailable');await persistPhotos(id,photos[id]||[]);};
 return <C.Provider value={{photos,ready,error,update,save,objectURL}}>{children}</C.Provider>;
}
export function usePhotoManager(){const context=useContext(C);if(!context)throw new Error('PhotoProvider missing');return context;}
export function useProductPhotos(p:Product,variant?:string){const c=useContext(C);const list=c?.photos[p.id]||[];return list.filter(photo=>p.id===7&&p.variants.length>0?!!photo.variant&&(photo.variant==='*'||photo.variant===variant):!photo.variant||photo.variant==='*'||photo.variant===variant);}
