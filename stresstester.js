/* ============================================================
   stresstester.js — Stress Tester (Tool 4)
   Monte Carlo lifepath simulator using historical return series.
   Depends on: Chart.js 3.x (global), styles.css
   ============================================================ */

// ── DOM References ────────────────────────────────────────────
const milestoneContainer  = document.getElementById('milestone-container');
const addEventBtn         = document.getElementById('add-event-btn');
const loader              = document.getElementById('chart-loader');

const sliderStartAge      = document.getElementById('slider-start-age');
const boxStartAge         = document.getElementById('box-start-age');
const sliderEndAge        = document.getElementById('slider-end-age');
const boxEndAge           = document.getElementById('box-end-age');
const sliderRetireAge     = document.getElementById('slider-retire-age');
const boxRetireAge        = document.getElementById('box-retire-age');

const inputPrincipal      = document.getElementById('input-principal');
const boxPrincipal        = document.getElementById('box-principal');

const selectGrowthMethodAcc = document.getElementById('select-growth-method-acc');
const manualInputsAcc       = document.getElementById('manual-inputs-acc');
const boxGrowthMeanAcc      = document.getElementById('box-growth-mean-acc');
const boxGrowthStdAcc       = document.getElementById('box-growth-std-acc');

const selectGrowthMethodDec = document.getElementById('select-growth-method-dec');
const manualInputsDec       = document.getElementById('manual-inputs-dec');
const boxGrowthMeanDec      = document.getElementById('box-growth-mean-dec');
const boxGrowthStdDec       = document.getElementById('box-growth-std-dec');

const btnLinkRates        = document.getElementById('btn-link-rates');
const btnAdvanced         = document.getElementById('advanced-button');
const panelAdvanced       = document.getElementById('advanced-panel');

const sliderLegacyFloor   = document.getElementById('slider-legacy-floor');
const boxLegacyFloor      = document.getElementById('box-legacy-floor');

const boxAxisMin          = document.getElementById('box-axis-min');
const boxAxisMax          = document.getElementById('box-axis-max');
const boxYMax             = document.getElementById('box-y-max');
const boxYLeftMin         = document.getElementById('box-y-left-min');
const boxYLeftMax         = document.getElementById('box-y-left-max');

const mainLockBtn         = document.getElementById('main-chart-lock');
const btnLockX            = document.getElementById('btn-lock-x');
const btnLockY            = document.getElementById('btn-lock-y');
const btnLockYLeft        = document.getElementById('btn-lock-y-left');

const ssList              = document.getElementById('ss-list');
const windfallList        = document.getElementById('windfall-list');
const btnAddSs            = document.getElementById('btn-add-ss');
const btnAddWindfall      = document.getElementById('btn-add-windfall');

const mWorkYears          = document.getElementById('metric-work-years');
const mRetireAge          = document.getElementById('metric-retire-age');
const mSuccessRate        = document.getElementById('metric-success-rate');

// ── Historical Return Data ────────────────────────────────────
// Source: Aswath Damodaran, NYU Stern — real annual returns (inflation-adjusted)
const histEquities = [
    45.5, -8.8, -20.0, -38.1, 1.8, 52.8, -0.6, 45.5, 31.8, -34.8,
    34.2, -0.7, -10.6, -18.4, 30.6, 22.1, 16.9, 34.0, -21.4, -12.4,
    3.3, 20.3, 24.3, 17.1, 10.9, -0.6, 51.5, 31.0, 3.6, -13.5,
    41.1, 10.2, -1.2, 25.8, -10.0, 21.0, 15.1, 10.4, -13.1, 20.2,
    6.2, -13.8, -1.5, 10.6, 15.0, -21.0, -32.8, 28.5, 17.5, -13.3,
    -2.3, 4.8, 17.1, -12.5, 17.1, 18.2, 2.1, 27.2, 17.0, 0.8,
    12.0, 25.7, -9.2, 26.3, 4.6, 7.2, -1.3, 33.7, 19.3, 31.1,
    26.6, 17.9, -12.2, -13.3, -23.5, 26.1, 7.4, 1.4, 12.7, 1.3,
    -37.1, 23.3, 13.1, -0.9, 13.9, 30.2, 12.7, 0.6, 9.8, 18.9,
    -6.2, 28.6, 16.8, 20.2, -23.0, 22.2,
];

const hist6040 = [
    28.1, -3.8, -7.3, -19.9, 9.6, 32.1, 3.3, 29.8, 20.8, -20.5,
    22.0, 1.4, -3.9, -10.9, 18.8, 13.3, 11.2, 20.4, -13.1, -9.0,
    1.4, 12.8, 14.5, 9.8, 6.7, -0.2, 31.1, 18.1, 1.3, -8.1,
    24.3, 6.3, 2.7, 15.6, -3.0, 13.4, 10.5, 6.7, -8.1, 11.3,
    5.0, -9.1, 4.8, 10.9, 10.0, -11.0, -16.4, 21.3, 15.0, -8.0,
    0.3, 5.1, 11.2, -4.6, 15.4, 13.6, 8.4, 25.4, 18.6, -0.1,
    10.5, 21.4, -2.5, 21.4, 6.3, 8.7, -1.5, 27.8, 11.6, 21.8,
    20.6, 10.7, -4.8, -6.1, -11.1, 16.7, 6.4, 2.2, 8.8, 3.8,
    -22.3, 11.7, 10.7, 6.5, 10.2, 16.5, 10.4, 1.0, 6.3, 12.5,
    -3.3, 18.9, 12.9, 11.4, -22.9, 13.6,
];

// ── State ─────────────────────────────────────────────────────
let chartInstance         = null;
let ratesLinked           = false;
let computedPeakCache     = 0;
let computedMinFlowCache  = 0;
let computedPeakFlowCache = 0;

let milestones     = [];
let ssEvents       = [];
let windfallEvents = [];

// ── Helpers ───────────────────────────────────────────────────
const formatCurrency = (num) => '$' + Math.round(num).toLocaleString();

function newId() {
    return Math.random().toString(36).substring(2, 11);
}

function snapCeiling(rawPeak) {
    if (rawPeak >= 1000000) return Math.ceil(rawPeak / 250000) * 250000;
    if (rawPeak >= 250000)  return Math.ceil(rawPeak / 50000)  * 50000;
    return Math.ceil(rawPeak / 10000) * 10000;
}

function snapFloor(rawMin) {
    if (rawMin <= -100000) return Math.floor(rawMin / 25000) * 25000;
    return Math.floor(rawMin / 5000) * 5000;
}

function snapFlowCeiling(rawPeak) {
    if (rawPeak >= 500000) return Math.ceil(rawPeak / 100000) * 100000;
    if (rawPeak >= 100000) return Math.ceil(rawPeak / 25000)  * 25000;
    if (rawPeak >= 50000)  return Math.ceil(rawPeak / 10000)  * 10000;
    return Math.ceil(rawPeak / 5000) * 5000;
}

// ── Return Series Generation ──────────────────────────────────
function getReturnSeries(method, mean, std, count) {
    if (method === 'manual') {
        return Array.from({ length: count }, () => {
            // Box-Muller transform for normally-distributed returns
            const u1 = Math.random();
            const u2 = Math.random();
            const z  = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            return (mean / 100) + (z * (std / 100));
        });
    }
    const pool = method === 'equities' ? histEquities : hist6040;
    return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)] / 100);
}

// ── Chart Init ────────────────────────────────────────────────
function initChart() {
    const ctx = document.getElementById('lifepathChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label:           'Inflow (Income)',
                    data:            [],
                    backgroundColor: 'rgba(16, 185, 129, 0.6)',
                    borderColor:     '#10b981',
                    borderWidth:     1,
                    stack:           'flow',
                },
                {
                    label:           'Outflow (Spending)',
                    data:            [],
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    borderColor:     '#ef4444',
                    borderWidth:     1,
                    stack:           'flow',
                },
                {
                    label:           'Asset Growth',
                    data:            [],
                    backgroundColor: 'rgba(139, 92, 246, 0.6)',
                    borderColor:     '#8B5CF6',
                    borderWidth:     1,
                    stack:           'flow',
                },
                {
                    label:       'Projected Net Worth',
                    data:        [],
                    type:        'line',
                    borderColor: '#3b82f6',
                    borderWidth: 3,
                    pointRadius: 0,
                    yAxisID:     'yNetWorth',
                    fill:        false,
                    tension:     0.1,
                },
            ],
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type:  'linear',
                    grid:  { color: '#334155' },
                    ticks: { color: '#94a3b8', font: { size: 10 } },
                    title: { display: true, text: 'Age', color: '#94a3b8' },
                },
                y: {
                    stacked:     true,
                    grid:        { color: '#334155' },
                    beginAtZero: true,
                    ticks:       { color: '#94a3b8', callback: (v) => '$' + Math.abs(v).toLocaleString() },
                    title:       { display: true, text: 'Annual Cash Flow ($)', color: '#94a3b8' },
                },
                yNetWorth: {
                    position: 'right',
                    grid:     { display: false },
                    min:      0,
                    ticks:    {
                        color:    '#3b82f6',
                        callback: (v) => v >= 1000000 ? '$' + (v / 1000000).toFixed(1) + 'M' : '$' + (v / 1000).toFixed(0) + 'k',
                    },
                },
            },
            plugins: {
                legend:  { labels: { color: '#f8fafc' } },
                tooltip: {
                    mode:      'nearest',
                    axis:      'x',
                    intersect: false,
                    callbacks: {
                        title: (ctx) => 'Age ' + ctx[0].parsed.x.toFixed(1),
                        label: (ctx) => (ctx.dataset.label || '') + ': $' + Math.abs(ctx.parsed.y).toLocaleString(),
                    },
                },
            },
        },
    });
    loader.style.display = 'none';
}

// ── Simulation ────────────────────────────────────────────────
function getMilestone(age) {
    return milestones.filter(m => m.age <= age).pop() || milestones[0];
}

function simulateLife(startAge, endAge, principal, rAge, planningEndAge, returnsAcc, returnsDec) {
    const labels      = [];
    const inflowData  = [];
    const growthData  = [];
    const outflowData = [];
    const nwData      = [];

    let balance = principal;
    let peakNw  = principal;
    let peakFlow = 0;
    let minFlow  = 0;

    const k     = Math.floor(rAge);
    const delta = rAge - k;

    for (let t = startAge; t <= endAge; t++) {
        labels.push(t);

        nwData.push(t <= planningEndAge + 1 ? { x: t, y: balance } : { x: t, y: null });

        if (t > planningEndAge) {
            inflowData.push({ x: t, y: null });
            outflowData.push({ x: t, y: null });
            growthData.push({ x: t, y: null });
            continue;
        }

        const startBal = balance;
        const m        = getMilestone(t);
        const passive  = ssEvents.reduce((acc, ss) => acc + (t >= ss.age ? ss.amt : 0), 0);
        const windfall = windfallEvents.reduce((acc, wf) => t === wf.age ? acc + wf.amt : acc, 0);

        let growth = 0;
        const rAcc = returnsAcc[t - startAge];
        const rDec = returnsDec[t - startAge];

        if (t < k) {
            // Full working year
            inflowData.push({ x: t, y: m.income + passive + windfall });
            outflowData.push({ x: t, y: -m.spending });
            balance  = balance * (1 + rAcc) + m.savings + passive + windfall;
            growth   = balance - startBal - m.savings - passive - windfall;
            peakNw   = Math.max(peakNw, balance);

        } else if (t === k) {
            // Transition year (fractional retirement)
            const workFrac   = delta;
            const retireFrac = 1 - delta;

            inflowData.push({ x: t, y: (m.income * workFrac) + passive + windfall });
            outflowData.push({ x: t, y: -m.spending });

            const balanceMid = balance * Math.pow(1 + rAcc, workFrac)
                + (m.savings * workFrac) + (passive * workFrac) + (windfall * workFrac);

            if (delta > 0 && t <= planningEndAge) {
                nwData.push({ x: t + delta, y: balanceMid });
            }

            balance = (balanceMid - m.spending * retireFrac + (passive * retireFrac) + (windfall * retireFrac))
                * Math.pow(1 + rDec, retireFrac);
            growth  = balance - startBal - (m.savings * workFrac) + (m.spending * retireFrac) - passive - windfall;
            peakNw  = Math.max(peakNw, balanceMid, balance);

        } else {
            // Full retirement year
            inflowData.push({ x: t, y: passive + windfall });
            outflowData.push({ x: t, y: -m.spending });
            balance  = (balance - m.spending + passive + windfall) * (1 + rDec);
            growth   = balance - startBal + m.spending - passive - windfall;
            peakNw   = Math.max(peakNw, balance);
        }

        growthData.push({ x: t, y: growth });

        const posFlow = Math.max(0, inflowData[inflowData.length - 1].y || 0)
                      + Math.max(0, growthData[growthData.length - 1].y || 0);
        const negFlow = outflowData[outflowData.length - 1].y || 0;
        peakFlow = Math.max(peakFlow, posFlow);
        minFlow  = Math.min(minFlow,  negFlow);
    }

    return { labels, inflowData, growthData, outflowData, nwData, finalBalance: balance, peakNw, peakFlow, minFlow };
}

// ── Simulation Entry Point ────────────────────────────────────
function updateSimulation() {
    if (!chartInstance) initChart();
    if (milestones.length === 0) return;

    const currentAge = parseInt(boxStartAge.value);
    const stopAge    = parseInt(boxEndAge.value);
    const rAge       = parseFloat(boxRetireAge.value);
    const principal  = parseFloat(boxPrincipal.value) || 0;
    const floor      = parseFloat(boxLegacyFloor.value) || 0;

    const methodAcc = selectGrowthMethodAcc.value;
    const meanAcc   = parseFloat(boxGrowthMeanAcc.value) || 0;
    const stdAcc    = parseFloat(boxGrowthStdAcc.value)  || 0;

    const methodDec = selectGrowthMethodDec.value;
    const meanDec   = parseFloat(boxGrowthMeanDec.value) || 0;
    const stdDec    = parseFloat(boxGrowthStdDec.value)  || 0;

    const horizon = Math.max(stopAge, 120) - currentAge + 1;

    // Monte Carlo: 500 iterations
    const ITERATIONS = 500;
    let successes = 0;
    let firstPath = null;

    for (let i = 0; i < ITERATIONS; i++) {
        const retAcc = getReturnSeries(methodAcc, meanAcc, stdAcc, horizon);
        const retDec = getReturnSeries(methodDec, meanDec, stdDec, horizon);
        const sim    = simulateLife(currentAge, stopAge, principal, rAge, stopAge, retAcc, retDec);
        if (sim.finalBalance >= floor) successes++;
        if (i === 0) {
            firstPath             = sim;
            computedPeakCache     = sim.peakNw;
            computedMinFlowCache  = sim.minFlow;
            computedPeakFlowCache = sim.peakFlow;
        }
    }

    const successRate = (successes / ITERATIONS) * 100;
    mSuccessRate.innerText              = successRate.toFixed(1) + '%';
    mSuccessRate.parentElement.className = 'metric-card '
        + (successRate > 80 ? 'green' : successRate > 50 ? 'blue' : '');

    const w = Math.max(0, rAge - currentAge);
    mWorkYears.innerText = w.toFixed(1) + ' Years';
    mRetireAge.innerText = 'Age ' + rAge.toFixed(1);

    document.getElementById('label-principal').innerText    = 'Starting Balance: '    + formatCurrency(principal);
    document.getElementById('label-legacy-floor').innerText = 'Desired Legacy Floor: ' + formatCurrency(floor);

    // View clamping
    const axisMin        = boxAxisMin.value  !== "" ? parseInt(boxAxisMin.value)    : currentAge;
    const axisMax        = boxAxisMax.value  !== "" ? parseInt(boxAxisMax.value)    : stopAge + 1;
    const yMaxConstraint = boxYMax.value     !== "" ? parseFloat(boxYMax.value)     : undefined;
    const yLeftMinCon    = boxYLeftMin.value !== "" ? parseFloat(boxYLeftMin.value) : undefined;
    const yLeftMaxCon    = boxYLeftMax.value !== "" ? parseFloat(boxYLeftMax.value) : undefined;

    chartInstance.data.labels                   = firstPath.labels;
    chartInstance.data.datasets[0].data         = firstPath.inflowData;
    chartInstance.data.datasets[1].data         = firstPath.outflowData;
    chartInstance.data.datasets[2].data         = firstPath.growthData;
    chartInstance.data.datasets[3].data         = firstPath.nwData;
    chartInstance.options.scales.x.type         = 'linear';
    chartInstance.options.scales.x.min          = axisMin;
    chartInstance.options.scales.x.max          = axisMax;
    chartInstance.options.scales.y.min          = yLeftMinCon;
    chartInstance.options.scales.y.max          = yLeftMaxCon;
    chartInstance.options.scales.yNetWorth.max  = yMaxConstraint;
    chartInstance.update('none');

    updateButtonStates();
    updateURLParams();
}

// ── Growth Method Toggle ──────────────────────────────────────
function toggleManualInputs() {
    manualInputsAcc.style.display = selectGrowthMethodAcc.value === 'manual' ? 'grid' : 'none';
    if (ratesLinked) {
        manualInputsDec.style.display = manualInputsAcc.style.display;
    } else {
        manualInputsDec.style.display = selectGrowthMethodDec.value === 'manual' ? 'grid' : 'none';
    }
}

selectGrowthMethodAcc.addEventListener('change', () => {
    if (ratesLinked) selectGrowthMethodDec.value = selectGrowthMethodAcc.value;
    toggleManualInputs();
    updateSimulation();
});
selectGrowthMethodDec.addEventListener('change', () => { toggleManualInputs(); updateSimulation(); });

// ── Input Linking ─────────────────────────────────────────────
function linkInputs(slider, box, labelUpdateFn) {
    slider.addEventListener('input', () => {
        box.value = slider.value;
        if (labelUpdateFn) labelUpdateFn(slider.value);
        updateSimulation();
    });
    box.addEventListener('change', () => {
        if (box.value === "") box.value = slider.value;
        slider.value = box.value;
        if (labelUpdateFn) labelUpdateFn(box.value);
        updateSimulation();
    });
}

// ── Button State Sync ─────────────────────────────────────────
function updateButtonStates() {
    const xLocked = boxAxisMin.value !== "" || boxAxisMax.value !== "";
    btnLockX.textContent = xLocked ? "Unlock Auto" : "Lock Current";
    btnLockX.classList.toggle('locked', xLocked);

    const yLocked = boxYMax.value !== "";
    btnLockY.textContent = yLocked ? "Unlock Auto" : "Lock Current";
    btnLockY.classList.toggle('locked', yLocked);

    const yLeftLocked = boxYLeftMin.value !== "" || boxYLeftMax.value !== "";
    btnLockYLeft.textContent = yLeftLocked ? "Unlock Auto" : "Lock Current";
    btnLockYLeft.classList.toggle('locked', yLeftLocked);
}

// ── Axis Lock Buttons ─────────────────────────────────────────
btnLockX.addEventListener('click', () => {
    if (boxAxisMin.value !== "" || boxAxisMax.value !== "") {
        boxAxisMin.value = "";
        boxAxisMax.value = "";
    } else {
        boxAxisMin.value = parseInt(boxStartAge.value) || 0;
        boxAxisMax.value = (parseInt(boxEndAge.value) || 95) + 1;
    }
    updateSimulation();
});

btnLockY.addEventListener('click', () => {
    if (boxYMax.value !== "") {
        boxYMax.value = "";
    } else if (computedPeakCache > 0) {
        boxYMax.value = snapCeiling(computedPeakCache);
    }
    updateSimulation();
});

btnLockYLeft.addEventListener('click', () => {
    if (boxYLeftMin.value !== "" || boxYLeftMax.value !== "") {
        boxYLeftMin.value = "";
        boxYLeftMax.value = "";
    } else {
        boxYLeftMin.value = computedMinFlowCache < 0 ? snapFloor(computedMinFlowCache) : "0";
        boxYLeftMax.value = snapFlowCeiling(computedPeakFlowCache);
    }
    updateSimulation();
});

mainLockBtn.addEventListener('click', () => {
    const allLocked = boxAxisMin.value  !== "" && boxAxisMax.value  !== ""
                   && boxYMax.value     !== "" && boxYLeftMin.value !== ""
                   && boxYLeftMax.value !== "";
    if (!allLocked) {
        boxAxisMin.value  = parseInt(boxStartAge.value) || 0;
        boxAxisMax.value  = (parseInt(boxEndAge.value) || 95) + 1;
        if (computedPeakCache > 0) boxYMax.value = snapCeiling(computedPeakCache);
        boxYLeftMin.value = computedMinFlowCache < 0 ? snapFloor(computedMinFlowCache) : "0";
        boxYLeftMax.value = snapFlowCeiling(computedPeakFlowCache);
        mainLockBtn.textContent = "Unlock Auto-Scale";
        mainLockBtn.classList.add('locked');
    } else {
        boxAxisMin.value  = "";
        boxAxisMax.value  = "";
        boxYMax.value     = "";
        boxYLeftMin.value = "";
        boxYLeftMax.value = "";
        mainLockBtn.textContent = "Lock Scale for Comparison";
        mainLockBtn.classList.remove('locked');
    }
    updateSimulation();
});

// ── Advanced Panel Toggle ─────────────────────────────────────
btnAdvanced.addEventListener('click', () => {
    btnAdvanced.classList.toggle('open');
    panelAdvanced.classList.toggle('visible');
});

// ── Rate Linking ──────────────────────────────────────────────
btnLinkRates.addEventListener('click', () => {
    ratesLinked = !ratesLinked;
    if (ratesLinked) {
        btnLinkRates.textContent = "Rates Linked";
        btnLinkRates.classList.add('locked');
        selectGrowthMethodDec.value = selectGrowthMethodAcc.value;
        boxGrowthMeanDec.value      = boxGrowthMeanAcc.value;
        boxGrowthStdDec.value       = boxGrowthStdAcc.value;
        selectGrowthMethodDec.disabled = boxGrowthMeanDec.disabled = boxGrowthStdDec.disabled = true;
    } else {
        btnLinkRates.textContent = "Link to Accumulation";
        btnLinkRates.classList.remove('locked');
        selectGrowthMethodDec.disabled = boxGrowthMeanDec.disabled = boxGrowthStdDec.disabled = false;
    }
    toggleManualInputs();
    updateSimulation();
});

// Keep decumulation in sync when accumulation changes while linked
boxGrowthMeanAcc.addEventListener('input', () => { if (ratesLinked) boxGrowthMeanDec.value = boxGrowthMeanAcc.value; updateSimulation(); });
boxGrowthStdAcc.addEventListener('input',  () => { if (ratesLinked) boxGrowthStdDec.value  = boxGrowthStdAcc.value;  updateSimulation(); });
boxGrowthMeanDec.addEventListener('input', updateSimulation);
boxGrowthStdDec.addEventListener('input',  updateSimulation);

// ── Dynamic Events ────────────────────────────────────────────
function renderDynamicEvents() {
    ssList.innerHTML       = '';
    windfallList.innerHTML = '';
    ssEvents.forEach(e       => ssList.appendChild(createEventUI(e, 'ss')));
    windfallEvents.forEach(e => windfallList.appendChild(createEventUI(e, 'wf')));
}

function createEventUI(event, type) {
    const row = document.createElement('div');
    row.className = 'interactive-row';
    row.innerHTML = `
        <input type="number" class="manual-box inp-amt" value="${event.amt}" placeholder="Amount ($)" style="flex:1;">
        <input type="number" class="manual-box inp-age" value="${event.age}" placeholder="Age" style="width:60px;">
        <button class="btn-delete">✕</button>
    `;
    const inpAmt = row.querySelector('.inp-amt');
    const inpAge = row.querySelector('.inp-age');
    const btnDel = row.querySelector('.btn-delete');

    inpAmt.addEventListener('change', () => { event.amt = parseFloat(inpAmt.value) || 0; updateSimulation(); });
    inpAge.addEventListener('change', () => { event.age = parseInt(inpAge.value)   || 0; updateSimulation(); });
    btnDel.addEventListener('click',  () => {
        if (type === 'ss') ssEvents       = ssEvents.filter(x => x.id !== event.id);
        else               windfallEvents = windfallEvents.filter(x => x.id !== event.id);
        renderDynamicEvents();
        updateSimulation();
    });
    return row;
}

btnAddSs.addEventListener('click', () => {
    if (ssEvents.length >= 100) return;
    ssEvents.push({ id: newId(), amt: 10000, age: 67 });
    renderDynamicEvents();
    updateSimulation();
});

btnAddWindfall.addEventListener('click', () => {
    if (windfallEvents.length >= 100) return;
    windfallEvents.push({ id: newId(), amt: 50000, age: 50 });
    renderDynamicEvents();
    updateSimulation();
});

// ── Milestone UI ──────────────────────────────────────────────
function createMilestoneUI(milestone) {
    const block = document.createElement('div');
    block.className  = 'milestone-block';
    block.dataset.id = milestone.id;
    block.innerHTML  = `
        <div class="milestone-header">
            <div class="milestone-title">Event Milestone</div>
            <button class="btn-delete" onclick="removeMilestone('${milestone.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
        <div class="input-row">
            <div class="control-group">
                <label class="control-label">Start Age</label>
                <input type="number" class="inp-age"      value="${milestone.age}"      min="0" max="120">
            </div>
            <div class="control-group">
                <label class="control-label">Gross Income</label>
                <input type="number" class="inp-income"   value="${milestone.income}"   step="1000">
            </div>
        </div>
        <div class="input-row">
            <div class="control-group">
                <label class="control-label">Lifestyle Spending</label>
                <input type="number" class="inp-spending" value="${milestone.spending}" step="1000">
            </div>
            <div class="control-group">
                <label class="control-label">Annual Savings</label>
                <input type="number" class="inp-savings"  value="${milestone.savings}"  step="1000">
            </div>
        </div>
    `;

    const inpAge      = block.querySelector('.inp-age');
    const inpIncome   = block.querySelector('.inp-income');
    const inpSpending = block.querySelector('.inp-spending');
    const inpSavings  = block.querySelector('.inp-savings');

    // I = S + C: keep the three fields consistent
    inpAge.addEventListener('change',     () => syncDataAndSort());
    inpIncome.addEventListener('input',   () => { inpSavings.value  = inpIncome.value - inpSpending.value; syncDataAndSort(); });
    inpSpending.addEventListener('input', () => { inpSavings.value  = inpIncome.value - inpSpending.value; syncDataAndSort(); });
    inpSavings.addEventListener('input',  () => { inpSpending.value = inpIncome.value - inpSavings.value;  syncDataAndSort(); });

    return block;
}

function addMilestone(age = 30, income = 60000, savings = 15000, spending = 45000) {
    milestones.push({ id: newId(), age, income, savings, spending });
    renderMilestones();
}

function removeMilestone(id) {
    if (milestones.length <= 1) return;
    milestones = milestones.filter(m => m.id !== id);
    renderMilestones();
}

function syncDataAndSort() {
    const blocks = document.querySelectorAll('.milestone-block');
    milestones = Array.from(blocks).map(block => ({
        id:       block.dataset.id,
        age:      parseInt(block.querySelector('.inp-age').value)       || 0,
        income:   parseFloat(block.querySelector('.inp-income').value)  || 0,
        spending: parseFloat(block.querySelector('.inp-spending').value) || 0,
        savings:  parseFloat(block.querySelector('.inp-savings').value)  || 0,
    }));
    milestones.sort((a, b) => a.age - b.age);
    updateSimulation();
}

function renderMilestones() {
    const scrollPos = milestoneContainer.parentElement.scrollTop;
    milestoneContainer.innerHTML = '';
    milestones.sort((a, b) => a.age - b.age);
    milestones.forEach(m => milestoneContainer.appendChild(createMilestoneUI(m)));
    milestoneContainer.parentElement.scrollTop = scrollPos;
    updateSimulation();
}

addEventBtn.addEventListener('click', () => {
    const last = milestones.length > 0 ? milestones[milestones.length - 1] : { age: 30, income: 60000, spending: 45000, savings: 15000 };
    addMilestone(last.age + 10, last.income, last.savings, last.spending);
});

// ── URL Persistence ───────────────────────────────────────────
function updateURLParams() {
    const params = new URLSearchParams();
    params.set('startAge',    boxStartAge.value);
    params.set('endAge',      boxEndAge.value);
    params.set('principal',   boxPrincipal.value);
    params.set('legacyFloor', boxLegacyFloor.value);
    params.set('linked',      ratesLinked);
    params.set('ss',          JSON.stringify(ssEvents.map(e => [e.amt, e.age])));
    params.set('wf',          JSON.stringify(windfallEvents.map(e => [e.amt, e.age])));
    params.set('m',           JSON.stringify(milestones.map(m => [m.age, m.income, m.savings, m.spending])));
    if (boxAxisMin.value  !== "") params.set('xMin',     boxAxisMin.value);
    if (boxAxisMax.value  !== "") params.set('xMax',     boxAxisMax.value);
    if (boxYMax.value     !== "") params.set('yMax',     boxYMax.value);
    if (boxYLeftMin.value !== "") params.set('yLeftMin', boxYLeftMin.value);
    if (boxYLeftMax.value !== "") params.set('yLeftMax', boxYLeftMax.value);
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
}

function loadParamsFromURL() {
    const p = new URLSearchParams(window.location.search);
    if (p.has('startAge'))    boxStartAge.value    = sliderStartAge.value    = p.get('startAge');
    if (p.has('endAge'))      boxEndAge.value      = sliderEndAge.value      = p.get('endAge');
    if (p.has('principal'))   boxPrincipal.value   = inputPrincipal.value    = p.get('principal');
    if (p.has('legacyFloor')) boxLegacyFloor.value = sliderLegacyFloor.value = p.get('legacyFloor');
    if (p.has('xMin'))     boxAxisMin.value  = p.get('xMin');
    if (p.has('xMax'))     boxAxisMax.value  = p.get('xMax');
    if (p.has('yMax'))     boxYMax.value     = p.get('yMax');
    if (p.has('yLeftMin')) boxYLeftMin.value = p.get('yLeftMin');
    if (p.has('yLeftMax')) boxYLeftMax.value = p.get('yLeftMax');

    if (p.has('ss')) ssEvents       = JSON.parse(p.get('ss')).map(d => ({ id: newId(), amt: d[0], age: d[1] }));
    if (p.has('wf')) windfallEvents = JSON.parse(p.get('wf')).map(d => ({ id: newId(), amt: d[0], age: d[1] }));

    if (p.get('linked') === 'true') {
        ratesLinked = true;
        btnLinkRates.textContent = "Rates Linked";
        btnLinkRates.classList.add('locked');
        selectGrowthMethodDec.disabled = true;
        boxGrowthMeanDec.disabled      = true;
        boxGrowthStdDec.disabled       = true;
        toggleManualInputs();
    }

    if (p.has('xMin') || p.has('xMax') || p.has('yMax') || p.has('yLeftMin') || p.has('yLeftMax')) {
        mainLockBtn.textContent = "Unlock Auto-Scale";
        mainLockBtn.classList.add('locked');
    }

    if (p.has('m')) {
        try {
            milestones = JSON.parse(p.get('m')).map(m => ({ id: newId(), age: m[0], income: m[1], savings: m[2], spending: m[3] }));
        } catch (e) { console.error("Failed to parse milestones from URL", e); }
    }
}

// ── Wire Up All Inputs ────────────────────────────────────────
linkInputs(sliderStartAge,   boxStartAge);
linkInputs(sliderEndAge,     boxEndAge);
linkInputs(sliderRetireAge,  boxRetireAge);
linkInputs(inputPrincipal,   boxPrincipal, (val) => {
    document.getElementById('label-principal').innerText = 'Starting Balance: ' + formatCurrency(val);
});
linkInputs(sliderLegacyFloor, boxLegacyFloor, (val) => {
    document.getElementById('label-legacy-floor').innerText = 'Desired Legacy Floor: ' + formatCurrency(val);
});

boxAxisMin.addEventListener('change', updateSimulation);
boxAxisMax.addEventListener('change', updateSimulation);
boxYMax.addEventListener('change',    updateSimulation);
boxYLeftMin.addEventListener('change', updateSimulation);
boxYLeftMax.addEventListener('change', updateSimulation);

// ── Boot ──────────────────────────────────────────────────────
loadParamsFromURL();

document.getElementById('label-principal').innerText    = 'Starting Balance: '     + formatCurrency(boxPrincipal.value);
document.getElementById('label-legacy-floor').innerText = 'Desired Legacy Floor: ' + formatCurrency(boxLegacyFloor.value);

if (milestones.length === 0) {
    addMilestone(30, 60000, 15000, 45000);
} else {
    renderMilestones();
}
renderDynamicEvents();
