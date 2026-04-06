class LightningDicePredictor {
    constructor() {
        this.apiBase = '/api';
        this.baseStats = null;
        this.allResults = [];
        this.lastGameId = null;
        this.autoRefreshInterval = null;
        this.timerInterval = null;
        this.refreshSeconds = 3;
        this.isInitialized = false;
        this.currentPrediction = null;
        this.connectionRetryCount = 0;
        
        // History tracking
        this.predictionHistory = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.maxHistorySize = 200;
        
        // Group definitions
        this.groups = {
            LOW: { name: 'LOW', range: '3-9', numbers: [3,4,5,6,7,8,9], icon: '🔴', color: '#ef4444' },
            MEDIUM: { name: 'MEDIUM', range: '10-11', numbers: [10,11], icon: '🟡', color: '#fbbf24' },
            HIGH: { name: 'HIGH', range: '12-18', numbers: [12,13,14,15,16,17,18], icon: '🟢', color: '#4ade80' }
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing Lightning Dice Predictor...');
        this.bindEvents();
        
        await this.loadBaseData();
        await this.loadLatestData();
        
        this.isInitialized = true;
        this.updateUI();
        
        this.startAutoRefresh();
        this.startTimer();
        
        this.updateConnectionStatus(true);
        this.setupCollapsibleStats();
    }
    
    setupCollapsibleStats() {
        const statsHeader = document.getElementById('statsHeader');
        const statsContent = document.getElementById('statsContent');
        const toggleIcon = document.getElementById('toggleIcon');
        
        if (statsHeader && statsContent && toggleIcon) {
            statsHeader.addEventListener('click', () => {
                const isVisible = statsContent.style.display !== 'none';
                statsContent.style.display = isVisible ? 'none' : 'block';
                toggleIcon.classList.toggle('open', !isVisible);
            });
        }
    }
    
    bindEvents() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.checkForNewData(true);
            });
        }
        
        const autoRefreshToggle = document.getElementById('autoRefreshToggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.startAutoRefresh();
                    this.startTimer();
                } else {
                    this.stopAutoRefresh();
                    this.stopTimer();
                }
            });
        }
        
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.changePage(-1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.changePage(1));
        }
    }
    
    changePage(delta) {
        const newPage = this.currentPage + delta;
        const totalPages = Math.ceil(this.predictionHistory.length / this.itemsPerPage);
        
        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.updateHistoryTable();
        }
    }
    
    async loadBaseData() {
        try {
            console.log('📊 Loading 24-hour statistics...');
            const response = await fetch(`${this.apiBase}/stats?duration=24&sortField=hotFrequency`);
            if (!response.ok) throw new Error('Failed to load stats');
            
            this.baseStats = await response.json();
            console.log('✅ Base data loaded:', this.baseStats.totalCount, 'total rounds');
            this.updateConnectionStatus(true);
            this.connectionRetryCount = 0;
            
        } catch (error) {
            console.error('❌ Error loading base data:', error);
            this.showError('Failed to load statistics: ' + error.message);
            this.updateConnectionStatus(false);
            this.retryConnection();
        }
    }
    
    async loadLatestData() {
        try {
            const response = await fetch(`${this.apiBase}/latest`);
            if (!response.ok) throw new Error('Failed to load latest');
            
            const data = await response.json();
            
            if (data && data.data) {
                const gameResult = this.parseGameData(data);
                this.allResults.unshift(gameResult);
                this.lastGameId = gameResult.id;
                this.latestResult = gameResult;
                
                console.log('✅ Latest data loaded');
                this.updateConnectionStatus(true);
                this.connectionRetryCount = 0;
            }
        } catch (error) {
            console.error('❌ Error loading latest:', error);
            this.showError('Failed to load latest results');
            this.updateConnectionStatus(false);
            this.retryConnection();
        }
    }
    
    retryConnection() {
        if (this.connectionRetryCount < 5) {
            this.connectionRetryCount++;
            console.log(`🔄 Retry connection attempt ${this.connectionRetryCount}/5...`);
            setTimeout(() => {
                this.loadBaseData();
            }, 5000);
        }
    }
    
    parseGameData(data) {
        const total = data.data.result.total;
        const multipliers = data.data.result.luckyNumbersList || [];
        const multiplierItem = multipliers.find(m => m.outcome === `LightningDice_Total${total}`);
        const diceValues = data.data.result.value || '? ? ?';
        
        return {
            id: data.data.id,
            total: total,
            group: this.getGroup(total),
            multiplier: multiplierItem ? multiplierItem.multiplier : 1,
            timestamp: data.data.settledAt,
            winners: data.totalWinners || 0,
            payout: data.totalAmount || 0,
            diceValues: diceValues
        };
    }
    
    getGroup(number) {
        if (number >= 3 && number <= 9) return 'LOW';
        if (number >= 10 && number <= 11) return 'MEDIUM';
        if (number >= 12 && number <= 18) return 'HIGH';
        return 'UNKNOWN';
    }
    
    async checkForNewData(manual = false) {
        if (!this.isInitialized) return;
        
        try {
            const response = await fetch(`${this.apiBase}/latest`);
            if (!response.ok) return;
            
            const data = await response.json();
            
            if (data && data.data) {
                const gameId = data.data.id;
                
                if (this.lastGameId !== gameId) {
                    console.log('🆕 New result detected!');
                    console.log('📸 Taking prediction snapshot before update...');
                    
                    // ✅ FIX 1: রেজাল্ট আসার আগের প্রেডিকশন স্ন্যাপশট নেওয়া
                    const classicPredictionSnapshot = this.currentPrediction ? {...this.currentPrediction} : null;
                    
                    // ✅ FIX 2: Ensemble prediction snapshot নেওয়া
                    let ultimatePredictionSnapshot = null;
                    if (window.mlPredictor && window.mlPredictor.ensembleEngine) {
                        const allPredictions = await window.mlPredictor.getAllPredictions(
                            this.allResults, 
                            this.baseStats
                        );
                        if (window.mlPredictor.ensembleEngine) {
                            const ensembleResult = window.mlPredictor.ensembleEngine.combine(allPredictions);
                            ultimatePredictionSnapshot = ensembleResult.final.group;
                        }
                    }
                    
                    const gameResult = this.parseGameData(data);
                    this.allResults.unshift(gameResult);
                    this.lastGameId = gameId;
                    this.latestResult = gameResult;
                    
                    if (this.allResults.length > 100) {
                        this.allResults.pop();
                    }
                    
                    // ✅ FIX 3: স্ন্যাপশট ব্যবহার করে history তে যোগ করা
                    this.addToHistory(gameResult, classicPredictionSnapshot, ultimatePredictionSnapshot);
                    
                    // ✅ FIX 4: নতুন রেজাল্টের ভিত্তিতে প্রেডিকশন আপডেট করা
                    this.analyzeAndPredict();
                    this.updateRecentResultsDisplay();
                    this.updatePredictionDisplay();
                    this.updateGroupProbabilities();
                    
                    this.animateNewResult();
                    this.updateConnectionStatus(true);
                    
                    if (window.mlPredictor && document.getElementById('mlToggle')?.checked) {
                        window.mlPredictor.updateWithNewData();
                    }
                }
            }
        } catch (error) {
            console.error('Error checking for new data:', error);
            this.updateConnectionStatus(false);
        }
    }
    
    addToHistory(result, classicPred, ultimatePred) {
        const time = new Date(result.timestamp).toLocaleTimeString();
        
        // ✅ FIX 5: সঠিকভাবে correctness নির্ণয় করা
        const classicCorrect = classicPred ? classicPred.group === result.group : false;
        const ultimateCorrect = ultimatePred ? ultimatePred === result.group : false;
        
        // ✅ FIX 6: কনসোল লগ ডিবাগিং এর জন্য
        console.log('📝 Adding to History:');
        console.log(`   Result: ${result.group} (${result.total})`);
        console.log(`   Classic Prediction: ${classicPred?.group || 'N/A'} → ${classicCorrect ? '✓ CORRECT' : '✗ WRONG'}`);
        console.log(`   Ultimate Prediction: ${ultimatePred || 'N/A'} → ${ultimateCorrect ? '✓ CORRECT' : '✗ WRONG'}`);
        
        const historyEntry = {
            time: time,
            dice: result.diceValues,
            total: result.total,
            actualGroup: result.group,
            classicPrediction: classicPred ? classicPred.group : 'MEDIUM',
            ultimatePrediction: ultimatePred ? ultimatePred : 'MEDIUM',
            classicCorrect: classicCorrect,
            ultimateCorrect: ultimateCorrect,
            timestamp: result.timestamp
        };
        
        this.predictionHistory.unshift(historyEntry);
        
        if (this.predictionHistory.length > this.maxHistorySize) {
            this.predictionHistory.pop();
        }
        
        this.updateHistoryTable();
    }
    
    updateHistoryTable() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageItems = this.predictionHistory.slice(startIndex, endIndex);
        
        if (pageItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No history data yet...</td></tr>';
            this.updatePaginationControls();
            return;
        }
        
        tbody.innerHTML = pageItems.map(item => {
            // Classic prediction display with correct/wrong icon
            const classicIcon = item.classicCorrect ? '✓' : '✗';
            const classicClass = item.classicCorrect ? 'correct' : 'incorrect';
            const classicColor = item.classicPrediction === 'LOW' ? '🔴' : 
                                item.classicPrediction === 'MEDIUM' ? '🟡' : '🟢';
            
            // Ultimate prediction display with correct/wrong icon
            const ultimateIcon = item.ultimateCorrect ? '✓' : '✗';
            const ultimateClass = item.ultimateCorrect ? 'correct' : 'incorrect';
            const ultimateColor = item.ultimatePrediction === 'LOW' ? '🔴' : 
                                 item.ultimatePrediction === 'MEDIUM' ? '🟡' : '🟢';
            
            return `
                <tr>
                    <td>${item.time}</td>
                    <td class="dice-values">🎲 ${item.dice}</td>
                    <td><strong>${item.total}</strong> <span style="font-size:11px;opacity:0.7;">(${item.actualGroup})</span></td>
                    <td>
                        <span class="prediction-badge ${classicClass}">
                            <span class="icon">${classicIcon}</span>
                            ${classicColor} ${item.classicPrediction}
                        </span>
                    </td>
                    <td>
                        <span class="prediction-badge ${ultimateClass}">
                            <span class="icon">${ultimateIcon}</span>
                            ${ultimateColor} ${item.ultimatePrediction}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
        
        this.updatePaginationControls();
    }
    
    updatePaginationControls() {
        const totalPages = Math.ceil(this.predictionHistory.length / this.itemsPerPage);
        const startRecord = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endRecord = Math.min(this.currentPage * this.itemsPerPage, this.predictionHistory.length);
        
        const paginationInfo = document.getElementById('paginationInfo');
        const paginationStats = document.getElementById('paginationStats');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (paginationInfo) {
            paginationInfo.textContent = `Page ${this.currentPage} of ${totalPages || 1}`;
        }
        
        if (paginationStats) {
            if (this.predictionHistory.length === 0) {
                paginationStats.textContent = 'Showing 0-0 of 0 results';
            } else {
                paginationStats.textContent = `Showing ${startRecord}-${endRecord} of ${this.predictionHistory.length} results`;
            }
        }
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
        }
    }
    
    analyzeAndPredict() {
        if (!this.baseStats || !this.baseStats.totalStats) {
            console.log('⚠️ No base stats available for prediction');
            return;
        }
        
        const groupProbabilities = this.calculateGroupProbabilities();
        
        let bestGroup = null;
        let bestScore = -1;
        
        for (const [group, data] of Object.entries(groupProbabilities)) {
            if (data.score > bestScore) {
                bestScore = data.score;
                bestGroup = group;
            }
        }
        
        if (bestGroup) {
            const groupData = this.groups[bestGroup];
            const confidence = Math.round(groupProbabilities[bestGroup].score * 100);
            const reasoning = this.generateReasoning(groupProbabilities);
            
            this.currentPrediction = {
                group: bestGroup,
                icon: groupData.icon,
                name: groupData.name,
                range: groupData.range,
                confidence: Math.min(confidence, 95),
                reasoning: reasoning,
                probabilities: groupProbabilities
            };
        }
        
        console.log('🎯 Original Prediction:', this.currentPrediction);
    }
    
    calculateGroupProbabilities() {
        const numbers = this.baseStats.totalStats;
        const recentResults = this.allResults.slice(0, 10);
        
        const groupFreq = {
            LOW: { count: 0, total: 0, hotCount: 0 },
            MEDIUM: { count: 0, total: 0, hotCount: 0 },
            HIGH: { count: 0, total: 0, hotCount: 0 }
        };
        
        numbers.forEach(num => {
            const group = this.getGroup(num.wheelResult);
            if (group !== 'UNKNOWN') {
                groupFreq[group].count += num.count;
                groupFreq[group].total += num.count;
                if (num.hotFrequencyPercentage > 0) {
                    groupFreq[group].hotCount += num.count;
                }
            }
        });
        
        const totalCount = this.baseStats.totalCount;
        
        const freqScores = {
            LOW: totalCount > 0 ? (groupFreq.LOW.count / totalCount) * 0.30 : 0,
            MEDIUM: totalCount > 0 ? (groupFreq.MEDIUM.count / totalCount) * 0.30 : 0,
            HIGH: totalCount > 0 ? (groupFreq.HIGH.count / totalCount) * 0.30 : 0
        };
        
        const recentCount = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        recentResults.forEach(result => {
            if (result && result.group) {
                recentCount[result.group]++;
            }
        });
        
        const maxRecent = Math.max(recentCount.LOW, recentCount.MEDIUM, recentCount.HIGH) || 1;
        const recentScores = {
            LOW: (recentCount.LOW / maxRecent) * 0.40,
            MEDIUM: (recentCount.MEDIUM / maxRecent) * 0.40,
            HIGH: (recentCount.HIGH / maxRecent) * 0.40
        };
        
        const maxHot = Math.max(groupFreq.LOW.hotCount, groupFreq.MEDIUM.hotCount, groupFreq.HIGH.hotCount) || 1;
        const hotScores = {
            LOW: (groupFreq.LOW.hotCount / maxHot) * 0.20,
            MEDIUM: (groupFreq.MEDIUM.hotCount / maxHot) * 0.20,
            HIGH: (groupFreq.HIGH.hotCount / maxHot) * 0.20
        };
        
        const now = new Date();
        const lastSeen = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        
        for (let i = 0; i < this.allResults.length; i++) {
            const result = this.allResults[i];
            if (result && result.group && !lastSeen[result.group]) {
                const lastTime = new Date(result.timestamp);
                const hoursSince = (now - lastTime) / (1000 * 60 * 60);
                lastSeen[result.group] = Math.min(1, hoursSince / 12);
            }
        }
        
        const dueScores = {
            LOW: (lastSeen.LOW || 0) * 0.10,
            MEDIUM: (lastSeen.MEDIUM || 0) * 0.10,
            HIGH: (lastSeen.HIGH || 0) * 0.10
        };
        
        const scores = {
            LOW: freqScores.LOW + recentScores.LOW + hotScores.LOW + dueScores.LOW,
            MEDIUM: freqScores.MEDIUM + recentScores.MEDIUM + hotScores.MEDIUM + dueScores.MEDIUM,
            HIGH: freqScores.HIGH + recentScores.HIGH + hotScores.HIGH + dueScores.HIGH
        };
        
        const maxScore = Math.max(scores.LOW, scores.MEDIUM, scores.HIGH);
        if (maxScore > 0) {
            scores.LOW = scores.LOW / maxScore;
            scores.MEDIUM = scores.MEDIUM / maxScore;
            scores.HIGH = scores.HIGH / maxScore;
        }
        
        return {
            LOW: { score: scores.LOW, probability: scores.LOW * 100 },
            MEDIUM: { score: scores.MEDIUM, probability: scores.MEDIUM * 100 },
            HIGH: { score: scores.HIGH, probability: scores.HIGH * 100 }
        };
    }
    
    generateReasoning(probabilities) {
        const sorted = Object.entries(probabilities).sort((a, b) => b[1].score - a[1].score);
        const top = sorted[0];
        const second = sorted[1];
        
        const diff = (top[1].score - second[1].score) * 100;
        
        if (diff > 20) {
            return `🎯 Strong dominance - ${top[0]} group showing exceptional momentum`;
        } else if (diff > 10) {
            return `📈 Clear advantage - ${top[0]} group leading with good probability`;
        } else if (diff > 5) {
            return `⚖️ Slight edge - ${top[0]} group marginally ahead`;
        } else {
            return `🔄 Competitive race - ${top[0]} group has minimal advantage`;
        }
    }
    
    updateUI() {
        if (!this.baseStats) return;
        
        this.updateStatsUI();
        this.updateStatisticsTable();
        this.updateGroupProbabilities();
        this.updateRecentResultsDisplay();
        this.updatePredictionDisplay();
    }
    
    updateStatsUI() {
        const totalCount = this.baseStats.totalCount || 0;
        const numbers = this.baseStats.totalStats || [];
        
        let totalSum = 0;
        let totalFreq = 0;
        numbers.forEach(item => {
            totalSum += parseInt(item.wheelResult) * item.count;
            totalFreq += item.count;
        });
        const avgResult = totalFreq > 0 ? (totalSum / totalFreq).toFixed(2) : 0;
        
        const totalRoundsEl = document.getElementById('totalRounds');
        const avgResultEl = document.getElementById('avgResult');
        
        if (totalRoundsEl) totalRoundsEl.textContent = totalCount.toLocaleString();
        if (avgResultEl) avgResultEl.textContent = avgResult;
        
        const groupCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        numbers.forEach(item => {
            const group = this.getGroup(item.wheelResult);
            if (group !== 'UNKNOWN') {
                groupCounts[group] += item.count;
            }
        });
        
        let mostActive = 'LOW';
        let maxCount = groupCounts.LOW;
        if (groupCounts.MEDIUM > maxCount) {
            mostActive = 'MEDIUM';
            maxCount = groupCounts.MEDIUM;
        }
        if (groupCounts.HIGH > maxCount) {
            mostActive = 'HIGH';
        }
        
        const mostActiveGroupEl = document.getElementById('mostActiveGroup');
        if (mostActiveGroupEl) mostActiveGroupEl.textContent = mostActive;
        
        const lightningMatchStats = this.baseStats.lightningNumberMatchedStats;
        const matchPercent = lightningMatchStats?.find(s => s.type === 'Match')?.percentage || 0;
        
        const lightningBoostEl = document.getElementById('lightningBoost');
        if (lightningBoostEl) lightningBoostEl.textContent = `${Math.round(matchPercent)}%`;
    }
    
    updateStatisticsTable() {
        const tbody = document.getElementById('statsTableBody');
        const numbers = this.baseStats?.totalStats || [];
        
        if (!tbody) return;
        
        if (numbers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No data available<\/td><\/tr>';
            return;
        }
        
        const sortedNumbers = [...numbers].sort((a, b) => a.wheelResult - b.wheelResult);
        
        tbody.innerHTML = sortedNumbers.map(item => {
            const group = this.getGroup(item.wheelResult);
            const groupClass = `group-${group.toLowerCase()}`;
            const groupName = group;
            
            const lastTime = new Date(item.lastOccurredAt);
            const timeAgo = this.getTimeAgo(lastTime);
            
            return `
                <tr>
                    <td><strong>${item.wheelResult}</strong></td>
                    <td><span class="group-badge ${groupClass}">${groupName}</span></td>
                    <td>${item.count}</td>
                    <td>${item.hotFrequencyPercentage ? Math.round(item.hotFrequencyPercentage) : 0}%</td>
                    <td>${timeAgo}</td>
                </tr>
            `;
        }).join('');
    }
    
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return `${Math.floor(diffMins / 1440)}d ago`;
    }
    
    updateGroupProbabilities() {
        if (!this.currentPrediction) return;
        
        const probs = this.currentPrediction.probabilities;
        
        const lowProbEl = document.getElementById('lowProb');
        const mediumProbEl = document.getElementById('mediumProb');
        const highProbEl = document.getElementById('highProb');
        
        if (lowProbEl) lowProbEl.textContent = `${Math.round(probs.LOW.probability)}%`;
        if (mediumProbEl) mediumProbEl.textContent = `${Math.round(probs.MEDIUM.probability)}%`;
        if (highProbEl) highProbEl.textContent = `${Math.round(probs.HIGH.probability)}%`;
        
        const recentResults = this.allResults.slice(0, 10);
        const recentCount = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        recentResults.forEach(r => {
            if (r && r.group) recentCount[r.group]++;
        });
        
        const lowTrendEl = document.getElementById('lowTrend');
        const mediumTrendEl = document.getElementById('mediumTrend');
        const highTrendEl = document.getElementById('highTrend');
        
        if (lowTrendEl) lowTrendEl.textContent = this.getTrendText(recentCount.LOW, 10);
        if (mediumTrendEl) mediumTrendEl.textContent = this.getTrendText(recentCount.MEDIUM, 10);
        if (highTrendEl) highTrendEl.textContent = this.getTrendText(recentCount.HIGH, 10);
    }
    
    getTrendText(count, total) {
        const percentage = (count / total) * 100;
        if (percentage > 40) return '🔥 Hot streak';
        if (percentage > 20) return '📈 Warming up';
        if (percentage > 10) return '⚖️ Average';
        return '❄️ Cooling down';
    }
    
    updateRecentResultsDisplay() {
        const resultsGrid = document.getElementById('resultsGrid');
        
        if (!resultsGrid) return;
        
        if (this.allResults.length === 0) {
            resultsGrid.innerHTML = '<div class="loading">No results yet</div>';
            return;
        }
        
        const recentResults = this.allResults.slice(0, 10);
        
        resultsGrid.innerHTML = recentResults.map(result => {
            const isLightning = result.multiplier > 10;
            const time = new Date(result.timestamp).toLocaleTimeString();
            const groupIcon = this.groups[result.group]?.icon || '🎲';
            
            return `
                <div class="result-card ${isLightning ? 'lightning' : ''}">
                    <div class="result-number">${groupIcon} ${result.total}</div>
                    <div class="result-multiplier">${result.multiplier}x</div>
                    <div class="result-time">${time}</div>
                    <div class="result-dice">${result.diceValues}</div>
                </div>
            `;
        }).join('');
        
        if (this.latestResult) {
            const winnersInfo = `
                <div class="winners-info">
                    🏆 Winners: ${this.latestResult.winners} | 💰 Total Payout: $${this.latestResult.payout.toLocaleString()}
                </div>
            `;
            resultsGrid.innerHTML += winnersInfo;
        }
    }
    
    updatePredictionDisplay() {
        if (!this.currentPrediction) return;
        
        const pred = this.currentPrediction;
        
        const groupIconEl = document.getElementById('groupIcon');
        const groupNameEl = document.getElementById('groupName');
        const groupRangeEl = document.getElementById('groupRange');
        const predictionConfidenceEl = document.getElementById('predictionConfidence');
        const predictionReasonEl = document.getElementById('predictionReason');
        
        if (groupIconEl) groupIconEl.textContent = pred.icon;
        if (groupNameEl) groupNameEl.textContent = pred.name;
        if (groupRangeEl) groupRangeEl.textContent = `(${pred.range})`;
        if (predictionConfidenceEl) predictionConfidenceEl.textContent = `Confidence: ${pred.confidence}%`;
        if (predictionReasonEl) predictionReasonEl.textContent = pred.reasoning;
    }
    
    updateConnectionStatus(isConnected) {
        const statusText = document.getElementById('statusText');
        const statusDot = document.querySelector('.status-dot');
        
        if (statusText) {
            statusText.textContent = isConnected ? 'Connected' : 'Disconnected';
            if (!isConnected) {
                statusText.style.color = '#ef4444';
            } else {
                statusText.style.color = '';
            }
        }
        
        if (statusDot) {
            statusDot.style.background = isConnected ? '#4ade80' : '#ef4444';
        }
    }
    
    animateNewResult() {
        const resultsGrid = document.getElementById('resultsGrid');
        const firstCard = resultsGrid?.querySelector('.result-card');
        if (firstCard) {
            firstCard.classList.add('new');
            setTimeout(() => {
                firstCard.classList.remove('new');
            }, 500);
        }
        
        const predictionBox = document.getElementById('predictionBox');
        if (predictionBox) {
            predictionBox.style.animation = 'none';
            setTimeout(() => {
                predictionBox.style.animation = 'slideIn 0.3s ease';
            }, 10);
        }
    }
    
    startAutoRefresh() {
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = setInterval(() => {
            this.checkForNewData();
        }, this.refreshSeconds * 1000);
    }
    
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }
    
    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        let seconds = this.refreshSeconds;
        const timerElement = document.getElementById('refreshTimer');
        
        this.timerInterval = setInterval(() => {
            seconds--;
            if (seconds < 0) seconds = this.refreshSeconds;
            if (timerElement) {
                timerElement.textContent = `${seconds}s`;
                if (seconds <= 1) {
                    timerElement.style.color = '#fbbf24';
                } else {
                    timerElement.style.color = '';
                }
            }
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.textContent = `⚠️ ${message}`;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
        console.error(message);
    }
    
    getBaseStats() {
        return this.baseStats;
    }
    
    getAllResults() {
        return this.allResults;
    }
    
    getLatestResult() {
        return this.latestResult;
    }
    
    getPredictionHistory() {
        return this.predictionHistory;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.originalPredictor = new LightningDicePredictor();
    });
} else {
    window.originalPredictor = new LightningDicePredictor();
}
