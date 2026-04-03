/**
 * Time-series Forecaster
 */

class TimeSeriesForecaster {
    constructor() {
        this.hourlyData = {};
        this.dailyData = {};
        this.weeklyData = {};
        this.trendChart = null;
        
        this.init();
    }
    
    init() {
        console.log('📈 Initializing Time-series Forecaster...');
        this.setupChart();
    }
    
    setupChart() {
        const canvas = document.getElementById('trendChart');
        if (canvas && typeof Chart !== 'undefined') {
            try {
                const ctx = canvas.getContext('2d');
                this.trendChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [
                            {
                                label: 'Average Result',
                                data: [],
                                borderColor: '#4ade80',
                                backgroundColor: 'rgba(74, 222, 128, 0.1)',
                                tension: 0.4,
                                fill: true
                            },
                            {
                                label: 'Trend Line',
                                data: [],
                                borderColor: '#fbbf24',
                                borderDash: [5, 5],
                                tension: 0,
                                fill: false,
                                pointRadius: 0
                            }
                        ]
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
                                title: { display: true, text: 'Result', color: '#fff' },
                                min: 3,
                                max: 18
                            },
                            x: { 
                                grid: { color: 'rgba(255,255,255,0.1)' },
                                title: { display: true, text: 'Time (Games Ago)', color: '#fff' }
                            }
                        }
                    }
                });
            } catch (e) {
                console.warn('Could not initialize trend chart:', e);
            }
        }
    }
    
    analyzeTemporalPatterns(results) {
        if (!results) return { hourly: {}, seasonality: {} };
        
        const hourlyGroups = {};
        for (let hour = 0; hour < 24; hour++) {
            hourlyGroups[hour] = {
                results: [],
                totals: [],
                groups: { LOW: 0, MEDIUM: 0, HIGH: 0 }
            };
        }
        
        results.forEach(result => {
            if (!result || !result.timestamp) return;
            try {
                const hour = new Date(result.timestamp).getHours();
                if (hourlyGroups[hour]) {
                    hourlyGroups[hour].results.push(result);
                    hourlyGroups[hour].totals.push(result.total);
                    hourlyGroups[hour].groups[result.group]++;
                }
            } catch (e) {
                // ignore
            }
        });
        
        for (let hour = 0; hour < 24; hour++) {
            const data = hourlyGroups[hour];
            if (data.results.length > 0) {
                this.hourlyData[hour] = {
                    count: data.results.length,
                    average: data.totals.reduce((a, b) => a + b, 0) / data.totals.length,
                    lowPercentage: (data.groups.LOW / data.results.length) * 100,
                    mediumPercentage: (data.groups.MEDIUM / data.results.length) * 100,
                    highPercentage: (data.groups.HIGH / data.results.length) * 100
                };
            }
        }
        
        const seasonality = this.detectSeasonality();
        
        return {
            hourly: this.hourlyData,
            seasonality: seasonality
        };
    }
    
    detectSeasonality() {
        const peakHours = {
            LOW: { hour: 0, percentage: 0 },
            MEDIUM: { hour: 0, percentage: 0 },
            HIGH: { hour: 0, percentage: 0 }
        };
        
        for (let hour = 0; hour < 24; hour++) {
            const data = this.hourlyData[hour];
            if (data) {
                if (data.lowPercentage > peakHours.LOW.percentage) {
                    peakHours.LOW = { hour: hour, percentage: data.lowPercentage };
                }
                if (data.mediumPercentage > peakHours.MEDIUM.percentage) {
                    peakHours.MEDIUM = { hour: hour, percentage: data.mediumPercentage };
                }
                if (data.highPercentage > peakHours.HIGH.percentage) {
                    peakHours.HIGH = { hour: hour, percentage: data.highPercentage };
                }
            }
        }
        
        return peakHours;
    }
    
    forecastNext(results, hours = 1) {
        if (!results || results.length < 10) {
            return this.getFallbackForecast();
        }
        
        const last24h = results.filter(r => {
            if (!r || !r.timestamp) return false;
            const resultTime = new Date(r.timestamp);
            const now = new Date();
            return (now - resultTime) < 24 * 60 * 60 * 1000;
        });
        
        const ema = this.calculateEMA(last24h.map(r => r.total), 10);
        const trend = this.detectTrend(last24h.map(r => r.total));
        
        const currentHour = new Date().getHours();
        const hourPattern = this.hourlyData[currentHour] || null;
        
        let predictedAvg = ema.prediction;
        if (hourPattern && hourPattern.average) {
            predictedAvg = (predictedAvg * 0.6) + (hourPattern.average * 0.4);
        }
        
        let mostLikelyGroup = 'MEDIUM';
        if (hourPattern) {
            const groups = [
                { name: 'LOW', prob: hourPattern.lowPercentage },
                { name: 'MEDIUM', prob: hourPattern.mediumPercentage },
                { name: 'HIGH', prob: hourPattern.highPercentage }
            ];
            mostLikelyGroup = groups.reduce((a, b) => a.prob > b.prob ? a : b).name;
        }
        
        const seasonality = this.getCurrentSeasonalityText(currentHour);
        
        return {
            nextHourAverage: predictedAvg.toFixed(1),
            mostLikelyGroup: mostLikelyGroup,
            trendDirection: trend.direction,
            trendStrength: trend.strength.toFixed(2),
            seasonality: seasonality,
            confidence: this.calculateForecastConfidence(trend, hourPattern)
        };
    }
    
    calculateEMA(data, period) {
        if (data.length === 0) return { value: 10.5, prediction: 10.5 };
        
        const k = 2 / (period + 1);
        let ema = data[0];
        
        for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        
        const momentum = data.length > 5 ? data[data.length - 1] - data[Math.max(0, data.length - 5)] : 0;
        
        return {
            value: ema,
            prediction: ema + (momentum * 0.3)
        };
    }
    
    detectTrend(data) {
        if (data.length < 2) return { direction: 'stable', strength: 0, slope: 0 };
        
        const n = data.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = data;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
        const sumXX = x.reduce((a, b) => a + b * b, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        
        let direction = 'stable';
        if (slope > 0.05) direction = 'upward';
        else if (slope < -0.05) direction = 'downward';
        
        return {
            direction: direction,
            strength: Math.abs(slope),
            slope: slope
        };
    }
    
    getCurrentSeasonalityText(hour) {
        const data = this.hourlyData[hour];
        if (!data) return 'Insufficient data';
        
        if (data.lowPercentage > 45) return `🔴 LOW group dominance (${Math.round(data.lowPercentage)}%)`;
        if (data.mediumPercentage > 45) return `🟡 MEDIUM group dominance (${Math.round(data.mediumPercentage)}%)`;
        if (data.highPercentage > 45) return `🟢 HIGH group dominance (${Math.round(data.highPercentage)}%)`;
        
        return `Balanced distribution (L:${Math.round(data.lowPercentage)}% M:${Math.round(data.mediumPercentage)}% H:${Math.round(data.highPercentage)}%)`;
    }
    
    calculateForecastConfidence(trend, hourPattern) {
        let confidence = 65;
        
        if (trend.strength > 0.1) confidence += 10;
        else if (trend.strength < 0.02) confidence -= 10;
        
        if (hourPattern && hourPattern.count > 30) confidence += 10;
        else if (hourPattern && hourPattern.count < 10) confidence -= 10;
        
        return Math.min(90, Math.max(40, confidence));
    }
    
    getFallbackForecast() {
        return {
            nextHourAverage: '10.5',
            mostLikelyGroup: 'MEDIUM',
            trendDirection: 'stable',
            trendStrength: '0.00',
            seasonality: 'Collecting data...',
            confidence: 50
        };
    }
    
    updateChart(results) {
        if (!this.trendChart || !results || results.length < 10) return;
        
        const last20Results = results.slice(-20).map(r => r.total);
        const labels = last20Results.map((_, i) => `${i + 1}`);
        
        const trendLine = this.calculateTrendLine(last20Results);
        
        this.trendChart.data.labels = labels;
        this.trendChart.data.datasets[0].data = last20Results;
        this.trendChart.data.datasets[1].data = trendLine;
        this.trendChart.update();
    }
    
    calculateTrendLine(data) {
        if (data.length < 2) return data;
        
        const n = data.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = data;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
        const sumXX = x.reduce((a, b) => a + b * b, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        return x.map(xi => slope * xi + intercept);
    }
    
    updateUI(forecast) {
        const avgElement = document.getElementById('nextHourAvg');
        const trendElement = document.getElementById('trendDirection');
        const seasonalityElement = document.getElementById('seasonality');
        
        if (avgElement) avgElement.textContent = forecast.nextHourAverage;
        if (trendElement) {
            trendElement.textContent = forecast.trendDirection === 'upward' ? '📈 Upward' :
                                       forecast.trendDirection === 'downward' ? '📉 Downward' : '➡️ Stable';
            if (trendElement) {
                trendElement.style.color = forecast.trendDirection === 'upward' ? '#4ade80' :
                                           forecast.trendDirection === 'downward' ? '#ef4444' : '#fbbf24';
            }
        }
        if (seasonalityElement) seasonalityElement.textContent = forecast.seasonality;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeSeriesForecaster;
}