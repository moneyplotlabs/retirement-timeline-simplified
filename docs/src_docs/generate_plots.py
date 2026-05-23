import numpy as np
import matplotlib.pyplot as plt
import os

# --- Money Plot Labs Brand Style Configuration ---
mp_dark  = '#0F172A'
mp_blue  = '#3B82F6'
mp_green = '#10B981'
mp_red   = '#EF4444'

# Structural Neutrals for Environmental Comparison
mp_grey       = '#64748B'
mp_light_grey = '#CBD5E1'

plt.rcParams.update({
    'font.size': 10,
    'axes.labelsize': 11,
    'axes.titlesize': 12,
    'xtick.labelsize': 9,
    'ytick.labelsize': 9,
    'legend.fontsize': 9,
    'grid.alpha': 0.12,
    'grid.linestyle': ':',
})

# Ensure destination folder exists
os.makedirs('visual-assets', exist_ok=True)

# --- Exact Core Variables ---
A_start = 20
A_end = 95
H = A_end - A_start  # Horizon = 75 years

A_0 = 0               # Initial Balance
L = 0                 # Desired Legacy Floor (Actuary-aligned L notation)
c = 10000            # Annual Savings Flow
b = 50000            # Annual Retirement Budget

# =========================================================================
# GRAPH 1: THE LINEAR BASELINE (r = 0%)
# =========================================================================
w_linear = (b * H + L - A_0) / (c + b)
age_retire_linear = A_start + w_linear
A_w_linear = A_0 + c * w_linear

ages_lin = np.arange(A_start, A_end + 1)
nw_lin = [A_0 + c * t if t <= w_linear else L + b * (H - t) for t in (ages_lin - A_start)]

fig1, ax1 = plt.subplots(figsize=(7, 4.2), layout='tight')
split_idx = int(np.floor(w_linear)) + 1
ax1.plot(ages_lin[:split_idx], nw_lin[:split_idx], color=mp_green, linewidth=3, label='Linear Accumulation')
ax1.plot(ages_lin[split_idx-1:], nw_lin[split_idx-1:], color=mp_red, linewidth=3, label='Linear Depletion')

ax1.plot(age_retire_linear, A_w_linear, marker='o', color=mp_dark, markersize=8, zorder=5)
ax1.annotate(f'Peak $A_w$\nAge {age_retire_linear:.1f}\n${int(A_w_linear):,}', 
             xy=(age_retire_linear, A_w_linear), xytext=(age_retire_linear, A_w_linear + 140000),
             color=mp_dark, weight='bold', ha='center', arrowprops=dict(arrowstyle='->', color=mp_dark, lw=1))

ax1.text(50, 280000, f'Slope = +$c$\n(${c:,}/yr)', color=mp_green, weight='bold', ha='center', rotation=22)
ax1.text(85, 180000, f'Slope = -$b$\n(-${b:,}/yr)', color=mp_red, weight='bold', ha='center', rotation=-60)

ax1.annotate('', xy=(A_start, 50000), xytext=(age_retire_linear, 50000), arrowprops=dict(arrowstyle='<->', color=mp_dark, lw=1))
ax1.text((A_start + age_retire_linear)/2, 75000, f'Working Phase\n$w = {w_linear:.1f}$ yrs', color=mp_dark, ha='center', weight='bold', fontsize=9)
ax1.annotate('', xy=(age_retire_linear, 50000), xytext=(A_end, 50000), arrowprops=dict(arrowstyle='<->', color=mp_dark, lw=1))
ax1.text((age_retire_linear + A_end)/2, 75000, f'Retirement Phase\n$f = {H-w_linear:.1f}$ yrs', color=mp_dark, ha='center', weight='bold', fontsize=9)

ax1.set_title('The Linear Intersection Baseline ($r=0\%$)', color=mp_dark, weight='bold', pad=14)
ax1.set_xlabel('Age (Years)', color=mp_dark, weight='bold')
ax1.set_ylabel('Net Worth ($)', color=mp_dark, weight='bold')
ax1.set_xlim(A_start, A_end)
ax1.set_ylim(0, 1100000)
ax1.get_yaxis().set_major_formatter(plt.FuncFormatter(lambda x, loc: "{:,}".format(int(x))))
ax1.grid(True)
for spine in ['top', 'right']: ax1.spines[spine].set_visible(False)
for spine in ['left', 'bottom']: ax1.spines[spine].set_color('#cbd5e1')
plt.savefig('visual-assets/linear_plot.pdf', format='pdf', bbox_inches='tight')
plt.close()


# =========================================================================
# GRAPH 2: THE EXPONENTIAL ENGINE (r = 3%)
# =========================================================================
r = 0.03
numerator_inner = (r * A_0 + c) * ((1 + r)**H) + b * (1 + r) - r * L
denominator_inner = c + b * (1 + r)
w_exponential = H - (np.log(numerator_inner / denominator_inner) / np.log(1 + r))
age_retire_exp = A_start + w_exponential

ages_eval = np.linspace(A_start, A_end, 500)
nw_exp = []
for age in ages_eval:
    t = age - A_start
    if t <= w_exponential:
        val = A_0 * ((1 + r)**t) + c * (((1 + r)**t - 1) / r)
    else:
        A_w_exp = A_0 * ((1 + r)**w_exponential) + c * (((1 + r)**w_exponential - 1) / r)
        t_ret = t - w_exponential
        val = A_w_exp * ((1 + r)**t_ret) - b * (((1 + r)**(t_ret + 1) - (1 + r)) / r)
    nw_exp.append(val)

A_w_exponential = nw_exp[np.argmin(np.abs((ages_eval - A_start) - w_exponential))]

fig2, ax2 = plt.subplots(figsize=(7, 4.2), layout='tight')
mask_acc = ages_eval - A_start <= w_exponential
mask_dep = ages_eval - A_start >= w_exponential

ax2.plot(ages_eval[mask_acc], np.array(nw_exp)[mask_acc], color=mp_green, linewidth=3, label='Exponential Accumulation')
ax2.plot(ages_eval[mask_dep], np.array(nw_exp)[mask_dep], color=mp_red, linewidth=3, label='Exponential Depletion')

ax2.plot(age_retire_exp, A_w_exponential, marker='o', color=mp_dark, markersize=8, zorder=5)
ax2.annotate(f'Peak $A_w$\nAge {age_retire_exp:.1f}\n${int(A_w_exponential):,}', 
             xy=(age_retire_exp, A_w_exponential), xytext=(age_retire_exp - 20, A_w_exponential - 100000),
             color=mp_dark, weight='bold', ha='center', arrowprops=dict(arrowstyle='->', color=mp_dark, lw=1))

# Dynamic curve rate tags (differential calculus markers)
ax2.text(33, 220000, r'$\frac{dA}{dt} = rA + c$', color=mp_green, weight='bold', ha='center', fontsize=11, rotation=22)
ax2.text(75, 450000, r'$\frac{dA}{dt} = rA - b(1+r)$', color=mp_red, weight='bold', ha='center', fontsize=11, rotation=-50)

ax2.annotate('', xy=(A_start, 50000), xytext=(age_retire_exp, 50000), arrowprops=dict(arrowstyle='<->', color=mp_dark, lw=1))
ax2.text((A_start + age_retire_exp)/2, 85000, f'Working Phase\n$w = {w_exponential:.1f}$ yrs', color=mp_dark, ha='center', weight='bold', fontsize=9)
ax2.annotate('', xy=(age_retire_exp, 50000), xytext=(A_end, 50000), arrowprops=dict(arrowstyle='<->', color=mp_dark, lw=1))
ax2.text((age_retire_exp + A_end)/2, 85000, f'Retirement Phase\n$f = {H-w_exponential:.1f}$ yrs', color=mp_dark, ha='center', weight='bold', fontsize=9)

ax2.set_title(f'The Exponential Compounding Trajectory ($r={int(r*100)}\\%$)', color=mp_dark, weight='bold', pad=14)
ax2.set_xlabel('Age (Years)', color=mp_dark, weight='bold')
ax2.set_ylabel('Net Worth ($)', color=mp_dark, weight='bold')
ax2.set_xlim(A_start, A_end)
ax2.set_ylim(0, 1100000)
ax2.get_yaxis().set_major_formatter(plt.FuncFormatter(lambda x, loc: "{:,}".format(int(x))))
ax2.grid(True)
for spine in ['top', 'right']: ax2.spines[spine].set_visible(False)
for spine in ['left', 'bottom']: ax2.spines[spine].set_color('#cbd5e1')
plt.savefig('visual-assets/exponential_plot.pdf', format='pdf', bbox_inches='tight')
plt.close()


# =========================================================================
# GRAPH 3: ENVIRONMENT MACRO COMPARISON (3% vs 0% vs -3%)
# =========================================================================
r_neg = -0.03
num_neg = (r_neg * A_0 + c) * ((1 + r_neg)**H) + b * (1 + r_neg) - r_neg * L
den_neg = c + b * (1 + r_neg)
w_negative = H - (np.log(num_neg / den_neg) / np.log(1 + r_neg))
age_retire_neg = A_start + w_negative

nw_neg_curve = []
for age in ages_eval:
    t = age - A_start
    if t <= w_negative:
        val = A_0 * ((1 + r_neg)**t) + c * (((1 + r_neg)**t - 1) / r_neg)
    else:
        A_w_neg = A_0 * ((1 + r_neg)**w_negative) + c * (((1 + r_neg)**w_negative - 1) / r_neg)
        t_ret = t - w_negative
        val = A_w_neg * ((1 + r_neg)**t_ret) - b * (((1 + r_neg)**(t_ret + 1) - (1 + r_neg)) / r_neg)
    nw_neg_curve.append(val)

fig3, ax3 = plt.subplots(figsize=(7.5, 4.5), layout='tight')


# Plot foreground optimized brand engine portfolio path
ax3.plot(ages_eval[mask_acc], np.array(nw_exp)[mask_acc], color=mp_green, linewidth=2.5, label='+3% Real Growth (Accumulation Phase)')
ax3.plot(ages_eval[mask_dep], np.array(nw_exp)[mask_dep], color=mp_red, linewidth=2.5, label='+3% Real Growth (Depletion Phase)')

# Plot background macro reference environments
ax3.plot(ages_eval, nw_lin_curve := [A_0 + c * (a - A_start) if (a - A_start) <= w_linear else L + b * (A_end - a) for a in ages_eval], 
         color=mp_grey, linewidth=1.75, linestyle='--', label='0% Real Growth (Keeping up with inflation)')
ax3.plot(ages_eval, nw_neg_curve, 
         color=mp_light_grey, linewidth=1.75, linestyle=':', label='-3% Real Growth (Checking account with 0% rate, losing to 3% inflation)')

# Highlight peak timeline transitions across environments
A_w_neg_peak = nw_neg_curve[np.argmin(np.abs((ages_eval - A_start) - w_negative))]
ax3.plot(age_retire_exp, A_w_exponential, marker='o', color=mp_dark, markersize=7, zorder=5)
ax3.plot(age_retire_linear, A_w_linear, marker='o', color=mp_grey, markersize=5, zorder=4)
ax3.plot(age_retire_neg, A_w_neg_peak, marker='o', color=mp_light_grey, markersize=5, zorder=4)

# Visual Callout Annotations
ax3.annotate(f'Asset Peak\nAge {age_retire_exp:.1f}\n${int(A_w_exponential):,}', 
             xy=(age_retire_exp, A_w_exponential), xytext=(age_retire_exp - 20, A_w_exponential - 110000),
             color=mp_dark, weight='bold', size=8.5, arrowprops=dict(arrowstyle='->', color=mp_dark, lw=0.8))

ax3.annotate(f'Age {age_retire_linear:.1f}', xy=(age_retire_linear, A_w_linear), xytext=(age_retire_linear + 2, A_w_linear + 8000),
             color=mp_grey, size=8.5, weight='bold')
ax3.annotate(f'Age {age_retire_neg:.1f}', xy=(age_retire_neg, A_w_neg_peak), xytext=(age_retire_neg + 2, A_w_neg_peak - 25000),
             color=mp_grey, size=8.5)

# Formatting Framework
ax3.set_title('Trajectory Comparison', color=mp_dark, weight='bold', pad=14)
ax3.set_xlabel('Age (Years)', color=mp_dark, weight='bold')
ax3.set_ylabel('Net Worth ($)', color=mp_dark, weight='bold')
ax3.set_xlim(A_start, A_end)
ax3.set_ylim(0, 1100000)
ax3.get_yaxis().set_major_formatter(plt.FuncFormatter(lambda x, loc: "{:,}".format(int(x))))
ax3.grid(True)
ax3.legend(loc='center left', frameon=True, facecolor='#ffffff', edgecolor='#e2e8f0', fontsize=8.2)

for spine in ['top', 'right']: ax3.spines[spine].set_visible(False)
for spine in ['left', 'bottom']: ax3.spines[spine].set_color('#cbd5e1')

plt.savefig('visual-assets/comparison_plot.pdf', format='pdf', bbox_inches='tight')
plt.close()

print("Execution complete. All 3 math-verified whitepaper files successfully outputted to visual-assets/")