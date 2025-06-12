// main.js - The Consensus Core Orchestrator
// Version: 60.1.0 - "Modular Architecture - Hotfix"

// --- Import Core Systems ---
import { getBigSmallFromNumber } from './utils.js';
// FIX: Correctly import 'evolveMLWeights' from state.js
import { systemState, evolveSystemParameters, manageDefensiveMode, evolveMLWeights } from './state.js';
import {
    analyzeUnifiedMLModel,
    createFeatureSetForML
} from './primary_model.js';
import { runAdvisoryModels } from './advisory_models.js';
import { updateMarketSentiment } from './market_sentiment.js';

// --- The Main Prediction Function ---
function ultraAIPredict(currentSharedHistory, sharedStatsPayload) {
    const confirmedHistory = currentSharedHistory.filter(p => p && p.actual !== null && p.actualNumber !== undefined);

    if (confirmedHistory.length < systemState.MIN_HISTORY) {
        return {
            finalDecision: Math.random() > 0.5 ? "BIG" : "SMALL",
            confidenceLevel: 1,
            source: "ConsensusCore-v60.1",
            systemHealth: "INSUFFICIENT_HISTORY"
        };
    }

    // --- State Management & Evolution ---
    if (confirmedHistory.length % 5 === 0) {
        if (sharedStatsPayload.longTermGlobalAccuracy) {
            evolveSystemParameters(sharedStatsPayload.longTermGlobalAccuracy);
        }
        evolveMLWeights(confirmedHistory);
        updateMarketSentiment();
    }

    const lastResult = sharedStatsPayload?.lastActualOutcome ? {
        status: getBigSmallFromNumber(sharedStatsPayload.lastActualOutcome) === sharedStatsPayload.lastPredictedOutcome ? "Win" : "Loss"
    } : null;

    if (lastResult) {
        manageDefensiveMode(confirmedHistory);
    }

    // --- Prediction Pipeline ---
    // Stage 1: Generate Features and Primary Prediction
    const mlFeatures = createFeatureSetForML(confirmedHistory);
    const primaryModel = analyzeUnifiedMLModel(mlFeatures);

    if (!primaryModel) {
        return {
            finalDecision: Math.random() > 0.5 ? "BIG" : "SMALL",
            confidenceLevel: 0,
            source: "ConsensusCore-v60.1",
            systemHealth: "MODEL_UNCERTAIN"
        };
    }

    // Stage 2: Run Advisory Models for Consensus
    const { advisorySignals, consensusScore, agreeingModels, totalAdvisors } = runAdvisoryModels(confirmedHistory, primaryModel.prediction);

    // Stage 3: Calculate Final Confidence
    let finalConfidence = primaryModel.confidence * (0.6 + (consensusScore * 0.4));
    if (systemState.DEFENSIVE_MODE_ACTIVE) {
        finalConfidence *= 0.7;
    }

    let confidenceLevel = (finalConfidence > 0.55) ? 1 : 0;
    if (systemState.DEFENSIVE_MODE_ACTIVE) {
        confidenceLevel = 0;
    }

    const output = {
        finalDecision: primaryModel.prediction,
        finalConfidence,
        confidenceLevel,
        overallLogic: "ConsensusCore-v60.1",
        source: `ML+${agreeingModels}/${totalAdvisors}_Advisors`,
        systemHealth: systemState.DEFENSIVE_MODE_ACTIVE ? `DEFENSIVE_MODE` : "OK",
        advisorySignals // Include for debugging
    };

    // Persist data for learning
    Object.assign(sharedStatsPayload, {
        ...output,
        lastPredictedOutcome: output.finalDecision,
        mlFeatures: mlFeatures,
        status: lastResult ? lastResult.status : 'Pending'
    });

    console.log(`ConsensusCore v60.1: ${output.finalDecision} @ Lvl:${output.confidenceLevel} | Conf:${output.finalConfidence.toFixed(2)} | Source: ${output.source}`);
    return output;
}

// Export the main function
export { ultraAIPredict };
