import {createServices} from '../src/services/context.js';

export {syntheticAthletes,syntheticSessions} from './fixtures.js';
export function fakeDocument(){
  const elements=new Map();
  const node=()=>({style:{},classList:{add(){},remove(){},contains(){return false;}},innerHTML:'',textContent:'',value:'',addEventListener(){},appendChild(){},click(){},scrollIntoView(){},querySelector(){return null;},querySelectorAll(){return [];}});
  return {getElementById:id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);},createElement:node,addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},body:node(),head:node()};
}
export function services(overrides={}) {
  return createServices({document:fakeDocument(),window:{},config:{},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},report:(_id,error)=>{throw error;},navigate(){},refreshFeature(){},...overrides});
}
