/**
 * Main ML Controller
 */

class MLPredictorController {
    constructor() {
        this.tensorflowModel = null;
        this.multiplierAnalyzer = null;
        this.timeSeriesForecaster = null;
        this.neuralNetwork = null;
        this.rlAgent = null;
        this.ensembleEngine = null;
        
        this.isMLEnabled = true;
        this.isInitialized = false;
        this.updateInterval = null;
        
        this.init();
    }
    
    async init() {
        console.log('🤖 Initializing ML Predictor Controller...');
        
        // Check if TensorFlow is loaded
        if (typeof tf === 'undefined') {
            console.error('❌ TensorFlow.js not loaded! ML features will be limited.');
            this.showMLWarning();
        }
        
        // Initialize all ML modules
        try {
            this.tensorflowModel = new TensorFlowMLModel();
            this.multiplierAnalyzer = new MultiplierPatternAnalyzer();
            this.timeSeriesForecaster = new TimeSeriesForecaster();
            this.neuralNetwork = new AdvancedNeuralNetwork();
            this.rlAgent = new ReinforcementLearningAgent();
            this.ensembleEngine = new EnsembleEngine();
            
            console.log('✅ All ML modules initialized');
        } catch (error) {
            console.error('❌ Error initializing ML modules:', error);
        }
        
        this.setupEventListeners();
        
        const mlToggle = document.getElementById('mlToggle');
        if (mlToggle) {
            this.isMLEnabled = mlToggle.checked;
            this.toggleMLContent(this.isMLEnabled);
        }
        
        this.isInitialized = true;
        console.log('✅ ML Predictor Controller ready');
        
        // Wait for original predictor to be ready
        this.waitForOriginalPredictor();
    }
    
    showMLWarning() {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'error-message';
        warningDiv.style.display = 'block';
        warningDiv.innerHTML = '⚠️ TensorFlow.js not loaded. Some ML features may not work.';
        document.body.prepend(warningDiv);
        setTimeout(() => warningDiv.remove(), 5000);
    }
    
    waitForOriginalPredictor() {
        const checkInterval = setInterval(() => {
            if (window.originalPredictor && window.originalPredictor.getBaseStats()) {
                clearInterval(checkInterval);
                console.log('✅ Original predictor ready, starting ML updates');
                this.startPeriodicUpdates();
                this.updateWithNewData();
            }
        }, 1000);
        
        setTimeout(() => clearInterval(checkInterval), 30000);
    }
    
    setupEventListeners() {
        const mlToggle = document.getElementById('mlToggle');
        if (mlToggle) {
            mlToggle.addEventListener('change', (e) => {
                this.isMLEnabled = e.target.checked;
                this.toggleMLContent(this.isMLEnabled);
            });
        }
    }
    
    toggleMLContent(enabled) {
        const mlContent = document.getElementById('mlContent');
        if (mlContent) {
            mlContent.style.opacity = enabled ? '1' : '0.5';
            mlContent.style.pointerEvents = enabled ? 'auto' : 'none';
        }
    }
    
    async updateWithNewData() {
        if (!this.isMLEnabled || !this.isInitialized) return;
        
        const originalPredictor = window.originalPredictor;
        if (!originalPredictor) return;
        
        const baseStats = originalPredictor.getBaseStats();
        const allResults = originalPredictor.getAllResults();
        
        if (!baseStats || !allResults || allResults.length < 15) {
            console.log(`⏳ Waiting for data. Current: ${allResults?.length || 0} results`);
            return;
        }
        
        // Train models if needed
        if (allResults.length >= 50 && this.tensorflowModel && !this.tensorflowModel.isTrained) {
            console.log('🎓 Training TensorFlow model...');
            await this.tensorflowModel.train(allResults, baseStats);
        }
        
        if (allResults.length >= 50 && this.neuralNetwork && !this.neuralNetwork.isTrained) {
            console.log('🎓 Training Advanced Neural Network...');
            await this.neuralNetwork.train(allResults, baseStats);
        }
        
        // Update modules
        if (this.multiplierAnalyzer) {
            this.multiplierAnalyzer.updateData(allResults);
        }
        
        if (this.timeSeriesForecaster) {
            this.timeSeriesForecaster.analyzeTemporalPatterns(allResults);
            this.timeSeriesForecaster.updateChart(allResults);
        }
        
        // Get predictions
        try {
            const predictions = await this.getAllPredictions(allResults, baseStats);
            this.updateMLUI(predictions);
            
            // Update ensemble
            if (this.ensembleEngine) {
                const ensembleResult = this.ensembleEngine.combine(predictions);
                this.ensembleEngine.updateUI(ensembleResult);
            }
            
            // Learn from latest result
            const latestResult = originalPredictor.getLatestResult();
            if (latestResult && predictions.rl && this.rlAgent && predictions.rl.group) {
                await this.rlAgent.learnFromResult(predictions.rl, latestResult);
            }
            
            // Update RL UI
            if (this.rlAgent) {
                this.rlAgent.updateUI();
            }
        } catch (error) {
            console.error('Error in ML update:', error);
        }
    }
    
    async getAllPredictions(results, baseStats) {
        const last10Results = results.slice(0, 10).map(r => r.group);
        
        const numberFrequencies = [];
        for (let num = 3; num <= 18; num++) {
            const stat = baseStats?.totalStats?.find(s => s.wheelResult === num);
            const freq = stat && baseStats.totalCount ? stat.count / baseStats.totalCount : 0;
            numberFrequencies.push(freq);
        }
        
        const originalPredictor = window.originalPredictor;
        const originalPrediction = originalPredictor?.currentPrediction || null;
        
        let mlPrediction = null;
        let multiplierPrediction = null;
        let neuralPrediction = null;
        let rlPrediction = null;
        let timeSeriesForecast = null;
        
        try {
            if (this.tensorflowModel) {
                mlPrediction = await this.tensorflowModel.predict(last10Results, numberFrequencies);
            }
        } catch (e) { console.warn('TF prediction error:', e); }
        
        try {
            if (this.multiplierAnalyzer) {
                const avgTotal = results.slice(0, 10).reduce((s, r) => s + r.total, 0) / 10;
                multiplierPrediction = this.multiplierAnalyzer.predictMultiplier(Math.round(avgTotal) || 11);
            }
        } catch (e) { console.warn('Multiplier error:', e); }
        
        try {
            if (this.neuralNetwork) {
                neuralPrediction = await this.neuralNetwork.predict(results.slice(0, 20), null);
            }
        } catch (e) { console.warn('Neural network error:', e); }
        
        try {
            if (this.rlAgent) {
                rlPrediction = this.rlAgent.getOptimizedPrediction();
            }
        } catch (e) { console.warn('RL error:', e); }
        
        try {
            if (this.timeSeriesForecaster) {
                timeSeriesForecast = this.timeSeriesForecaster.forecastNext(results);
            }
        } catch (e) { console.warn('Time-series error:', e); }
        
        return {
            original: originalPrediction,
            ml: mlPrediction,
            multiplier: multiplierPrediction,
            timeSeries: timeSeriesForecast,
            neural: neuralPrediction,
            rl: rlPrediction
        };
    }
    
    updateMLUI(predictions) {
        if (predictions.ml) {
            this.updateTensorFlowUI(predictions.ml);
        }
        
        if (predictions.multiplier && this.multiplierAnalyzer) {
            this.multiplierAnalyzer.updateUI(predictions.multiplier);
        }
        
        if (predictions.timeSeries && this.timeSeriesForecaster) {
            this.timeSeriesForecaster.updateUI(predictions.timeSeries);
        }
        
        if (predictions.neural && this.neuralNetwork) {
            this.neuralNetwork.updateUI(predictions.neural);
        }
    }
    
    updateTensorFlowUI(prediction) {
        const nnPredictionEl = document.getElementById('nnPrediction');
        const nnConfidenceEl = document.getElementById('nnConfidence');
        const nnProbabilitiesEl = document.getElementById('nnProbabilities');
        
        if (nnPredictionEl && prediction) {
            const groupIcon = prediction.group === 'LOW' ? '🔴' : prediction.group === 'MEDIUM' ? '🟡' : '🟢';
            nnPredictionEl.textContent = `${groupIcon} ${prediction.group}`;
        }
        
        if (nnConfidenceEl && prediction) {
            nnConfidenceEl.textContent = `${Math.round(prediction.confidence)}%`;
        }
        
        if (nnProbabilitiesEl && prediction && prediction.probabilities) {
            nnProbabilitiesEl.innerHTML = `
                <div class="prob-bar low" style="width: ${prediction.probabilities.LOW}%">LOW ${Math.round(prediction.probabilities.LOW)}%</div>
                <div class="prob-bar medium" style="width: ${prediction.probabilities.MEDIUM}%">MEDIUM ${Math.round(prediction.probabilities.MEDIUM)}%</div>
                <div class="prob-bar high" style="width: ${prediction.probabilities.HIGH}%">HIGH ${Math.round(prediction.probabilities.HIGH)}%</div>
            `;
        }
        
        const nnExplanationEl = document.getElementById('nnExplanation');
        if (nnExplanationEl && prediction) {
            if (prediction.modelAccuracy && prediction.modelAccuracy > 0) {
                nnExplanationEl.innerHTML = `Model accuracy: ${prediction.modelAccuracy.toFixed(1)}%<br>Based on TensorFlow.js neural network`;
            } else if (prediction.note) {
                nnExplanationEl.textContent = prediction.note;
            } else {
                nnExplanationEl.textContent = 'Analyzing patterns...';
            }
        }
        
        const nnAccuracyEl = document.getElementById('nnAccuracy');
        if (nnAccuracyEl && prediction && prediction.modelAccuracy && prediction.modelAccuracy > 0) {
            nnAccuracyEl.textContent = `${prediction.modelAccuracy.toFixed(1)}% Acc`;
        } else if (nnAccuracyEl) {
            nnAccuracyEl.textContent = 'Training...';
        }
    }
    
    startPeriodicUpdates() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => {
            this.updateWithNewData();
        }, 5000);
    }
    
    // Getter for ensemble engine (used by original predictor)
    getEnsembleEngine() {
        return this.ensembleEngine;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.mlPredictor = new MLPredictorController();
    });
} else {
    window.mlPredictor = new MLPredictorController();
}