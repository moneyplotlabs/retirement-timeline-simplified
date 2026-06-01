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

const retireModeAge       = document.getElementById('retire-mode-age');
const retireModeNW        = document.getElementById('retire-mode-nw');
const retireAgeGroup      = document.getElementById('retire-age-group');
const retireNWGroup       = document.getElementById('retire-nw-group');
const inputRetireNW       = document.getElementById('input-retire-nw');
const boxRetireNW         = document.getElementById('box-retire-nw');

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
// All returns are REAL (inflation-adjusted via CPI), covering 1928–2024 (97 years).
//
// US Equities (S&P 500 incl. dividends):
//   Source: Nominal returns from Aswath Damodaran, NYU Stern
//           (https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html)
//           CPI deflation from Robert Shiller / US Bureau of Labor Statistics
//   Arithmetic mean: 8.8% | Std dev: 19.6% | Geometric CAGR: 6.9%
//
// 60/40 Portfolio (60% S&P 500 + 40% 10-Year US Treasury Bond):
//   Source: S&P 500 and T-Bond nominal returns from Damodaran; deflated by CPI
//   T-Bond total return includes coupon + price appreciation (from FRED / Damodaran)
//   Arithmetic mean: 5.9% | Std dev: 12.5% | Geometric CAGR: 5.1%

// S&P 500 and 60/40 real annual return series (1928–2024) live in engine.js.
const histEquities = Engine.HIST_EQUITIES;
const hist6040     = Engine.HIST_6040;

// ── State ─────────────────────────────────────────────────────
let chartInstance         = null;
let ratesLinked           = false;
let computedPeakCache     = 0;
let retireMode            = 'age';   // 'age' | 'nw'

// Cached percentile retire ages for metric card rendering (NW mode only)
let cachedRetireAges      = null;    // { p10, p25, p50, p75, p90, currentAge } | null
let cachedCurrentAge      = 0;

let milestones     = [];
let ssEvents       = [];
let windfallEvents = [];

// ── Helpers ──────────────────────────────────────────
// formatCurrency, newId, snapCeiling, percentile → common.js (loaded first)

// ── Return Series Generation ──────────────────────────────────
const HIST_START_YEAR = 1928;
const HIST_YEARS      = histEquities.length;   // 97

// Pure return-series + cohort logic lives in engine.js. These thin wrappers
// inject the historical data so existing call sites are unchanged.
function getReturnSeries(method, mean, std, count, cohortOffset) {
    return Engine.getReturnSeries(method, mean, std, count, cohortOffset || 0,
                                  { equities: histEquities, sixtyForty: hist6040 });
}


// Determine whether a method is cohort-based
const isCohort = (m) => m === 'cohort-equities' || m === 'cohort-6040';

// Build the full list of simulation runs for cohort mode (delegates to engine).
function buildCohortRuns(methodAcc, methodDec, meanAcc, stdAcc, meanDec, stdDec,
                         accHorizon, decHorizon, horizon) {
    return Engine.buildCohortRuns(methodAcc, methodDec, meanAcc, stdAcc, meanDec, stdDec,
                                  accHorizon, decHorizon, horizon,
                                  { equities: histEquities, sixtyForty: hist6040 });
}

// ── Chart Init ────────────────────────────────────────────────
// Dataset index map:
//   0  Inflow (Income)              — bar, stack:flow
//   1  Outflow (Spending)           — bar, stack:flow
//   2  Asset Growth (p10 scenario)  — bar, stack:flow
//   3  NW p10  (cross-sectional)    — dashed line, blue-400,  visible
//   4  NW p25  (cross-sectional)    — dashed line, blue-300,  visible
//   5  NW p50  (cross-sectional)    — solid  line, blue-500,  visible
//   6  NW p75  (cross-sectional)    — dashed line, blue-300,  HIDDEN by default
//   7  NW p90  (cross-sectional)    — dashed line, blue-200,  HIDDEN by default, fill target
//   8  NW p10 scenario (actual run) — solid  line, orange,    visible

// Dataset index → percentile label mapping (for metric card sync)
// Indices 3–7 are the NW percentile lines; others are bars/scenario with no metric row.
const DS_PCT_LABELS = {
    3: { pct: 'p10', workLabel: 'p10 scenario', ageLabel: 'p10 scenario' },
    4: { pct: 'p25', workLabel: 'p25 scenario', ageLabel: 'p25 scenario' },
    5: { pct: 'p50', workLabel: 'p50 (median)', ageLabel: 'p50 (median)' },
    6: { pct: 'p75', workLabel: 'p75 scenario', ageLabel: 'p75 scenario' },
    7: { pct: 'p90', workLabel: 'p90 scenario', ageLabel: 'p90 scenario' },
};

let upperBandVisible = false;   // kept for initial hidden state of p75/p90 on chart creation

function initChart() {
    const ctx = document.getElementById('lifepathChart').getContext('2d');

    const lineBase = {
        type:        'line',
        borderWidth: 1.5,
        pointRadius: 0,
        yAxisID:     'yNetWorth',
        tension:     0.1,
        spanGaps:    true,
        fill:        false,
    };

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                // ── Bars ──────────────────────────────────────────────
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
                    label:           'Asset Growth (p10 scenario)',
                    data:            [],
                    backgroundColor: 'rgba(139, 92, 246, 0.6)',
                    borderColor:     '#8B5CF6',
                    borderWidth:     1,
                    stack:           'flow',
                },
                // ── NW percentile lines ───────────────────────────────
                // p10 — dashed dark blue, shown
                {
                    ...lineBase,
                    label:       'NW p10 (10th pct)',
                    data:        [],
                    borderColor: 'rgba(96, 165, 250, 0.9)',
                    borderDash:  [4, 4],
                    hidden:      false,
                },
                // p25 — dashed medium blue, shown
                {
                    ...lineBase,
                    label:       'NW p25 (25th pct)',
                    data:        [],
                    borderColor: 'rgba(147, 197, 253, 0.85)',
                    borderDash:  [4, 4],
                    hidden:      false,
                },
                // p50 — solid blue, always shown
                {
                    ...lineBase,
                    label:       'NW p50 (median)',
                    data:        [],
                    borderColor: '#3b82f6',
                    borderWidth: 2.5,
                    hidden:      false,
                },
                // p75 — dashed light blue, hidden by default
                // fill: '+1' set by applyUpperBandVisibility() when shown
                {
                    ...lineBase,
                    label:           'NW p75 (75th pct)',
                    data:            [],
                    borderColor:     'rgba(99, 179, 237, 0.75)',
                    borderDash:      [4, 4],
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    hidden:          true,
                    fill:            false,
                },
                // p90 — dashed lighter blue, hidden by default (upper fill target for p75)
                {
                    ...lineBase,
                    label:       'NW p90 (90th pct)',
                    data:        [],
                    borderColor: 'rgba(147, 210, 252, 0.65)',
                    borderDash:  [4, 4],
                    hidden:      true,
                    fill:        false,
                },
                // p10 scenario — the single actual run closest to p10 terminal NW
                // Matches the growth bars; solid orange so it stands apart from the blue fan
                {
                    ...lineBase,
                    label:       'NW p10 scenario (actual run)',
                    data:        [],
                    borderColor: 'rgba(251, 146, 60, 0.9)',
                    borderWidth: 2,
                    hidden:      false,
                    fill:        false,
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
                legend: {
                    labels: { color: '#f8fafc' },
                    onClick: (e, legendItem, legend) => {
                        const idx = legendItem.datasetIndex;
                        const ds  = legend.chart.data.datasets[idx];

                        // Toggle hidden state
                        ds.hidden = !ds.hidden;

                        // p75 (idx 6) owns the fill to p90 (idx 7) — sync fill with visibility
                        if (idx === 6) ds.fill = ds.hidden ? false : '+1';
                        // If p90 (idx 7) is hidden while p75 visible, disable fill too
                        if (idx === 7 && !legend.chart.data.datasets[6].hidden) {
                            legend.chart.data.datasets[6].fill = ds.hidden ? false : '+1';
                        }

                        legend.chart.update('none');
                        renderMetricRows();
                    },
                },
                tooltip: {
                    mode:      'index',
                    axis:      'x',
                    intersect: false,
                    callbacks: {
                        title: (ctx) => 'Age ' + ctx[0].parsed.x,
                        label: (ctx) => {
                            if (ctx.dataset.hidden || ctx.parsed.y === null) return null;
                            return ctx.dataset.label + ': $' + Math.abs(Math.round(ctx.parsed.y)).toLocaleString();
                        },
                    },
                },
            },
        },
    });
    loader.style.display = 'none';
}

// ── Metric Card Renderer (NW mode) ───────────────────────────
// Reads cachedRetireAges and actual chart dataset hidden state
// to render only the rows whose percentile line is currently visible.
function renderMetricRows() {
    if (!cachedRetireAges) return;

    mWorkYears.style.fontSize = '0';
    mRetireAge.style.fontSize = '0';
    document.getElementById('metric-work-years-label').innerText = 'Working Years to Retire';
    document.getElementById('metric-retire-age-label').innerText = 'Retirement Age';

    const { p10, p25, p50, p75, p90 } = cachedRetireAges;
    const ca     = cachedCurrentAge;
    const values = { p10, p25, p50, p75, p90 };

    const pctRow = (label, value) =>
        `<div class="metric-pct-row">
            <span class="metric-pct-label">${label}</span>
            <span class="metric-pct-value">${value}</span>
         </div>`;

    // Build rows only for visible NW percentile datasets (indices 3–7)
    const workRows = [];
    const ageRows  = [];
    Object.entries(DS_PCT_LABELS).forEach(([idxStr, meta]) => {
        const idx = parseInt(idxStr);
        const isVisible = chartInstance
            ? !chartInstance.data.datasets[idx].hidden
            : (idx <= 5);   // default: p10/p25/p50 visible
        if (!isVisible) return;
        const val = values[meta.pct];
        workRows.push(pctRow(meta.workLabel, (val - ca).toFixed(1) + ' yrs'));
        ageRows.push(pctRow(meta.ageLabel,  'Age ' + val.toFixed(1)));
    });

    mWorkYears.innerHTML = `<div class="metric-pct-stack">${workRows.join('')}</div>`;
    mRetireAge.innerHTML = `<div class="metric-pct-stack">${ageRows.join('')}</div>`;
}

// ── Simulation ────────────────────────────────────────────────
// Pure simulation math lives in engine.js (Engine.simulateNWPath /
// simulateDeterministicBars). These thin wrappers inject milestones + events.
function simulateNWPath(startAge, endAge, principal, rAge, nwTarget, mode, returnsAcc, returnsDec) {
    return Engine.simulateNWPath(startAge, endAge, principal, rAge, nwTarget, mode, returnsAcc, returnsDec, {
        milestones: milestones,
        ss:         ssEvents,
        windfall:   windfallEvents,
    });
}

// Deterministic inflow/outflow bars (delegates to engine).
function simulateDeterministicBars(startAge, endAge, principal, rAge) {
    return Engine.simulateDeterministicBars(startAge, endAge, principal, rAge, {
        milestones: milestones,
        ss:         ssEvents,
        windfall:   windfallEvents,
    });
}

// percentile() → common.js (loaded before this script)

// ── Simulation Entry Point ────────────────────────────────────
function updateSimulation() {
    if (!chartInstance) initChart();
    if (milestones.length === 0) return;

    const currentAge = parseInt(boxStartAge.value);
    const stopAge    = parseInt(boxEndAge.value);
    const principal  = parseFloat(boxPrincipal.value) || 0;
    const floor      = parseFloat(boxLegacyFloor.value) || 0;

    const methodAcc = selectGrowthMethodAcc.value;
    const meanAcc   = parseFloat(boxGrowthMeanAcc.value) || 0;
    const stdAcc    = parseFloat(boxGrowthStdAcc.value)  || 0;

    const methodDec = selectGrowthMethodDec.value;
    const meanDec   = parseFloat(boxGrowthMeanDec.value) || 0;
    const stdDec    = parseFloat(boxGrowthStdDec.value)  || 0;

    const nAges   = stopAge - currentAge + 2;   // +1 for terminal balance
    const horizon = nAges;

    // Retirement target — either fixed age or NW threshold
    const rAge    = parseFloat(boxRetireAge.value);
    const nwTarget = parseFloat(boxRetireNW.value) || 0;

    // Phases: acc = working years, dec = retirement years
    const accHorizon = Math.round(Math.max(0, (retireMode === 'age' ? rAge : stopAge) - currentAge));
    const decHorizon = Math.max(0, horizon - accHorizon);

    const anyCohort = isCohort(methodAcc) || isCohort(methodDec);

    // ── Over-data warning ─────────────────────────────────────
    const cohortHorizonNeeded = (isCohort(methodAcc) && isCohort(methodDec))
        ? horizon
        : isCohort(methodAcc) ? accHorizon : isCohort(methodDec) ? decHorizon : 0;

    if (cohortHorizonNeeded > HIST_YEARS) {
        mWorkYears.innerText = '—';
        mRetireAge.innerText = '—';
        mSuccessRate.innerText = '—';
        document.getElementById('metric-work-years-label').innerText = 'Working Years';
        document.getElementById('metric-retire-age-label').innerText = 'Retirement Age';
        if (chartInstance) {
            chartInstance.data.datasets.forEach(ds => ds.data = []);
            chartInstance.update('none');
        }
        // Show warning in loader overlay without destroying the chart canvas
        loader.style.display = 'flex';
        loader.innerHTML = `<span class="placeholder-text">⚠️ Horizon (${horizon - 1} years) exceeds 97 years of historical data.<br>Shorten the planning period or use a different growth method.</span>`;
        return;
    }
    // Hide loader if it was showing a warning
    loader.style.display = 'none';

    // ── Build simulation runs ─────────────────────────────────
    const ITERATIONS = 1000;

    let simRuns;
    if (anyCohort) {
        simRuns = buildCohortRuns(methodAcc, methodDec, meanAcc, stdAcc, meanDec, stdDec,
                                  accHorizon, decHorizon, horizon);
    } else {
        simRuns = Array.from({ length: ITERATIONS }, () => ({
            retAcc: getReturnSeries(methodAcc, meanAcc, stdAcc, horizon),
            retDec: getReturnSeries(methodDec, meanDec, stdDec, horizon),
        }));
    }

    const nAgesBar   = stopAge - currentAge + 1;
    const allNW      = Array.from({ length: nAges }, () => []);
    const allRunData = [];
    const allRAges   = [];
    let successes    = 0;

    for (const { retAcc, retDec } of simRuns) {
        const sim = simulateNWPath(currentAge, stopAge, principal, rAge, nwTarget, retireMode, retAcc, retDec);
        if (sim.finalBalance >= floor) successes++;
        sim.nwByAge.forEach((bal, idx) => allNW[idx].push(bal));
        allRunData.push({ finalBalance: sim.finalBalance, growthByAge: sim.growthByAge, nwByAge: sim.nwByAge });
        if (retireMode === 'nw') allRAges.push(sim.resolvedRAge);
    }

    // Sort each NW bucket so percentile() works correctly
    allNW.forEach(bucket => bucket.sort((a, b) => a - b));

    // ── NW percentile series ──────────────────────────────────
    const ages = Array.from({ length: nAges }, (_, i) => currentAge + i);

    function makeNWPercentile(p) {
        return ages.map((age, idx) => ({ x: age, y: Math.max(0, percentile(allNW[idx], p)) }));
    }

    const nwP10 = makeNWPercentile(10);
    const nwP25 = makeNWPercentile(25);
    const nwP50 = makeNWPercentile(50);
    const nwP75 = makeNWPercentile(75);
    const nwP90 = makeNWPercentile(90);

    // Peak of p90 line drives the Y-axis auto-scale cache
    computedPeakCache = Math.max(...nwP90.map(d => d.y));

    // ── p10-representative growth bars ────────────────────────
    const p10TerminalNW = nwP10[nwP10.length - 1].y;
    const p10Run = allRunData.reduce((best, run) =>
        Math.abs(run.finalBalance - p10TerminalNW) < Math.abs(best.finalBalance - p10TerminalNW)
            ? run : best
    );
    const barAges       = Array.from({ length: nAgesBar }, (_, i) => currentAge + i);
    const growthP10Data     = barAges.map((age, idx) => ({ x: age, y: p10Run.growthByAge[idx] ?? 0 }));

    // p10 scenario NW path — same run as the growth bars, so bars and line tell the same story
    // nwByAge has nAges entries (startAge..stopAge+1); map to {x,y} clamped to ≥0
    const nwP10ScenarioData = p10Run.nwByAge.map((bal, idx) => ({
        x: currentAge + idx,
        y: Math.max(0, bal),
    }));

    // Inflow / outflow bars — use p90 retire age in NW mode so bars match the worst-case scenario
    const barsRAge = (retireMode === 'age') ? rAge : percentile([...allRAges].sort((a,b)=>a-b), 90);
    const bars     = simulateDeterministicBars(currentAge, stopAge, principal, barsRAge);

    // ── Metrics ───────────────────────────────────────────────
    const successRate = (successes / simRuns.length) * 100;
    const runLabel    = anyCohort ? `${simRuns.length} cohorts` : '1,000 runs';
    mSuccessRate.innerText = successRate.toFixed(1) + '%';
    mSuccessRate.parentElement.querySelector('.metric-label').innerText = `Success Rate (${runLabel})`;
    mSuccessRate.parentElement.className = 'metric-card '
        + (successRate > 80 ? 'green' : successRate > 50 ? 'blue' : '');

    if (retireMode === 'age') {
        const w = Math.max(0, rAge - currentAge);
        mWorkYears.style.fontSize = '';
        mRetireAge.style.fontSize = '';
        mWorkYears.innerHTML = Math.round(w) + ' Years';
        mRetireAge.innerHTML = 'Age ' + Math.round(rAge);
        document.getElementById('metric-work-years-label').innerText = 'Working Years';
        document.getElementById('metric-retire-age-label').innerText = 'Retirement Age';
        cachedRetireAges = null;
    } else {
        const sortedRAges  = [...allRAges].sort((a, b) => a - b);
        cachedRetireAges   = {
            p10: percentile(sortedRAges, 90),   // p90 of working-years dist = p10 NW outcome
            p25: percentile(sortedRAges, 75),
            p50: percentile(sortedRAges, 50),
            p75: percentile(sortedRAges, 25),
            p90: percentile(sortedRAges, 10),
        };
        cachedCurrentAge = currentAge;
        renderMetricRows();
    }

    document.getElementById('label-principal').innerText    = 'Starting Balance: '     + formatCurrency(principal);
    document.getElementById('label-legacy-floor').innerText = 'Desired Legacy Floor: ' + formatCurrency(floor);

    // ── View clamping ─────────────────────────────────────────
    const axisMin        = boxAxisMin.value  !== "" ? parseInt(boxAxisMin.value)    : currentAge;
    const axisMax        = boxAxisMax.value  !== "" ? parseInt(boxAxisMax.value)    : stopAge + 1;
    const yMaxConstraint = boxYMax.value     !== "" ? parseFloat(boxYMax.value)     : undefined;
    const yLeftMinCon    = boxYLeftMin.value !== "" ? parseFloat(boxYLeftMin.value) : undefined;
    const yLeftMaxCon    = boxYLeftMax.value !== "" ? parseFloat(boxYLeftMax.value) : undefined;

    // ── Push to chart ─────────────────────────────────────────
    // Dataset indices: 0=inflow, 1=outflow, 2=growth(p10 scenario), 3=NWp10, 4=NWp25, 5=NWp50, 6=NWp75, 7=NWp90, 8=NWp10scenario
    chartInstance.data.labels                  = bars.labels;
    chartInstance.data.datasets[0].data        = bars.inflowData;
    chartInstance.data.datasets[1].data        = bars.outflowData;
    chartInstance.data.datasets[2].data        = growthP10Data;
    chartInstance.data.datasets[3].data        = nwP10;
    chartInstance.data.datasets[4].data        = nwP25;
    chartInstance.data.datasets[5].data        = nwP50;
    chartInstance.data.datasets[6].data        = nwP75;
    chartInstance.data.datasets[7].data        = nwP90;
    chartInstance.data.datasets[8].data        = nwP10ScenarioData;
    chartInstance.options.scales.x.type        = 'linear';
    chartInstance.options.scales.x.min         = axisMin;
    chartInstance.options.scales.x.max         = axisMax;
    chartInstance.options.scales.y.min         = yLeftMinCon;
    chartInstance.options.scales.y.max         = yLeftMaxCon;
    chartInstance.options.scales.yNetWorth.max = yMaxConstraint;
    chartInstance.update('none');

    updateButtonStates();
    updateURLParams();
}

// ── Retire Mode Toggle ────────────────────────────────────────
function applyRetireMode() {
    const isNW = retireMode === 'nw';
    retireAgeGroup.style.display = isNW ? 'none'  : '';     // '' → controlled by .control-group CSS
    retireNWGroup.style.display  = isNW ? ''      : 'none'; // '' → controlled by .control-group CSS
    retireModeAge.classList.toggle('locked', !isNW);
    retireModeNW.classList.toggle('locked',   isNW);
}

retireModeAge.addEventListener('click', () => {
    if (retireMode === 'age') return;
    retireMode = 'age';
    applyRetireMode();
    updateSimulation();
});

retireModeNW.addEventListener('click', () => {
    if (retireMode === 'nw') return;
    retireMode = 'nw';
    applyRetireMode();
    updateSimulation();
});

// NW target input change
boxRetireNW.addEventListener('change', () => {
    document.getElementById('label-retire-nw').innerText = 'Retire at Net Worth: ' + formatCurrency(boxRetireNW.value);
    updateSimulation();
});
inputRetireNW.addEventListener('input', () => {
    boxRetireNW.value = inputRetireNW.value;
    document.getElementById('label-retire-nw').innerText = 'Retire at Net Worth: ' + formatCurrency(boxRetireNW.value);
    updateSimulation();
});
function toggleManualInputs() {
    const showAcc = selectGrowthMethodAcc.value === 'manual';
    const showDec = selectGrowthMethodDec.value === 'manual';
    manualInputsAcc.style.display = showAcc ? 'grid' : 'none';
    if (ratesLinked) {
        manualInputsDec.style.display = showAcc ? 'grid' : 'none';
    } else {
        manualInputsDec.style.display = showDec ? 'grid' : 'none';
    }
}

selectGrowthMethodAcc.addEventListener('change', () => {
    if (ratesLinked) {
        selectGrowthMethodDec.value = selectGrowthMethodAcc.value === 'cohort-equities' ? 'cohort-equities'
                                    : selectGrowthMethodAcc.value === 'cohort-6040'     ? 'cohort-6040'
                                    : selectGrowthMethodAcc.value;
    }
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
        const xScale = chartInstance?.scales?.x;
        boxAxisMin.value = xScale ? Math.round(xScale.min) : parseInt(boxStartAge.value) || 0;
        boxAxisMax.value = xScale ? Math.round(xScale.max) : (parseInt(boxEndAge.value) || 95) + 1;
    }
    updateSimulation();
});

btnLockY.addEventListener('click', () => {
    if (boxYMax.value !== "") {
        boxYMax.value = "";
    } else {
        const yNwScale = chartInstance?.scales?.yNetWorth;
        if (yNwScale) boxYMax.value = Math.round(yNwScale.max);
    }
    updateSimulation();
});

btnLockYLeft.addEventListener('click', () => {
    if (boxYLeftMin.value !== "" || boxYLeftMax.value !== "") {
        boxYLeftMin.value = "";
        boxYLeftMax.value = "";
    } else {
        const yScale = chartInstance?.scales?.y;
        if (yScale) {
            boxYLeftMin.value = Math.round(yScale.min);
            boxYLeftMax.value = Math.round(yScale.max);
        }
    }
    updateSimulation();
});

mainLockBtn.addEventListener('click', () => {
    const allLocked = boxAxisMin.value  !== "" && boxAxisMax.value  !== ""
                   && boxYMax.value     !== "" && boxYLeftMin.value !== ""
                   && boxYLeftMax.value !== "";
    if (!allLocked) {
        const xScale   = chartInstance?.scales?.x;
        const yNwScale = chartInstance?.scales?.yNetWorth;
        const yScale   = chartInstance?.scales?.y;
        if (xScale)   { boxAxisMin.value  = Math.round(xScale.min);   boxAxisMax.value  = Math.round(xScale.max); }
        if (yNwScale) { boxYMax.value     = Math.round(yNwScale.max); }
        if (yScale)   { boxYLeftMin.value = Math.round(yScale.min);   boxYLeftMax.value = Math.round(yScale.max); }
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
    params.set('retireMode',  retireMode);
    params.set('principal',   boxPrincipal.value);
    params.set('legacyFloor', boxLegacyFloor.value);
    if (retireMode === 'age') params.set('retireAge', boxRetireAge.value);
    else                      params.set('retireNW',  boxRetireNW.value);
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
    if (p.has('retireAge'))   boxRetireAge.value   = sliderRetireAge.value   = p.get('retireAge');
    if (p.has('retireNW'))    boxRetireNW.value    = inputRetireNW.value     = p.get('retireNW');
    if (p.has('retireMode'))  retireMode           = p.get('retireMode');
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
applyRetireMode();

document.getElementById('label-principal').innerText    = 'Starting Balance: '     + formatCurrency(boxPrincipal.value);
document.getElementById('label-legacy-floor').innerText = 'Desired Legacy Floor: ' + formatCurrency(boxLegacyFloor.value);

if (milestones.length === 0) {
    addMilestone(30, 60000, 15000, 45000);
} else {
    renderMilestones();
}
renderDynamicEvents();
