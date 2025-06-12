// utils.js - Core Calculation Utilities

// --- Data Transformation ---

export function getBigSmallFromNumber(number) {
    if (number === undefined || number === null) return null;
    const num = parseInt(number);
    if (isNaN(num)) return null;
    return num >= 0 && num <= 4 ? 'SMALL' : num >= 5 && num <= 9 ? 'BIG' : null;
}

// --- Mathematical Indicators ---

export function calculateSMA(data, period) {
    if (!Array.isArray(data) || data.length < period || period <= 0) return null;
    const relevantData = data.slice(0, period);
    const sum = relevantData.reduce((a, b) => a + b, 0);
    return sum / period;
}

export function calculateEMA(data, period) {
    if (!Array.isArray(data) || data.length < period || period <= 0) return null;
    const k = 2 / (period + 1);
    const chronologicalData = data.slice().reverse(); // Process from oldest to newest

    // Initial EMA is a SMA of the first 'period' data points
    let ema = calculateSMA(chronologicalData.slice(0, period).reverse(), period);
    if (ema === null) return null; // Not enough data for the initial SMA

    // Calculate the rest of the EMA
    for (let i = period; i < chronologicalData.length; i++) {
        ema = (chronologicalData[i] * k) + (ema * (1 - k));
    }
    return ema;
}

export function calculateStdDev(data, period) {
    if (!Array.isArray(data) || data.length < period || period <= 0) return null;
    const relevantData = data.slice(0, period);
    if (relevantData.length < 2) return null;

    const mean = calculateSMA(relevantData, relevantData.length);
    if (mean === null) return null;

    // Calculate variance
    const variance = relevantData.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (relevantData.length - 1); // Sample StDev
    return Math.sqrt(variance);
}

export function calculateRSI(data, period) {
    if (!Array.isArray(data) || data.length < period + 1) return null;
    const chronologicalData = data.slice().reverse(); // Process from oldest to newest

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain/loss
    for (let i = 1; i <= period; i++) {
        const change = chronologicalData[i] - chronologicalData[i - 1];
        if (change > 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Smooth the rest
    for (let i = period + 1; i < chronologicalData.length; i++) {
        const change = chronologicalData[i] - chronologicalData[i - 1];
        const currentGain = change > 0 ? change : 0;
        const currentLoss = change < 0 ? Math.abs(change) : 0;

        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    }

    if (avgLoss === 0) return 100; // RSI is 100 if there are no losses

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}
