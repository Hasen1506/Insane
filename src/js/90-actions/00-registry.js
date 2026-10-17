/* ---------- actions: every data-act / data-form goes through act(), handlers registered per module ---------- */
// v0.8 had one 250-line switch here. WS-0 turned each case into ACT['name']=async(d,el,a)=>{…}, body unchanged:
// d is the element's dataset, el the element, a the action name; db, uid and me are read when the handler runs.
const ACT=Object.create(null);
function act(a,d,el){const h=ACT[a];return h?h(d,el,a):Promise.resolve()}
