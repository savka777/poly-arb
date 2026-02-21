# EV Formula Spec (Math-First)

This document defines the final Expected Value formulation for Darwin Capital using a quantitative, reliability-focused approach suitable for professional trading workflows.

## 1) Net Expected Value

\[
\textbf{EV}_{net} = (p_{hat} - p_m) - c_{fee} - c_{slip} - c_{lat} - c_{res}
\]

Trade candidate passes only if EV remains positive after explicit cost and risk penalties.

## 2) Trade Decision Rule

\[
\Pr(\textbf{EV}_{net} > 0) > \tau
\quad\text{and}\quad
\textbf{EV}_{net}^{LB} > 0
\]

Lower-bound EV:

\[
\textbf{EV}_{net}^{LB} = (p_{hat}^{LB} - p_m) - c_{fee} - c_{slip} - c_{lat} - c_{res}
\]

This enforces robustness under uncertainty, not just point-estimate optimism.

## 3) Probability Construction (Market Prior + Evidence)

\[
\text{logit}(p_{hat}) = \text{logit}(p_m) + w_n z_n + w_f z_f + w_t z_t + w_x z_x
\]

\[
p_{hat} = \sigma(\text{logit}(p_{hat}))
\]

Use market price as prior; add model evidence in log-odds space.

## 4) Position Sizing (Risk-Adjusted Fractional Kelly)

\[
f = \lambda \cdot \frac{p_{hat}(1-p_e) - (1-p_{hat})p_e}{p_e(1-p_e)}
\]

\[
f_{adj} = f \cdot \kappa_{cal} \cdot \kappa_{unc}
\]

Where sizing is reduced by calibration and uncertainty haircuts.

## 5) Final Variables

- \(p_m\): current market implied probability (YES price)
- \(p_{hat}\): model-estimated true probability after all signals
- \(p_{hat}^{LB}\): lower confidence bound of \(p_{hat}\)
- \(c_{fee}\): total fee cost (entry + exit, probability-equivalent)
- \(c_{slip}\): expected slippage/impact cost
- \(c_{lat}\): latency decay cost
- \(c_{res}\): resolution-risk penalty
- \(\tau\): minimum confidence threshold (example: 0.70)
- \(z_n\): normalized news feature score
- \(z_f\): normalized order-flow/microstructure score
- \(z_t\): normalized time-to-resolution feature
- \(z_x\): normalized cross-market divergence feature
- \(w_n,w_f,w_t,w_x\): learned feature weights
- \(\sigma(\cdot)\): logistic sigmoid
- \(\lambda\): fractional Kelly multiplier (example: 0.1-0.3)
- \(p_e\): execution price (entry price)
- \(f\): raw Kelly fraction
- \(f_{adj}\): final position fraction after risk haircuts
- \(\kappa_{cal}\): calibration haircut factor (0-1)
- \(\kappa_{unc}\): uncertainty haircut factor (0-1)

## 6) Practical Notes

- LLM output should be treated as feature input (e.g., \(z_n\)), not as final EV.
- Calibration is mandatory (Brier/log-loss tracking) before trusting \(p_{hat}\) in production sizing.
- Costs/penalties must be estimated consistently in the same probability-equivalent units.
