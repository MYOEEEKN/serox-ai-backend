// state.js - System State & Evolution Management

import { getBigSmallFromNumber } from './utils.js';

// --- Centralized System State ---
export let systemState = {
    MIN_HISTORY: 100,
    BAD_TREND_THRESHOLD: 0.45,
    TARGET_ACCURACY: 0.54,
    EVOLUTION_RATE: 0.005,
    DEFENSIVE_MODE_ACTIVE: false,
};

// --- Evolving Feature Weights for the Primary ML Model ---
export let mlFeatureWeights = {
    // Core Indicators
    rsi_strength: 1.5,
    rsi_is_overbought: -2.0,
    rsi_is_oversold: 2.0,
    macd_hist: 2.5,
    trend_strength_score: 3.0,

    // Price Action & Volatility
    bollinger_pct_reversal: -2.5,
    last_move: 0.5,
    volatility_expansion: 1.2,

    // External Factors
    market_sentiment: 1.0,

    // New Advisory Model Features
    stochastic_k: -1.8, // Reversal signal
    rsi_trend_strength: 1.0,
};

// --- State Management Functions ---

export function evolveSystemParameters(globalAccuracy) {
    if (globalAccuracy < systemState.TARGET_ACCURACY - 0.02) {
        systemState.BAD_TREND_THRESHOLD = Math.min(0.48, systemState.BAD_TREND_THRESHOLD + systemState.EVOLUTION_RATE);
    } else if (globalAccuracy > systemState.TARGET_ACCURACY + 0.02) {
        systemState.BAD_TREND_THRESHOLD = Math.max(0.42, systemState.BAD_TREND_THRESHOLD - systemState.EVOLUTION_RATE);
    }
}

export function evolveMLWeights(history) {
    const learningRate = 0.01;
    const recentTrades = history.filter(p => p.mlFeatures && p.status).slice(0, 50);
    if (recentTrades.length < 20) return;

    let adjustments = Object.keys(mlFeatureWeights).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});

    for (const trade of recentTrades) {
        const wasCorrect = trade.status === "Win";
        const wasBigPrediction = trade.lastPredictedOutcome === "BIG";
        for (const key in trade.mlFeatures) {
            if (mlFeatureWeights[key] === undefined) continue;

            const featureValue = trade.mlFeatures[key];
            const featureImpactIsBig = featureValue * mlFeatureWeights[key] > 0;
            const wasFeatureAlignedWithPrediction = wasBigPrediction ? featureImpactIsBig : !featureImpactIsBig;

            if (wasCorrect && wasFeatureAlignedWithPrediction) {
                adjustments[key] += learningRate;
            } else if (!wasCorrect && wasFeatureAlignedWithPrediction) {
                adjustments[key] -= learningRate;
            }
        }
    }

    for (const key in mlFeatureWeights) {
        mlFeatureWeights[key] = Math.max(0.1, Math.min(5.0, mlFeatureWeights[key] + adjustments[key]));
    }
}

function detectBadTrend(history) {
    const BAD_TREND_WINDOW = 30;
    if (!history || history.length < BAD_TREND_WINDOW) return false;
    const recentHistory = history.slice(0, BAD_TREND_WINDOW);
    const wins = recentHistory.filter(p => p.status === "Win").length;
    const losses = recentHistory.filter(p => p.status === "Loss").length;
    if (wins + losses < 15) return false;
    const accuracy = wins / (wins + losses);
    return accuracy < systemState.BAD_TREND_THRESHOLD;
}

export function manageDefensiveMode(history) {
    if (detectBadTrend(history)) {
        systemState.DEFENSIVE_MODE_ACTIVE = true;
    }
    const last3 = history.slice(0, 3).map(p => p.status);
    if (systemState.DEFENSIVE_MODE_ACTIVE && last3.length === 3 && last3.every(s => s === 'Win')) {
        systemState.DEFENSIVE_MODE_ACTIVE = false;
    }
}
