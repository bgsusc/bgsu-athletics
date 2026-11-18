// Men’s Basketball app module (started from the Men’s Basketball app).
// Dependencies are supplied per application instance, never through window.
export function createModule(context) {
const document=context.document;
const window=context.window;
const Chart=context.Chart;
const XLSX=context.XLSX;
const setTimeout=context.setTimeout;
const clearTimeout=context.clearTimeout;
const requestAnimationFrame=context.requestAnimationFrame;
/* ─── Chart registry ─── */
const CH={};


function kc(id){if(CH[id]){CH[id].destroy();delete CH[id];}}

return Object.defineProperties({}, {
  CH: {enumerable:true, configurable:true, get:()=>CH},
  kc: {enumerable:true, configurable:true, get:()=>kc}
});
}
