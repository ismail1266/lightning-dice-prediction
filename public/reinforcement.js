/**
 * Reinforcement Learning Agent
 */

class ReinforcementLearningAgent {
    constructor() {
        this.qTable = {};
        this.learningRate = 0.1;
        this.discountFactor = 0.95;
        this.explorationRate = 0.2;
        this.actions = ['LOW', 'MEDIUM', 'HIGH'];
        this.rewardHistory = [];
        this.episodes = 0;
        this.learnedPatterns = [];
        
        this.init();
    }
    
    init() {
        console.log('🎓 Initializing Reinforcement Learning Agent...');
        this.loadQTable();
    }
    
    loadQTable() {
        try {
            const saved = localStorage.getItem('rl_qtable');
            if (saved) {
                this.qTable = JSON.parse(saved);
                console.log('✅ Loaded Q-table with', Object.keys(this.qTable).length, 'states');
            }
        } catch (error) {
            console.log('No saved Q-table found');
        }
    }
    
    saveQTable() {
        localStorage.setItem('rl_qtable', JSON.stringify(this.qTable));
    }
    
    getState(results) {
        if (!results || results.length === 0) {
            results = [];
        }
        
        const last3Results = results.slice(0, 3).map(r => r?.group || 'MEDIUM');
        const recentTrend = this.getRecentTrend(results);
        const hour = new Date().getHours();
        const dayOfWeek = new Date().getDay();
        
        return `${last3Results.join('-')}|${recentTrend}|${hour}|${dayOfWeek}`;
    }
    
    getRecentTrend(results) {
        if (!results || results.length < 5) return 'stable';
        
        const recent = results.slice(0, 5).map(r => {
            if (r?.group === 'LOW') return 1;
            if (r?.group === 'MEDIUM') return 2;
            return 3;
        });
        
        const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
        
        if (avg < 1.5) return 'low_dominant';
        if (avg > 2.5) return 'high_dominant';
        if (avg > 1.8 && avg < 2.2) return 'medium_dominant';
        return 'mixed';
    }
    
    chooseAction(state) {
        if (Math.random() < this.explorationRate) {
            return this.actions[Math.floor(Math.random() * this.actions.length)];
        }
        
        return this.getBestAction(state);
    }
    
    getBestAction(state) {
        if (!this.qTable[state]) {
            this.qTable[state] = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        }
        
        return Object.keys(this.qTable[state]).reduce((a, b) =>
            this.qTable[state][a] > this.qTable[state][b] ? a : b
        );
    }
    
    updateQValue(state, action, reward, nextState) {
        if (!this.qTable[state]) {
            this.qTable[state] = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        }
        if (!this.qTable[nextState]) {
            this.qTable[nextState] = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        }
        
        const currentQ = this.qTable[state][action];
        const maxNextQ = Math.max(...Object.values(this.qTable[nextState]));
        
        const newQ = currentQ + this.learningRate * (
            reward + this.discountFactor * maxNextQ - currentQ
        );
        
        this.qTable[state][action] = newQ;
    }
    
    calculateReward(prediction, actualResult) {
        if (!prediction || !actualResult) return 0;
        
        let reward = 0;
        
        if (prediction.group === actualResult.group) {
            reward += 10;
            
            if (prediction.confidence && prediction.confidence > 70) {
                reward += 5;
            }
            
            if (this.isRareEvent(actualResult)) {
                reward += 15;
            }
        } else {
            reward -= 5;
            
            if (prediction.confidence && prediction.confidence > 80) {
                reward -= 3;
            }
        }
        
        if (prediction.predictedMultiplier && actualResult.multiplier) {
            const multiplierDiff = Math.abs(prediction.predictedMultiplier - actualResult.multiplier);
            if (multiplierDiff < 20) {
                reward += 3;
            } else if (multiplierDiff > 50) {
                reward -= 2;
            }
        }
        
        return reward;
    }
    
    isRareEvent(result) {
        if (result.multiplier > 100) return true;
        if (result.total === 3 || result.total === 18) return true;
        return false;
    }
    
    async learnFromResult(prediction, actualResult) {
        const predictor = window.originalPredictor;
        const results = predictor?.getAllResults() || [];
        
        const state = this.getState(results);
        const action = prediction.group;
        const reward = this.calculateReward(prediction, actualResult);
        const nextState = this.getState([actualResult, ...results]);
        
        this.updateQValue(state, action, reward, nextState);
        
        this.rewardHistory.push(reward);
        if (this.rewardHistory.length > 500) this.rewardHistory.shift();
        
        this.episodes++;
        
        this.explorationRate = Math.max(0.05, this.explorationRate * 0.998);
        
        if (this.episodes % 20 === 0) {
            this.saveQTable();
            this.extractLearnedPatterns();
        }
        
        if (this.episodes % 100 === 0) {
            this.updateUI();
        }
        
        return {
            reward: reward,
            episodes: this.episodes,
            explorationRate: this.explorationRate,
            averageReward: this.getAverageReward()
        };
    }
    
    getAverageReward() {
        if (this.rewardHistory.length === 0) return 0;
        const sum = this.rewardHistory.reduce((a, b) => a + b, 0);
        return sum / this.rewardHistory.length;
    }
    
    extractLearnedPatterns() {
        this.learnedPatterns = [];
        
        const states = Object.entries(this.qTable);
        const sortedStates = states.sort((a, b) => {
            const maxA = Math.max(...Object.values(a[1]));
            const maxB = Math.max(...Object.values(b[1]));
            return maxB - maxA;
        });
        
        for (let i = 0; i < Math.min(3, sortedStates.length); i++) {
            const [state, values] = sortedStates[i];
            const bestAction = Object.keys(values).reduce((a, b) => values[a] > values[b] ? a : b);
            const bestValue = values[bestAction];
            
            if (bestValue > 3) {
                this.learnedPatterns.push({
                    condition: state,
                    recommendedAction: bestAction,
                    confidence: Math.min(85, 50 + bestValue),
                    description: this.describeState(state)
                });
            }
        }
    }
    
    describeState(state) {
        const parts = state.split('|');
        const last3 = parts[0];
        const trend = parts[1];
        const hour = parts[2];
        
        return `When last results: ${last3} and trend: ${trend}`;
    }
    
    getOptimizedPrediction() {
        const predictor = window.originalPredictor;
        const results = predictor?.getAllResults() || [];
        const state = this.getState(results);
        const bestAction = this.getBestAction(state);
        const qValue = this.qTable[state]?.[bestAction] || 0;
        
        let confidence = 50 + (qValue / 15);
        confidence = Math.min(90, Math.max(35, confidence));
        
        return {
            group: bestAction,
            qValue: qValue,
            confidence: confidence,
            episodes: this.episodes,
            explorationRate: this.explorationRate,
            averageReward: this.getAverageReward(),
            learnedPatterns: this.learnedPatterns
        };
    }
    
    updateUI() {
        const rlRecommendationEl = document.getElementById('rlRecommendation');
        const rlQValueEl = document.getElementById('rlQValue');
        const rlExplorationEl = document.getElementById('rlExploration');
        const rlEpisodesEl = document.getElementById('rlEpisodes');
        const learnedPatternsList = document.querySelector('#learnedPatterns ul');
        
        const prediction = this.getOptimizedPrediction();
        
        if (rlRecommendationEl) {
            const icon = prediction.group === 'LOW' ? '🔴' : prediction.group === 'MEDIUM' ? '🟡' : '🟢';
            rlRecommendationEl.textContent = `${icon} ${prediction.group}`;
        }
        
        if (rlQValueEl) rlQValueEl.textContent = prediction.qValue.toFixed(2);
        if (rlExplorationEl) rlExplorationEl.textContent = `${(prediction.explorationRate * 100).toFixed(1)}%`;
        if (rlEpisodesEl) rlEpisodesEl.textContent = prediction.episodes;
        
        if (learnedPatternsList) {
            if (prediction.learnedPatterns.length > 0) {
                learnedPatternsList.innerHTML = prediction.learnedPatterns.map(p => `
                    <li>${p.description} → ${p.recommendedAction} (${Math.round(p.confidence)}% confidence)</li>
                `).join('');
            } else if (this.episodes === 0) {
                learnedPatternsList.innerHTML = '<li>Collecting data for learning...</li>';
            } else {
                learnedPatternsList.innerHTML = '<li>Learning patterns from outcomes...</li>';
            }
        }
        
        const performanceBadge = document.getElementById('rlPerformance');
        if (performanceBadge) {
            const avgReward = this.getAverageReward();
            if (this.episodes > 50 && avgReward > 3) {
                performanceBadge.textContent = `🎯 ${avgReward.toFixed(1)} avg reward`;
                performanceBadge.style.color = '#4ade80';
            } else if (this.episodes > 20) {
                performanceBadge.textContent = `📈 Learning (${this.episodes} games)`;
                performanceBadge.style.color = '#fbbf24';
            } else {
                performanceBadge.textContent = `🔄 Starting (${this.episodes} games)`;
                performanceBadge.style.color = '#fbbf24';
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReinforcementLearningAgent;
}