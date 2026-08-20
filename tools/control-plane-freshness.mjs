export const DEFAULT_CONTROL_PLANE_MAX_AGE_HOURS=6;

const RFC3339=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

function daysInMonth(year,month){
  if(month===2){
    const leap=year%4===0&&(year%100!==0||year%400===0);
    return leap?29:28;
  }
  return [4,6,9,11].includes(month)?30:31;
}

function parseStrictTimestamp(value){
  if(typeof value!=='string') return NaN;
  const match=RFC3339.exec(value);
  if(!match) return NaN;
  const [,yearText,monthText,dayText,hourText,minuteText,secondText,fraction,offset]=match;
  const year=Number(yearText),month=Number(monthText),day=Number(dayText);
  const hour=Number(hourText),minute=Number(minuteText),second=Number(secondText);
  if(month<1||month>12||day<1||day>daysInMonth(year,month)||hour>23||minute>59||second>59) return NaN;
  if(offset!=='Z'){
    const offsetHour=Number(offset.slice(1,3));
    const offsetMinute=Number(offset.slice(4,6));
    if(offsetHour>23||offsetMinute>59) return NaN;
  }
  // RFC3339 permits arbitrary fractional-second precision. JavaScript Date has
  // millisecond precision, so normalize only the fraction before comparison.
  const normalized=fraction
    ? `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}.${fraction.slice(0,3).padEnd(3,'0')}${offset}`
    : value;
  const parsed=Date.parse(normalized);
  return Number.isFinite(parsed)?parsed:NaN;
}

export function evaluateControlPlaneFreshness(state,{now=Date.now(),maxAgeHours=DEFAULT_CONTROL_PLANE_MAX_AGE_HOURS}={}){
  const limit=
    typeof maxAgeHours==='number'
      ? maxAgeHours
      : typeof maxAgeHours==='string'&&maxAgeHours.trim()!==''
        ? Number(maxAgeHours)
        : NaN;
  if(!Number.isFinite(limit)||limit<=0){
    return {ok:false,status:'invalid-config',classification:'configuration',ageHours:null,maxAgeHours:limit,message:'max age must be a positive number'};
  }

  const generatedAtInput=state?.generatedAt;
  const generatedAt=parseStrictTimestamp(generatedAtInput);
  if(!Number.isFinite(generatedAt)){
    return {ok:false,status:'invalid-generated-at',classification:'snapshot',ageHours:null,maxAgeHours:limit,message:`has invalid generatedAt: ${generatedAtInput}`};
  }

  const nowMs=typeof now==='number'?now:parseStrictTimestamp(now);
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
