// advisory_models.js - The Council of Secondary Prediction Engines

import {
    calculateSMA,
    calculateStdDev,
    calculateRSI,
    getBigSmallFromNumber
} from './utils.js';

// --- Advisory Model Runner ---
export function runAdvisoryModels(history, primaryPrediction) {
    const models = [
        analyzeRSITrend(history),
        analyzeStochastic(history),
        analyzeColorPatterns(history),
        analyzeVolatilityBreakout(history),
        analyzePriceAction(history),
        analyzeMeanReversion(history) // New model
    ];

    const advisorySignals = models.filter(m => m !== null);
    let agreeingModels = 0;

    advisorySignals.forEach(model => {
        if (model.prediction === primaryPrediction) {
            agreeingModels++;
        }
    });

    const totalAdvisors = advisorySignals.length;
    const consensusScore = totalAdvisors > 0 ? (agreeingModels / totalAdvisors) : 0.5; // Default to neutral consensus

    return { advisorySignals, consensusScore, agreeingModels, totalAdvisors };
}

// --- Individual Advisory Models ---

// 1. RSI Trend Engine
function analyzeRSITrend(history, rsiPeriod = 14, rsiMAPeriod = 9) {
    // This model determines if the RSI itself is in an uptrend or downtrend.
    // If RSI is trending up, it signals bullish momentum, and vice-versa.
    const numbers = history.map(p => p.actualNumber).filter(n => !isNaN(n));
    if (numbers.length < rsiPeriod + rsiMAPeriod) return null;

    const rsiValues = [];
    for (let i = rsiMAPeriod - 1; i >= 0; i--) {
        const slice = numbers.slice(i);
        const rsi = calculateRSI(slice, rsiPeriod);
        if (rsi !== null) rsiValues.push(rsi);
        else return null;
    }

    const currentRSI = rsiValues[rsiValues.length - 1];
    const rsiMA = calculateSMA(rsiValues, rsiMAPeriod);

    if (currentRSI > rsiMA + 2) return { prediction: "BIG", source: "RSITrend" };
    if (currentRSI < rsiMA - 2) return { prediction: "SMALL", source: "RSITrend" };
    return null;
}

// 2. Stochastic Oscillator
function analyzeStochastic(history, period = 14) {
    // This model identifies overbought (>80) and oversold (<20) conditions.
    // It predicts a reversal away from these extreme levels.
    const numbers = history.map(p => p.actualNumber).filter(n => !isNaN(n)).slice(0, period);
    if (numbers.length < period) return null;

    const currentPrice = numbers[0];
    const lowestLow = Math.min(...numbers);
    const highestHigh = Math.max(...numbers);

    if (highestHigh === lowestLow) return null;
    const K = 100 * ((currentPrice - lowestLow) / (highestHigh - lowestLow));

    if (K > 85) return { prediction: "SMALL", source: "Stochastic" }; // Overbought, predict reversal to SMALL
    if (K < 15) return { prediction: "BIG", source: "Stochastic" }; // Oversold, predict reversal to BIG
    return null;
}

// 3. Advanced Pattern Recognition Engine
function analyzeColorPatterns(history) {
    // This engine looks for common "color trading" patterns in the last 10 outcomes.
    // A 'B' can be seen as a green candle, 'S' as red.
    const outcomes = history.map(p => getBigSmallFromNumber(p.actual)).slice(0, 10).reverse();
    if (outcomes.length < 5) return null;

    const sequence = outcomes.join('');

    // --- Streak Patterns (Continuation & Reversal) ---
    if (sequence.endsWith('BBBB')) return { prediction: 'BIG', source: 'Pattern:StreakCont' };
    if (sequence.endsWith('SSSS')) return { prediction: 'SMALL', source: 'Pattern:StreakCont' };
    if (sequence.endsWith('BBBBB')) return { prediction: 'SMALL', source: 'Pattern:StreakBreak' };
    if (sequence.endsWith('SSSSS')) return { prediction: 'BIG', source: 'Pattern:StreakBreak' };

    // --- Alternating Patterns ---
    if (sequence.endsWith('BSBS')) return { prediction: 'BIG', source: 'Pattern:AltBreak' }; // Expects the pattern to break with B
    if (sequence.endsWith('SBSB')) return { prediction: 'SMALL', source: 'Pattern:AltBreak' }; // Expects the pattern to break with S

    // --- Interruption (or "sandwich") Patterns ---
    if (sequence.endsWith('BBSBB')) return { prediction: 'BIG', source: 'Pattern:Interrupt' }; // Predicts the dominant trend 'B' will resume
    if (sequence.endsWith('SSBSS')) return { prediction: 'SMALL', source: 'Pattern:Interrupt' }; // Predicts the dominant trend 'S' will resume
    if (sequence.endsWith('BSB')) return { prediction: 'SMALL', source: 'Pattern:DoubleTop' };
    if (sequence.endsWith('SBS')) return { prediction: 'BIG', source: 'Pattern:DoubleBottom' };


    return null;
}

// 4. Volatility Breakout
function analyzeVolatilityBreakout(history, period = 20) {
    // This model assumes that a sudden expansion in volatility indicates that the
    // most recent price move will continue with momentum.
    const numbers = history.map(p => p.actualNumber).filter(n => !isNaN(n));
    if (numbers.length < period * 2) return null;

    const recentSlice = numbers.slice(0, period);
    const priorSlice = numbers.slice(period, period * 2);

    const recentVol = calculateStdDev(recentSlice, period);
    const priorVol = calculateStdDev(priorSlice, period);

    if (recentVol === null || priorVol === null || priorVol === 0) return null;

    // If recent volatility is 80% higher than prior volatility, signal a breakout.
    if (recentVol > priorVol * 1.8) {
        const lastMove = numbers[0] > numbers[1] ? "BIG" : "SMALL";
        return { prediction: lastMove, source: "Volatility" };
    }
    return null;
}

// 5. Price Action (Higher Highs / Lower Lows)
function analyzePriceAction(history) {
    // This fundamental model looks for basic trend structures.
    const numbers = history.map(p => p.actualNumber).filter(n => !isNaN(n)).slice(0, 5);
    if (numbers.length < 5) return null;

    const [p0, p1, p2, p3] = numbers; // p0 is most recent
    // Higher High (p0>p2) and Higher Low (p1>p3) -> Uptrend
    if (p0 > p2 && p1 > p3) return { prediction: 'BIG', source: 'PriceAction' };
    // Lower High (p0<p2) and Lower Low (p1<p3) -> Downtrend
    if (p0 < p2 && p1 < p3) return { prediction: 'SMALL', source: 'PriceAction' };
    return null;
}

// 6. Mean Reversion
function analyzeMeanReversion(history, period = 20) {
    // This model predicts a reversion to the mean if the price is far from its SMA.
    const numbers = history.map(p => p.actualNumber).filter(n => !isNaN(n)).slice(0, period);
    if (numbers.length < period) return null;

    const sma = calculateSMA(numbers, period);
    const stdDev = calculateStdDev(numbers, period);
    if (sma === null || stdDev === null) return null;

    const currentPrice = numbers[0];
    const zScore = (currentPrice - sma) / stdDev;

    // If price is more than 1.5 standard deviations above the mean, predict a fall.
    if (zScore > 1.5) return { prediction: 'SMALL', source: 'MeanReversion' };
    // If price is more than 1.5 standard deviations below the mean, predict a rise.
    if (zScore < -1.5) return { prediction: 'BIG', source: 'MeanReversion' };

    return null;
}
