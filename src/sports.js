// Central sports registry. To add a sport: create its independent app folder at the
// repository root (own index.html, package.json, vite config), add an entry below,
// and nothing else: the dev/build/preview tools read this registry (folder = path).
// `path` is relative to the portal and must end with "/". A card only appears when the
// entry is enabled AND an application actually responds at that path.
const hockeyIcon='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 8l16 38c1 3 4 5 8 5h14"/><path d="M20 8h-6"/><ellipse cx="18" cy="54" rx="9" ry="3.5" fill="currentColor" stroke="none"/></svg>';
const baseballIcon='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="32" r="23"/><path d="M18 14c6 8 6 28 0 36M46 14c-6 8-6 28 0 36"/><path d="M20 21l4-2M21 28l4-1M21 36l4 1M20 43l4 2M44 21l-4-2M43 28l-4-1M43 36l-4 1M44 43l-4 2" stroke-width="2.5"/></svg>';
const volleyballIcon='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="32" r="23"/><path d="M32 9c-8 8-10 20-4 30M9 28c12-4 24 0 29 10M44 10c-4 10 0 22 10 28M20 51c4-9 14-14 25-11"/></svg>';

export const sports=[
  {id:'hockey',name:'Hockey',description:'Force plate, readiness, workload and performance analytics.',icon:hockeyIcon,path:'hockey/',enabled:true,order:1},
  {id:'volleyball',name:'Volleyball',description:'Jump testing, readiness, Kinexon workload and leaderboards.',icon:volleyballIcon,path:'volleyball/',enabled:true,order:2},
  {id:'baseball',name:'Baseball',description:'Speed, strength and force plate testing with Trackman exit and pitch velocity.',icon:baseballIcon,path:'baseball/',enabled:true,order:3},
];
