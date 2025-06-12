// index.js - SEROX AI Backend Server
// VERSION 6.0 - Final Architecture (Frontend-First Data Fetching)
// =================================================================
import express from 'express';
import cors from 'cors';

// --- Core Application Imports ---
import { ultraAIPredict } from './main.js';
import { getBigSmallFromNumber } from './utils.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Server state variables (in-memory storage)
let lastProcessedPeriod = null;
let inMemoryHistory = [];
let inMemorySharedStats = {};
let inMemoryCurrentPrediction = null;
const MAX_HISTORY_LENGTH = 150;

// The main endpoint for the frontend to get predictions
app.post('/predict', async (req, res) => {
    // The frontend now sends the game result in the request body
    const { gameResult } = req.body;

    if (!gameResult || !gameResult.issueNumber) {
        return res.status(400).json({ success: false, message: "Missing gameResult in request body." });
    }

    try {
        const endedPeriodFull = gameResult.issueNumber.trim();

        // Check if this period has already been processed to prevent duplicates
        if (endedPeriodFull === lastProcessedPeriod) {
            console.log(`Backend: Period ${endedPeriodFull} already processed. Sending current data.`);
            return res.json({
                success: true,
                message: "Period already processed.",
                currentPrediction: inMemoryCurrentPrediction,
                history: inMemoryHistory.slice(0, 50)
            });
        }

        const actualNumber = Number(gameResult.number);
        const actualResultType = getBigSmallFromNumber(actualNumber);
        const previousSharedPrediction = inMemoryCurrentPrediction;

        // Update the history with the result of the *previous* prediction
        if (previousSharedPrediction && previousSharedPrediction.period === endedPeriodFull) {
            let statusOfPreviousPrediction = 'Loss';
             if (previousSharedPrediction.prediction === 'DEFENSIVE_MODE' || previousSharedPrediction.prediction === 'COOLDOWN') {
                statusOfPreviousPrediction = 'Cooldown';
            } else if (actualResultType === previousSharedPrediction.prediction) {
                statusOfPreviousPrediction = 'Win';
            }

            // Find the history entry for the prediction we just got the result for and update its status
            const historyEntryToUpdate = inMemoryHistory.find(entry => entry.period === endedPeriodFull);
            if(historyEntryToUpdate) {
                historyEntryToUpdate.status = statusOfPreviousPrediction;
            }

            // Pass the results back to the AI for learning
            inMemorySharedStats.lastActualOutcome = actualNumber;
            inMemorySharedStats.lastPredictedOutcome = previousSharedPrediction.prediction;
            inMemorySharedStats.lastConfidenceLevel = previousSharedPrediction.confidenceLevel;
        }

        // Add the new result to the top of our history
        inMemoryHistory.unshift({
            period: endedPeriodFull,
            actual: actualNumber,
            actualNumber: actualNumber,
            resultType: actualResultType,
            status: 'Pending', // This will be updated on the next cycle
            timestamp: Date.now()
        });

        if (inMemoryHistory.length > MAX_HISTORY_LENGTH) {
            inMemoryHistory.pop();
        }

        lastProcessedPeriod = endedPeriodFull;

        // ---- CALL THE AI CORE ----
        const aiDecision = ultraAIPredict(inMemoryHistory, inMemorySharedStats);
        // -------------------------

        const nextPeriodToPredictFull = (BigInt(endedPeriodFull) + 1n).toString();
        const newPredictionData = {
            period: nextPeriodToPredictFull,
            prediction: aiDecision.finalDecision,
            confidence: aiDecision.finalConfidence ? Math.round(aiDecision.finalConfidence * 100) : 50,
            confidenceLevel: aiDecision.confidenceLevel,
            overallLogic: aiDecision.overallLogic,
            source: aiDecision.source,
            systemHealth: aiDecision.systemHealth,
            timestamp: Date.now()
        };

        inMemoryCurrentPrediction = newPredictionData;

        res.json({
            success: true,
            message: "Prediction cycle complete.",
            currentPrediction: newPredictionData,
            history: inMemoryHistory.slice(0, 50)
        });

    } catch (error) {
        console.error("Error in /predict endpoint:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error." });
    }
});

// Root endpoint for keep-alive services
app.get('/', (req, res) => {
    res.send('SEROX AI Backend (Consensus Core v60.5) is running.');
});

// Function to start the server
function startServer() {
    app.listen(PORT, () => {
        console.log(`SEROX AI backend server running on port ${PORT}`);
    });
}

startServer();
