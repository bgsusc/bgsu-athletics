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

function doExport(){
  const keys=['name','pos','yr','age','approachJump','cmjHeight','courtSprint','laneAgility','peakPower','rsi','asymmetry','eccRFD','concImpulse','eccImpulse','contractionTime','mileRun','frontSquatMax','benchMax','composite','tier'];
  // Blank for missing/non-finite numbers (never "NaN"); quote cells containing a comma, quote or newline.
  const cell=v=>{if(v==null||(typeof v==='number'&&!Number.isFinite(v)))return '';const s=String(v);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const rows=[keys,...context.api.rosterAthletes().map(a=>keys.map(k=>a[k]))];
  const a2=document.createElement('a');a2.href='data:text/csv,'+encodeURIComponent(rows.map(r=>r.map(cell).join(',')).join('\n'));a2.download='bgsu-mens-basketball-sc.csv';a2.click();
}

return Object.defineProperties({}, {
  doExport: {enumerable:true, configurable:true, get:()=>doExport}
});
}
