/**
 * Ensemble Learning Engine
 */

class EnsembleEngine {
    constructor() {
        this.modelWeights = {
            original: 0.20,
            tensorflow: 0.25,
            multiplier: 0.15,
            timeseries: 0.15,
            neural: 0.15,
            reinforcement: 0.10
        };
        
        this.performanceHistory = {};
        this.adaptiveWeights = true;
        
        this.init();
    }
    
    init() {
        console.log('🏆 Initializing Ensemble Engine...');
        this.loadWeights();
    }
    
    loadWeights() {
        try {
            const saved = localStorage.getItem('ensemble_weights');
            if (saved) {
                this.modelWeights = JSON.parse(saved);
                console.log('✅ Loaded ensemble weights');
            }
        } catch (error) {
            console.log('Using default ensemble weights');
        }
    }
    
    saveWeights() {
        localStorage.setItem('ensemble_weights', JSON.stringify(this.modelWeights));
    }
    
    combine(predictions) {
        const combinedScores = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        const contributions = [];
        
        // Original prediction
        if (predictions.original && predictions.original.probabilities) {
            const weight = this.modelWeights.original;
            combinedScores.LOW += (predictions.original.probabilities.LOW?.probability || 33) * weight;
            combinedScores.MEDIUM += (predictions.original.probabilities.MEDIUM?.probability || 34) * weight;
            combinedScores.HIGH += (predictions.original.probabilities.HIGH?.probability || 33) * weight;
            contributions.push({ 
                model: 'Original', 
                weight: weight, 
                scores: predictions.original.probabilities 
            });
        }
        
        // TensorFlow ML prediction
        if (predictions.ml && predictions.ml.probabilities) {
            const weight = this.modelWeights.tensorflow;
            combinedScores.LOW += (predictions.ml.probabilities.LOW || 33) * weight;
            combinedScores.MEDIUM += (predictions.ml.probabilities.MEDIUM || 34) * weight;
            combinedScores.HIGH += (predictions.ml.probabilities.HIGH || 33) * weight;
            contributions.push({ 
                model: 'Neural Network', 
                weight: weight, 
                scores: predictions.ml.probabilities 
            });
        }
        
        // Multiplier analysis
        if (predictions.multiplier && predictions.multiplier.historicalStats) {
            const weight = this.modelWeights.multiplier;
            const multiplierProbs = this.convertMultiplierToProbabilities(predictions.multiplier);
            combinedScores.LOW += multiplierProbs.LOW * weight;
            combinedScores.MEDIUM += multiplierProbs.MEDIUM * weight;
            combinedScores.HIGH += multiplierProbs.HIGH * weight;
            contributions.push({ 
                model: 'Multiplier', 
                weight: weight, 
                scores: multiplierProbs 
            });
        }
        
        // Time-series forecast
        if (predictions.timeSeries && predictions.timeSeries.mostLikelyGroup) {
            const weight = this.modelWeights.timeseries;
            const tsProbs = this.convertTimeSeriesToProbabilities(predictions.timeSeries);
            combinedScores.LOW += tsProbs.LOW * weight;
            combinedScores.MEDIUM += tsProbs.MEDIUM * weight;
            combinedScores.HIGH += tsProbs.HIGH * weight;
            contributions.push({ 
                model: 'Time-series', 
                weight: weight, 
                scores: tsProbs 
            });
        }
        
        // Advanced Neural Network
        if (predictions.neural && predictions.neural.probabilities) {
            const weight = this.modelWeights.neural;
            combinedScores.LOW += (predictions.neural.probabilities.LOW || 33) * weight;
            combinedScores.MEDIUM += (predictions.neural.probabilities.MEDIUM || 34) * weight;
            combinedScores.HIGH += (predictions.neural.probabilities.HIGH || 33) * weight;
            contributions.push({ 
                model: 'Advanced NN', 
                weight: weight, 
                scores: predictions.neural.probabilities 
            });
        }
        
        // Reinforcement Learning
        if (predictions.rl && predictions.rl.group) {
            const weight = this.modelWeights.reinforcement;
            const rlProbs = this.convertRLToProbabilities(predictions.rl);
            combinedScores.LOW += rlProbs.LOW * weight;
            combinedScores.MEDIUM += rlProbs.MEDIUM * weight;
            combinedScores.HIGH += rlProbs.HIGH * weight;
            contributions.push({ 
                model: 'RL Agent', 
                weight: weight, 
                scores: rlProbs 
            });
        }
        
        // Normalize scores
        const total = combinedScores.LOW + combinedScores.MEDIUM + combinedScores.HIGH;
        if (total > 0) {
            combinedScores.LOW = (combinedScores.LOW / total) * 100;
            combinedScores.MEDIUM = (combinedScores.MEDIUM / total) * 100;
            combinedScores.HIGH = (combinedScores.HIGH / total) * 100;
        }
        
        const bestGroup = Object.keys(combinedScores).reduce((a, b) =>
            combinedScores[a] > combinedScores[b] ? a : b
        );
        
        const confidence = combinedScores[bestGroup];
        const explanation = this.generateExplanation(bestGroup, combinedScores, contributions);
        
        return {
            final: {
                group: bestGroup,
                probabilities: combinedScores,
                confidence: confidence
            },
            contributions: contributions,
            explanation: explanation,
            weights: this.modelWeights
        };
    }
    
    convertMultiplierToProbabilities(multiplierPrediction) {
        const stats = multiplierPrediction.historicalStats;
        if (!stats) return { LOW: 33, MEDIUM: 34, HIGH: 33 };
        
        let lowScore = 0, mediumScore = 0, highScore = 0;
        
        for (const [total, data] of Object.entries(stats)) {
            const totalNum = parseInt(total);
            if (totalNum >= 3 && totalNum <= 9) {
                lowScore += data.highMultiplierPercentage || 0;
            } else if (totalNum >= 10 && totalNum <= 11) {
                mediumScore += data.highMultiplierPercentage || 0;
            } else if (totalNum >= 12 && totalNum <= 18) {
                highScore += data.highMultiplierPercentage || 0;
            }
        }
        
        const totalScore = lowScore + mediumScore + highScore;
        if (totalScore === 0) return { LOW: 33, MEDIUM: 34, HIGH: 33 };
        
        return {
            LOW: (lowScore / totalScore) * 100,
            MEDIUM: (mediumScore / totalScore) * 100,
            HIGH: (highScore / totalScore) * 100
        };
    }
    
    convertTimeSeriesToProbabilities(timeSeries) {
        const group = timeSeries.mostLikelyGroup;
        const confidence = timeSeries.confidence || 50;
        
        const probs = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        probs[group] = confidence;
        
        const remaining = 100 - confidence;
        const otherGroups = Object.keys(probs).filter(g => g !== group);
        otherGroups.forEach(g => probs[g] = remaining / 2);
        
        return probs;
    }
    
    convertRLToProbabilities(rl) {
        const group = rl.group;
        const confidence = rl.confidence || 50;
        
        const probs = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        probs[group] = confidence;
        
        const remaining = 100 - confidence;
        const otherGroups = Object.keys(probs).filter(g => g !== group);
        otherGroups.forEach(g => probs[g] = remaining / 2);
        
        return probs;
    }
    
    generateExplanation(bestGroup, scores, contributions) {
        const topContributors = contributions
            .filter(c => c.scores && c.scores[bestGroup])
            .sort((a, b) => (b.scores[bestGroup] || 0) - (a.scores[bestGroup] || 0))
            .slice(0, 3);
        
        let explanation = `🎯 Ensemble predicts ${bestGroup} group with ${Math.round(scores[bestGroup])}% confidence. `;
        
        if (topContributors.length > 0) {
            explanation += `Top contributors: `;
            topContributors.forEach((c, i) => {
                explanation += `${c.model} (${Math.round(c.scores[bestGroup])}%)`;
                if (i < topContributors.length - 1) explanation += ', ';
            });
        }
        
        return explanation;
    }
    
    updateUI(result) {
        const ensembleGroupEl = document.getElementById('ensembleGroup');
        const confidenceFillEl = document.getElementById('confidenceFill');
        const confidenceTextEl = document.getElementById('ensembleConfidence');
        const explanationEl = document.getElementById('ensembleExplanation');
        const weightsListEl = document.getElementById('modelWeights');
        
        const final = result.final;
        const groupIcon = final.group === 'LOW' ? '🔴' : final.group === 'MEDIUM' ? '🟡' : '🟢';
        const groupRange = final.group === 'LOW' ? '3-9' : final.group === 'MEDIUM' ? '10-11' : '12-18';
        
        if (ensembleGroupEl) {
            ensembleGroupEl.innerHTML = `
                <span class="ensemble-icon">${groupIcon}</span>
                <span class="ensemble-name">${final.group}</span>
                <span class="ensemble-range">(${groupRange})</span>
            `;
        }
        
        if (confidenceFillEl) confidenceFillEl.style.width = `${final.confidence}%`;
        if (confidenceTextEl) confidenceTextEl.textContent = `${Math.round(final.confidence)}%`;
        if (explanationEl) explanationEl.textContent = result.explanation;
        
        if (weightsListEl && result.weights) {
            const weightEntries = Object.entries(result.weights);
            if (weightEntries.length > 0) {
                weightsListEl.innerHTML = weightEntries
                    .map(([model, weight]) => {
                        let displayName = model;
                        if (model === 'tensorflow') displayName = 'Neural Net';
                        if (model === 'timeseries') displayName = 'Time-series';
                        if (model === 'reinforcement') displayName = 'RL Agent';
                        return `<span class="weight-item">${displayName}: ${(weight * 100).toFixed(0)}%</span>`;
                    })
                    .join('');
            } else {
                weightsListEl.innerHTML = '<span class="weight-item">Learning weights...</span>';
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnsembleEngine;
}
