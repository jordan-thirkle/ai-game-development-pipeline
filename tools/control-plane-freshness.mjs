export const DEFAULT_CONTROL_PLANE_MAX_AGE_HOURS=6;

export function evaluateControlPlaneFreshness(state,{now=Date.now(),maxAgeHours=DEFAULT_CONTROL_PLANE_MAX_AGE_HOURS}={}){
  const limit=Number(maxAgeHours);
  if(!Number.isFinite(limit)||limit<=0){
    return {ok:false,status:'invalid-config',classification:'configuration',ageHours:null,maxAgeHours:limit,message:'max age must be a positive number'};
  }

  const generatedAtInput=state?.generatedAt;
  const generatedAt=Date.parse(generatedAtInput);
  if(!Number.isFinite(generatedAt)){
    return {ok:false,status:'invalid-generated-at',classification:'snapshot',ageHours:null,maxAgeHours:limit,message:`has invalid generatedAt: ${generatedAtInput}`};
  }

  const nowMs=typeof now==='number'?now:Date.parse(now);
  if(!Number.isFinite(nowMs)){
    return {ok:false,status:'invalid-now',classification:'configuration',ageHours:null,maxAgeHours:limit,message:`has invalid comparison clock: ${now}`};
  }

  const ageHours=(nowMs-generatedAt)/3_600_000;
  if(ageHours<0){
    return {ok:false,status:'future',classification:'snapshot',ageHours,maxAgeHours:limit,message:`is from the future by ${Math.abs(ageHours).toFixed(2)}h`};
  }
  if(ageHours>limit){
    return {ok:false,status:'stale',classification:'snapshot',ageHours,maxAgeHours:limit,message:`is stale: ${ageHours.toFixed(2)}h old (limit ${limit}h)`};
  }
  return {ok:true,status:'fresh',classification:'snapshot',ageHours,maxAgeHours:limit,message:`is fresh: ${ageHours.toFixed(2)}h old (limit ${limit}h)`};
}
