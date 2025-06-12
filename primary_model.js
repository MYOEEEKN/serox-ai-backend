// primary_model.js - The Primary Learning Model Engine

import { systemState, mlFeatureWeights } from './state.js';
import { calculateRSI, calculateEMA, calculateStdDev, calculateSMA } from './utils.js';

function getTrendContext(history, longMALookback = 20) {
    const numbers = history.map(entry => entry.actualNumber).filter(n => !isNaN(n));
    if (numbers.length < longMALookback) return { strength: "UNKNOWN", direction: "NONE" };

    const shortMA = calculateEMA(numbers, 5);
    const mediumMA = calculateEMA(numbers, 10);
    const longMA = calculateEMA(numbers, longMALookback);
    if (shortMA === null || mediumMA === null || longMA === null) return { strength: "UNKNOWN", direction: "NONE" };

    let direction = "NONE", strength = "WEAK";
    if (shortMA > mediumMA && mediumMA > longMA) {
        direction = "BIG";
        strength = "STRONG";
    } else if (shortMA < mediumMA && mediumMA < longMA) {
        direction = "SMALL";
        strength = "STRONG";
    } else {
        strength = "RANGING";
    }
    return { strength, direction };
}

export function createFeatureSetForML(history) {
    const numbers = history.map(e => e.actualNumber).filter(n => !isNaN(n));
    if (numbers.length < systemState.MIN_HISTORY) return null;

    const trendContext = getTrendContext(history);
    const rsiValue = calculateRSI(numbers, 14);
    const macdLine = calculateEMA(numbers, 12) - calculateEMA(numbers, 26);
    const signalLine = calculateEMA(numbers.map((_, i) => calculateEMA(numbers.slice(i), 12) - calculateEMA(numbers.slice(i), 26)).filter(n => n !== null), 9);
    const sma20 = calculateSMA(numbers, 20);
    const stdDev20 = calculateStdDev(numbers, 20);

    let bollingerPct = 0;
    if (sma20 && stdDev20) {
        const upperBand = sma20 + (stdDev20 * 2.0);
        const lowerBand = sma20 - (stdDev20 * 2.0);
        if (upperBand - lowerBand > 0) {
            bollingerPct = (numbers[0] - lowerBand) / (upperBand - lowerBand);
        }
    }

    return {
        rsi_strength: rsiValue ? (rsiValue - 50) / 50 : 0,
        rsi_is_overbought: rsiValue && rsiValue > 70 ? 1 : 0,
        rsi_is_oversold: rsiValue && rsiValue < 30 ? -1 : 0,
        macd_hist: macdLine && signalLine ? macdLine - signalLine : 0,
        trend_strength_score: trendContext.strength === 'STRONG' ? (trendContext.direction.includes('BIG') ? 1 : -1) : 0,
        bollinger_pct_reversal: bollingerPct > 1 ? bollingerPct - 1 : (bollingerPct < 0 ? bollingerPct : 0),
        last_move: numbers[0] > numbers[1] ? 1 : -1,
    };
}

export function analyzeUnifiedMLModel(features) {
    if (!features) return null;

    let bigScore = 0;
    let smallScore = 0;

    for (const key in features) {
        if (mlFeatureWeights[key] !== undefined) {
            const weight = mlFeatureWeights[key];
            const featureValue = features[key];

            // If weight is positive, positive feature value contributes to BIG
            // If weight is negative, positive feature value contributes to SMALL
            if (weight > 0) {
                if (featureValue > 0) bigScore += featureValue * weight;
                else smallScore += Math.abs(featureValue * weight);
            } else { // Negative weight reverses the logic
                if (featureValue > 0) smallScore += featureValue * Math.abs(weight);
                else bigScore += Math.abs(featureValue * Math.abs(weight));
            }
        }
    }

    const totalScore = bigScore + smallScore;
    if (totalScore === 0) return null;

    const confidence = Math.abs(bigScore - smallScore) / totalScore;
    const prediction = bigScore > smallScore ? "BIG" : "SMALL";
    return { prediction, confidence, source: "LearningML" };
}
