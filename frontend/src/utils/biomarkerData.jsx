export const IconHeart = ({ color = "currentColor", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
);
export const IconPulse = ({ color = "currentColor", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
);
export const IconDroplet = ({ color = "currentColor", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
);
export const IconSun = ({ color = "currentColor", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
);
export const IconScale = ({ color = "currentColor", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.5C12 11 14.5 8 17.5 5L21 3"/><path d="M12 13.5C12 11 9.5 8 6.5 5L3 3"/></svg>
);
export const IconFlask = ({ color = "currentColor", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v7l5 8H4l5-8V3z"/><line x1="9" y1="3" x2="15" y2="3"/></svg>
);
export const IconKidney = ({ color = "currentColor", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2c-3 0-5 2.5-5 6s2 5 4 7c1 1 2 3 2 5h6c0-2 1-4 2-5 2-2 4-3.5 4-7s-2-6-5-6c-2 0-3 1-4 2-1-1-2-2-4-2z"/></svg>
);
export const IconBone = ({ color = "currentColor", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.3 5.7a2.5 2.5 0 0 1 0 3.5l-9.1 9.1a2.5 2.5 0 0 1-3.5-3.5l9.1-9.1a2.5 2.5 0 0 1 3.5 0z"/><path d="M5.7 5.7a2.5 2.5 0 0 0 0 3.5"/><path d="M18.3 18.3a2.5 2.5 0 0 0 0-3.5"/></svg>
);
export const IconTestTube = ({ color = "currentColor", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5h0c-1.4 0-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/><path d="M14.5 16h-5"/></svg>
);
export const IconCandy = ({ color = "currentColor", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="7"/><path d="M12 5V2"/><path d="M12 22v-3"/><path d="M5 12H2"/><path d="M22 12h-3"/><path d="M9 9l5 6"/></svg>
);
export const IconActivity = ({ color = "currentColor", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
);

export const BIOMARKER_META = {
  blood_pressure_systolic:  { label: "Blood Pressure Systolic",  IconComponent: IconHeart,    color: "#e63946", popMean: 118, popSigma: 12 },
  blood_pressure_diastolic: { label: "Blood Pressure Diastolic", IconComponent: IconHeart,    color: "#e07a7a", popMean: 76, popSigma: 9 },
  heart_rate:               { label: "Heart Rate",               IconComponent: IconPulse,    color: "#457b9d", popMean: 74, popSigma: 10, rightSkew: true },
  cholesterol_total:        { label: "Total Cholesterol",        IconComponent: IconDroplet,  color: "#e76f51", popMean: 180, popSigma: 30, rightSkew: true },
  cholesterol_ldl:          { label: "LDL Cholesterol",          IconComponent: IconDroplet,  color: "#d62828", popMean: 110, popSigma: 25, rightSkew: true },
  cholesterol_hdl:          { label: "HDL Cholesterol",          IconComponent: IconDroplet,  color: "#f4a261", popMean: 55, popSigma: 15 },
  triglycerides:            { label: "Triglycerides",            IconComponent: IconDroplet,  color: "#e76f51", popMean: 110, popSigma: 40, rightSkew: true },
  blood_sugar:              { label: "Blood Sugar (Glucose)",    IconComponent: IconCandy,    color: "#f4a261", popMean: 90, popSigma: 12, rightSkew: true },
  vitamin_d:                { label: "Vitamin D",                IconComponent: IconSun,      color: "#e9c46a", popMean: 35, popSigma: 12 },
  bmi:                      { label: "BMI",                      IconComponent: IconScale,    color: "#2a9d8f", popMean: 24, popSigma: 4, rightSkew: true },
  hba1c:                    { label: "HbA1c",                    IconComponent: IconFlask,    color: "#264653", popMean: 5.2, popSigma: 0.5, rightSkew: true },
  kidney_function_egfr:     { label: "Kidney Function (eGFR)",   IconComponent: IconKidney,   color: "#6a994e", popMean: 100, popSigma: 15 },
  liver_enzymes_alt:        { label: "Liver Enzymes (ALT)",      IconComponent: IconTestTube, color: "#bc6c25", popMean: 22, popSigma: 12, rightSkew: true },
  calcium:                  { label: "Calcium",                  IconComponent: IconBone,     color: "#606c38", popMean: 9.5, popSigma: 0.4 },
  hemoglobin:               { label: "Hemoglobin",               IconComponent: IconDroplet,  color: "#d62828", popMean: 14.5, popSigma: 1.2 },
  respiratory_rate:         { label: "Respiratory Rate",         IconComponent: IconActivity, color: "#457b9d", popMean: 16, popSigma: 3 },
  oxygen_saturation:        { label: "Oxygen Saturation",        IconComponent: IconActivity, color: "#0077b6", popMean: 98, popSigma: 1.5, leftSkew: true },
  temperature:              { label: "Temperature",              IconComponent: IconActivity, color: "#d00000", popMean: 98.2, popSigma: 0.6 },
  weight:                   { label: "Weight",                   IconComponent: IconScale,    color: "#2a9d8f", popMean: 80, popSigma: 15, rightSkew: true },
  height:                   { label: "Height",                   IconComponent: IconScale,    color: "#2a9d8f", popMean: 170, popSigma: 10 },
};

export function getBiomarkerStatus(type, value, normalRanges) {
  const range = normalRanges.find((r) => r.biomarker_type === type);
  if (!range) return { status: "Unknown", className: "status-unknown" };
  
  const numValue = Number(value);
  const minVal = Number(range.min_value);
  const maxVal = Number(range.max_value);

  if (numValue < minVal) return { status: "Low", className: "status-low" };
  if (numValue > maxVal) {
    const borderline = maxVal * 1.1;
    if (numValue <= borderline) return { status: "Borderline", className: "status-borderline" };
    return { status: "High", className: "status-high" };
  }
  return { status: "Normal", className: "status-normal" };
}

export function NormalDistCurve({ value, normalRange, statusClass, type }) {
  if (!normalRange) return null;
  const { min_value: minVal, max_value: maxVal } = normalRange;
  
  const meta = BIOMARKER_META[type] || {};
  
  // As requested, the peak (mean) of the curve is the exact center of the healthy range
  let mean = (minVal + maxVal) / 2;
  // Standard deviation is scaled to the healthy range's width (covers 4 sigmas of the healthy zone)
  const sigma = (maxVal - minVal) / 4 || 1; 
  
  // Protect log-normal math from NaN issues if the user sets min/max ranges around or below zero
  if (meta.rightSkew && mean <= 0) mean = 0.1;
  
  // Decide drawing bounds to include the curve peak/tails AND the min/max limits AND the patient value
  let drawMin = Math.min(mean - 3.5 * sigma, minVal - sigma, value - sigma);
  let drawMax = Math.max(mean + 3.5 * sigma, maxVal + sigma, value + sigma);
  
  if (meta.leftSkew && drawMax > 100) drawMax = 100;
  if (drawMin < 0 && (type.includes('rate') || type === 'weight' || type.includes('cholesterol') || type === 'blood_sugar' || type === 'hba1c')) {
      drawMin = 0;
  }

  const w = 200, h = 60, padY = 6;
  const steps = 100;
  
  let gauss;
  if (meta.rightSkew) {
      // Log-normal approximation for rendering (simplified skew-right)
      const muLog = Math.log(Math.pow(mean, 2) / Math.sqrt(Math.pow(sigma, 2) + Math.pow(mean, 2)));
      const sigmaLog = Math.sqrt(Math.log(1 + (Math.pow(sigma, 2) / Math.pow(mean, 2))));
      gauss = (x) => {
          if (x <= 0) return 0;
          return (1 / (x * sigmaLog * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((Math.log(x) - muLog) / sigmaLog, 2));
      };
      const mode = Math.exp(muLog - Math.pow(sigmaLog, 2));
      const peak = gauss(mode);
      const originalGauss = gauss;
      gauss = (x) => originalGauss(x) / peak; // Normalize peak to 1
  } else if (meta.leftSkew && type === 'oxygen_saturation') {
      gauss = (x) => {
          if (x > 100) return 0;
          const z = (100 - x) / sigma;
          return Math.exp(-0.5 * Math.pow(z, 2));
      };
  } else {
      gauss = (x) => Math.exp(-0.5 * Math.pow((x - mean) / sigma, 2));
  }

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const xVal = drawMin + (i / steps) * (drawMax - drawMin);
    const xPx = (i / steps) * w;
    const yVal = gauss(xVal);
    const yPx = h - padY - yVal * (h - 2 * padY);
    points.push(`${xPx},${yPx}`);
  }

  const clampedVal = Math.max(drawMin, Math.min(drawMax, value));
  const patientX = ((clampedVal - drawMin) / (drawMax - drawMin)) * w;
  const patientY = h - padY - gauss(clampedVal) * (h - 2 * padY);
  
  const rangeStartX = ((Math.max(drawMin, minVal) - drawMin) / (drawMax - drawMin)) * w;
  const rangeEndX = ((Math.min(drawMax, maxVal) - drawMin) / (drawMax - drawMin)) * w;
  
  const shadedPoints = [];
  for (let i = 0; i <= steps; i++) {
    const xVal = drawMin + (i / steps) * (drawMax - drawMin);
    if (xVal < minVal || xVal > maxVal) continue;
    const xPx = (i / steps) * w;
    const yPx = h - padY - gauss(xVal) * (h - 2 * padY);
    shadedPoints.push({ x: xPx, y: yPx });
  }
  
  let shadedPath = "";
  if (shadedPoints.length > 1) {
    shadedPath = `M ${shadedPoints[0].x},${h - padY} `;
    shadedPoints.forEach((p) => { shadedPath += `L ${p.x},${p.y} `; });
    shadedPath += `L ${shadedPoints[shadedPoints.length - 1].x},${h - padY} Z`;
  }
  
  const dotColor = statusClass === "status-normal" ? "#16a34a" : statusClass === "status-high" ? "#dc2626" : statusClass === "status-low" ? "#2563eb" : statusClass === "status-borderline" ? "#d97706" : "#94a3b8";
  
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="bell-curve-svg">
      {shadedPath && <path d={shadedPath} fill="#16a34a" opacity="0.1" />}
      <line x1={rangeStartX} y1={padY} x2={rangeStartX} y2={h - padY} stroke="#16a34a" strokeWidth="1" strokeDasharray="3 2" opacity="0.4" />
      <line x1={rangeEndX} y1={padY} x2={rangeEndX} y2={h - padY} stroke="#16a34a" strokeWidth="1" strokeDasharray="3 2" opacity="0.4" />
      <polyline points={points.join(" ")} fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx={patientX} cy={patientY} r="5" fill={dotColor} stroke="#fff" strokeWidth="1.5" />
      <line x1={patientX} y1={patientY + 5} x2={patientX} y2={h - padY} stroke={dotColor} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
    </svg>
  );
}
