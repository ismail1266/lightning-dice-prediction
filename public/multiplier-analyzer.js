/**
 * Multiplier Pattern Analyzer
 */

class MultiplierPatternAnalyzer {
    constructor() {
        this.multiplierHistory = [];
        this.patterns = {};
        this.chart = null;
        
        this.init();
    }
    
    init() {
        console.log('⚡ Initializing Multiplier Pattern Analyzer...');
        this.setupChart();
    }
    
    setupChart() {
        const canvas = document.getElementById('multiplierChart');
        if (canvas && typeof Chart !== 'undefined') {
            try {
                const ctx = canvas.getContext('2d');
                this.chart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: 'Multipliers',
                            data: [],
                            borderColor: '#fbbf24',
                            backgroundColor: 'rgba(251, 191, 36, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { labels: { color: '#fff' } }
                        },
                        scales: {
                            y: { 
                                grid: { color: 'rgba(255,255,255,0.1)' },
                                title: { display: true, text: 'Multiplier', color: '#fff' }
                            },
                            x: { 
                                grid: { color: 'rgba(255,255,255,0.1)' },
                                title: { display: true, text: 'Game Number', color: '#fff' }
                            }
                        }
                    }
                });
            } catch (e) {
                console.warn('Could not initialize multiplier chart:', e);
            }
        }
    }
    
    updateData(results) {
        if (!results) return;
        
        this.multiplierHistory = results.map(r => ({
            total: r.total,
            multiplier: r.multiplier,
            timestamp: r.timestamp
        }));
        
        this.analyzePatterns();
        this.updateChart();
    }
    
    analyzePatterns() {
        const multiplierByTotal = {};
        
        this.multiplierHistory.forEach(game => {
            if (!multiplierByTotal[game.total]) {
                multiplierByTotal[game.total] = [];
            }
            multiplierByTotal[game.total].push(game.multiplier);
        });
        
        const stats = {};
        for (const [total, multipliers] of Object.entries(multiplierByTotal)) {
            if (multipliers.length > 0) {
                stats[total] = {
                    average: multipliers.reduce((a, b) => a + b, 0) / multipliers.length,
                    max: Math.max(...multipliers),
                    min: Math.min(...multipliers),
                    highMultiplierCount: multipliers.filter(m => m > 50).length,
                    highMultiplierPercentage: (multipliers.filter(m => m > 50).length / multipliers.length) * 100
                };
            }
        }
        
        this.patterns = stats;
        return stats;
    }
    
    predictMultiplier(total = 11) {
        const stats = this.patterns[total];
        
        if (!stats) {
            return {
                predictedMultiplier: 25,
                range: '20x-30x',
                probability: 50,
                recommendation: 'Standard multiplier expected',
                historicalStats: null
            };
        }
        
        const recentMultipliers = this.multiplierHistory
            .filter(m => m.total === total)
            .slice(-5)
            .map(m => m.multiplier);
        
        let predictedValue = stats.average;
        
        if (recentMultipliers.length > 0) {
            const recentAvg = recentMultipliers.reduce((a, b) => a + b, 0) / recentMultipliers.length;
            predictedValue = (stats.average * 0.7) + (recentAvg * 0.3);
        }
        
        const range = this.calculateRange(predictedValue);
        const probability = this.calculateProbability(stats, predictedValue);
        const recommendation = this.getRecommendation(stats, predictedValue);
        
        return {
            predictedMultiplier: Math.round(predictedValue),
            range: range,
            probability: probability,
            recommendation: recommendation,
            historicalStats: stats
        };
    }
    
    calculateRange(value) {
        const lower = Math.max(1, Math.floor(value * 0.7));
        const upper = Math.ceil(value * 1.3);
        return `${lower}x - ${upper}x`;
    }
    
    calculateProbability(stats, predicted) {
        const diff = Math.abs(predicted - stats.average) / stats.average;
        let probability = 70 - (diff * 50);
        return Math.min(95, Math.max(30, Math.round(probability)));
    }
    
    getRecommendation(stats, predicted) {
        if (predicted > 100) {
            return '🚀 Very high multiplier expected! Consider increasing stake by 50%';
        } else if (predicted > 50) {
            return '⚡ High multiplier likely. Good opportunity for increased bets';
        } else if (predicted > 20) {
            return '📈 Medium multiplier expected. Standard betting recommended';
        } else {
            return '📉 Low multiplier predicted. Conservative betting advised';
        }
    }
    
    updateChart() {
        if (!this.chart) return;
        
        const last20Multipliers = this.multiplierHistory.slice(-20).map(m => m.multiplier);
        const labels = last20Multipliers.map((_, i) => `${i + 1}`);
        
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = last20Multipliers;
        this.chart.update();
    }
    
    getHighMultiplierChance() {
        const highMultiplierCount = this.multiplierHistory.filter(m => m.multiplier > 50).length;
        const total = this.multiplierHistory.length || 1;
        return (highMultiplierCount / total) * 100;
    }
    
    updateUI(prediction) {
        const expectedElement = document.getElementById('expectedMultiplier');
        const rangeElement = document.getElementById('multiplierRange');
        const chanceElement = document.getElementById('highMultiplierChance');
        const recommendationElement = document.getElementById('multiplierRecommendation');
        
        if (expectedElement) expectedElement.textContent = `${prediction.predictedMultiplier}x`;
        if (rangeElement) rangeElement.textContent = prediction.range;
        if (chanceElement) chanceElement.textContent = `${Math.round(prediction.probability)}%`;
        if (recommendationElement) recommendationElement.textContent = prediction.recommendation;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiplierPatternAnalyzer;
}