// market_sentiment.js - Real-Time Data Analysis Simulation

// --- State for Market Simulation ---
let marketEvents = []; // Stores active news events
const NEWS_EVENT_PROBABILITY = 0.05; // 5% chance per prediction
const EVENT_IMPACT_DECAY_RATE = 0.90; // Impact reduces by 10% each cycle

// --- Simulation Functions ---

export function updateMarketSentiment() {
    // 1. Decay the impact of existing events
    marketEvents = marketEvents.map(event => ({
        ...event,
        impact: event.impact * EVENT_IMPACT_DECAY_RATE
    })).filter(event => Math.abs(event.impact) > 0.05); // Remove events that have decayed to insignificance

    // 2. Randomly create a new event
    if (Math.random() < NEWS_EVENT_PROBABILITY) {
        const isPositive = Math.random() > 0.5;
        const newEvent = {
            type: isPositive ? 'PositiveNews' : 'NegativeNews',
            impact: isPositive ? 1.0 : -1.0, // Initial impact score
            timestamp: Date.now()
        };
        marketEvents.push(newEvent);
        console.log(`Market Event Created: ${newEvent.type} with impact ${newEvent.impact}`);
    }
}

export function getMarketSentimentFactor() {
    if (marketEvents.length === 0) {
        return 0.0;
    }
    // The total sentiment is the sum of impacts of all active events
    const totalImpact = marketEvents.reduce((acc, event) => acc + event.impact, 0);
    // Clamp the value to a reasonable range [-1, 1]
    return Math.max(-1, Math.min(1, totalImpact));
}
