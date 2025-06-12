// index.js - SEROX AI Backend Server
// VERSION 5.3 - Implemented Proxy for 403 Forbidden Hotfix
// =================================================================
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

// --- Core Application Imports ---
import { ultraAIPredict } from './main.js';
import { getBigSmallFromNumber } from './utils.js';

const app = express();
const PORT = process.env.PORT || 3000;
// FIX: Define the URL for your proxy server
const PROXY_URL = 'http://localhost:3001/proxy'; // Use this for local testing
// const PROXY_URL = 'https://your-proxy-service-name.onrender.com/proxy'; // Use this for production

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Server state variables (in-memory storage)
let lastFetchedPeriodFromExternalAPI = null;
let isProcessingPrediction = false;
let inMemoryHistory = [];
let inMemorySharedStats = {};
let inMemoryCurrentPrediction = null;
const MAX_HISTORY_LENGTH = 150;

// Fetches the latest game result via the proxy server
async function fetchExternalGameResult() {
    console.log("Backend: Requesting game result via proxy...");
    try {
        const response = await fetch(PROXY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ // This body will be forwarded by the proxy
                pageSize: 10, pageNo: 1, typeId: 1, language: 0,
                random: "4a0522c6ecd8410496260e686be2a57c",
                signature: "334B5E70A0C9B8918B0B15E517E2069C",
                timestamp: Math.floor(Date.now() / 1000)
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Proxy Forwarding Error: ${response.status} - ${errorText.substring(0,150)}`);
        }
        const data = await response.json();
        if (data && data.code === 0 && data.data && data.data.list && data.data.list.length > 0) {
            return data.data.list[0];
        } else {
            throw new Error(`Proxied API Data Error: ${data.msg || 'Unexpected structure'}`);
        }
    } catch (e) {
        console.error("Backend: Fetch via Proxy Exception:", e);
        throw e;
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

        if (previousSharedPrediction && previousSharedPrediction.period === endedPeriodFull) {
            let statusOfPreviousPrediction = 'Loss';
            if (previousSharedPrediction.prediction === 'DEFENSIVE_MODE' || previousSharedPrediction.prediction === 'COOLDOWN') {
                statusOfPreviousPrediction = 'Cooldown';
            } else if (actualResultType === previousSharedPrediction.prediction) {
                statusOfPreviousPrediction = 'Win';
            }

            const historyEntryToUpdate = inMemoryHistory.find(entry => entry.period === endedPeriodFull);
            if(historyEntryToUpdate) {
                historyEntryToUpdate.status = statusOfPreviousPrediction;
            }

            inMemorySharedStats.lastActualOutcome = actualNumber;
            inMemorySharedStats.lastPredictedOutcome = previousSharedPrediction.prediction;
            inMemorySharedStats.lastConfidenceLevel = previousSharedPrediction.confidenceLevel;
        }

        inMemoryHistory.unshift({
            period: endedPeriodFull,
            actual: actualNumber,
            actualNumber: actualNumber,
            resultType: actualResultType,
            status: 'Pending',
            timestamp: Date.now()
        });

        if (inMemoryHistory.length > MAX_HISTORY_LENGTH) {
            inMemoryHistory.pop();
        }

        lastFetchedPeriodFromExternalAPI = endedPeriodFull;

        const aiDecision = ultraAIPredict(inMemoryHistory, inMemorySharedStats);

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

        console.log(`Backend: Sending response for period ${newPredictionData.period}`);
        res.json({
            success: true,
            message: "Prediction cycle complete.",
            currentPrediction: newPredictionData,
            history: inMemoryHistory.slice(0, 50)
        });

    } catch (error) {
        console.error("Error in /predict endpoint:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error." });
    } finally {
        isProcessingPrediction = false;
    }
});

// Root endpoint for keep-alive services
app.get('/', (req, res) => {
    res.send('SEROX AI Backend (Consensus Core v60.3) is running.');
});

// Function to start the server
function startServer() {
    app.listen(PORT, () => {
        console.log(`SEROX AI backend server running on port ${PORT}`);
    });
}

startServer();
