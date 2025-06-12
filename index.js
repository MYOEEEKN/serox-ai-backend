// index.js - SEROX AI Backend Server
// VERSION 5.0 - Fully compatible with Modular Consensus Core (v60.0+)
// =================================================================
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

// --- Core Application Imports ---
// Import the main prediction function from the modular architecture
import { ultraAIPredict } from './main.js';
// Import utility functions
import { getBigSmallFromNumber } from './utils.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Server state variables (in-memory storage)
let lastFetchedPeriodFromExternalAPI = null;
let isProcessingPrediction = false;
let inMemoryHistory = [];
// This object is the "shared memory" for the AI. It's passed to the AI on each call
// and allows the AI to maintain its state (like defensive mode, evolving weights, etc.)
let inMemorySharedStats = {};
let inMemoryCurrentPrediction = null;
const MAX_HISTORY_LENGTH = 150; // Increased for deeper analysis

// Fetches the latest game result from the external API
async function fetchExternalGameResult() {
    console.log("Backend: Attempting to fetch game result from external API...");
    try {
        const response = await fetch("https://api.bdg88zf.com/api/webapi/GetNoaverageEmerdList", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pageSize: 10, pageNo: 1, typeId: 1, language: 0,
                // Note: These might need to be updated if the API changes
                random: "4a0522c6ecd8410496260e686be2a57c",
                signature: "334B5E70A0C9B8918B0B15E517E2069C",
                timestamp: Math.floor(Date.now() / 1000)
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`External API Error: ${response.status} - ${errorText.substring(0,100)}`);
        }
        const data = await response.json();
        if (data && data.code === 0 && data.data && data.data.list && data.data.list.length > 0) {
            return data.data.list[0];
        } else {
            throw new Error(`External API Data Error: ${data.msg || 'Unexpected structure'}`);
        }
    } catch (e) {
        console.error("Backend: Fetch External API Exception:", e);
        throw e; // Re-throw to be caught by the endpoint handler
    }
}


// POST /predict - The main endpoint for the frontend to get predictions
app.post('/predict', async (req, res) => {
    if (isProcessingPrediction) {
        return res.status(429).json({ success: false, message: "Prediction cycle already in progress." });
    }

    console.log(`Backend: /predict request received.`);

    try {
        isProcessingPrediction = true;

        const gameApiResult = await fetchExternalGameResult();
        const endedPeriodFull = gameApiResult.issueNumber.trim();

        if (endedPeriodFull === lastFetchedPeriodFromExternalAPI) {
            console.log(`Backend: Period ${endedPeriodFull} already processed. Sending current data.`);
            isProcessingPrediction = false;
            return res.json({
                success: true,
                message: "Period already processed.",
                currentPrediction: inMemoryCurrentPrediction,
                history: inMemoryHistory.slice(0, 50)
            });
        }

        const actualNumber = Number(gameApiResult.number);
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

            // Find the corresponding entry in history and update its status
            const historyEntryToUpdate = inMemoryHistory.find(entry => entry.period === endedPeriodFull);
            if(historyEntryToUpdate) {
                historyEntryToUpdate.status = statusOfPreviousPrediction;
            }

            // Pass crucial stats from the last cycle back to the AI for learning
            inMemorySharedStats.lastActualOutcome = actualNumber; // Pass the actual number for analysis
            inMemorySharedStats.lastPredictedOutcome = previousSharedPrediction.prediction; // Pass the prediction made
            inMemorySharedStats.lastConfidenceLevel = previousSharedPrediction.confidenceLevel; // Pass the confidence level
        }

        // Add the latest result to the start of the history array
        inMemoryHistory.unshift({
            period: endedPeriodFull,
            actual: actualNumber,
            actualNumber: actualNumber, // Add for compatibility with prediction logic
            resultType: actualResultType,
            status: 'Pending', // Status will be updated on the next cycle
            timestamp: Date.now()
        });

        // Keep history trimmed to a max length
        if (inMemoryHistory.length > MAX_HISTORY_LENGTH) {
            inMemoryHistory.pop();
        }

        lastFetchedPeriodFromExternalAPI = endedPeriodFull;

        // ---- CALL THE AI CORE ----
        // The AI logic needs the full, updated history and the shared stats object.
        // The function will mutate the inMemorySharedStats object with its new state.
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

        // Store the latest prediction in memory
        inMemoryCurrentPrediction = newPredictionData;

        console.log(`Backend: Sending response for period ${newPredictionData.period}`);
        res.json({
            success: true,
            message: "Prediction cycle complete.",
            currentPrediction: newPredictionData,
            history: inMemoryHistory.slice(0, 50) // Send a slice of recent history
        });

    } catch (error) {
        console.error("Error in /predict endpoint:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error." });
    } finally {
        isProcessingPrediction = false;
    }
});

// Root endpoint for keep-alive services (like UptimeRobot)
app.get('/', (req, res) => {
    res.send('SEROX AI Backend (Consensus Core v60.0) is running.');
});

// Function to start the server
function startServer() {
    app.listen(PORT, () => {
        console.log(`SEROX AI backend server running on port ${PORT}`);
    });
}

startServer();
