document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const gridSizeInput = document.getElementById('grid-size');
    const gridContainer = document.getElementById('stroop-grid');
    const timerDisplay = document.getElementById('timer');
    const voiceStatus = document.getElementById('voice-status');
    const voiceFeedback = document.getElementById('voice-feedback');
    const volumeBar = document.getElementById('volume-bar');
    const transcriptDisplay = document.getElementById('transcript-display');
    const modeRadios = document.querySelectorAll('input[name="play-mode"]');

    const GAME_ID = "stroop";
    const GAME_NAME = "斯特鲁普测试";
    
    let startTime = 0;
    let timerInterval = null;
    let isPlaying = false;
    let isVoiceMode = false;
    let recognition = null;
    let currentIndex = 0; // For voice mode
    let gridData = []; // To store cell data { char, colorName, element }
    let audioContext = null;
    let mediaStream = null;
    let sessionStartedAt = null;
    let sessionInputMode = "manual";
    let sessionSaved = false;
    let sessionTrials = [];
    let currentTrialStartedAt = 0;
    
    // Characters: "红橙黄绿青蓝紫"
    const chars = ['红', '橙', '黄', '绿', '青', '蓝', '紫'];
    
    // Electron detection
    const isElectron = /Electron/.test(navigator.userAgent);
    
    // Colors: Red, Orange, Yellow, Green, Cyan, Blue, Purple
    // Use standard CSS colors or specific hex codes for better visibility
    const colors = [
        { name: '红', hex: '#e74c3c' },
        { name: '橙', hex: '#e67e22' },
        { name: '黄', hex: '#f1c40f' },
        { name: '绿', hex: '#2ecc71' },
        { name: '青', hex: '#1abc9c' }, // Cyan/Turquoise
        { name: '蓝', hex: '#3498db' },
        { name: '紫', hex: '#9b59b6' }
    ];

    function average(values) {
        if (!values.length) return null;
        return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    }

    function ratio(correctCount, totalCount) {
        return totalCount > 0 ? correctCount / totalCount : null;
    }

    function createSessionTrials(inputMode) {
        return gridData.map((item, index) => ({
            index,
            word: item.wordMeaning,
            wordMeaning: item.wordMeaning,
            color: item.colorName,
            colorName: item.colorName,
            condition: item.condition,
            congruency: item.congruency,
            inputMode,
            response: null,
            correct: null,
            rtMs: null,
            attemptCount: 0,
            wrongResponses: []
        }));
    }

    function markCurrentTrialStart(index) {
        currentTrialStartedAt = Date.now();
        if (sessionTrials[index]) {
            sessionTrials[index].startedAt = new Date(currentTrialStartedAt).toISOString();
        }
    }

    function recordVoiceResponse(response, correct) {
        const trial = sessionTrials[currentIndex];
        if (!trial) return;

        const rtMs = currentTrialStartedAt > 0 ? Date.now() - currentTrialStartedAt : null;
        trial.attemptCount += 1;
        trial.response = response;
        trial.correct = correct;
        trial.rtMs = Number.isFinite(rtMs) ? rtMs : null;

        if (correct) {
            trial.finishedAt = new Date().toISOString();
            return;
        }

        trial.wrongResponses.push({
            response,
            rtMs: trial.rtMs
        });
    }

    function calculateSessionSummary() {
        const trials = sessionTrials.length ? sessionTrials : createSessionTrials(sessionInputMode);
        const totalTrials = trials.length;
        const completedTrials = trials.filter(trial => trial.correct !== null);
        const correctTrials = trials.filter(trial => trial.correct === true);
        const rtSamples = completedTrials
            .map(trial => trial.rtMs)
            .filter(value => Number.isFinite(value));
        const congruentTrials = trials.filter(trial => trial.congruency === "congruent");
        const incongruentTrials = trials.filter(trial => trial.congruency === "incongruent");
        const hasMeasuredResponses = completedTrials.length > 0;

        return {
            totalTrials,
            completedTrials: completedTrials.length,
            correctCount: correctTrials.length,
            accuracy: hasMeasuredResponses ? ratio(correctTrials.length, totalTrials) : null,
            meanRtMs: average(rtSamples),
            congruentAccuracy: hasMeasuredResponses
                ? ratio(congruentTrials.filter(trial => trial.correct === true).length, congruentTrials.length)
                : null,
            incongruentAccuracy: hasMeasuredResponses
                ? ratio(incongruentTrials.filter(trial => trial.correct === true).length, incongruentTrials.length)
                : null,
            inputMode: sessionInputMode,
            gridSize: parseInt(gridSizeInput.value, 10) || null,
            completed: completedTrials.length === totalTrials
        };
    }

    function saveTrainingSession(endReason) {
        if (sessionSaved || !sessionStartedAt) return;
        sessionSaved = true;

        const finishedAt = new Date();
        const durationMs = finishedAt.getTime() - sessionStartedAt.getTime();
        const summary = calculateSessionSummary();
        const score = Number.isFinite(summary.accuracy) ? Math.round(summary.accuracy * 100) : null;
        const trials = (sessionTrials.length ? sessionTrials : createSessionTrials(sessionInputMode))
            .map(trial => ({
                ...trial,
                wrongResponses: trial.wrongResponses.slice()
            }));

        if (window.TrainingResults && typeof window.TrainingResults.saveSession === "function") {
            try {
                window.TrainingResults.saveSession({
                    moduleId: GAME_ID,
                    gameId: GAME_ID,
                    gameName: GAME_NAME,
                    startedAt: sessionStartedAt,
                    finishedAt,
                    durationMs,
                    score,
                    summary,
                    trials,
                    metrics: {
                        accuracy: Number.isFinite(summary.accuracy)
                            ? `${Math.round(summary.accuracy * 100)}%`
                            : "--",
                        meanRT: Number.isFinite(summary.meanRtMs) ? `${summary.meanRtMs}ms` : "--",
                        inputMode: sessionInputMode,
                        endReason
                    },
                    tags: ["attention", "stroop"]
                });
            } catch (error) {
                console.error("Failed to save Stroop training result", error);
            }
        }
    }

    function renderTranscript(displayFinal, displayInterim) {
        if (!transcriptDisplay) return;
        transcriptDisplay.textContent = "";
        const finalSpan = document.createElement("span");
        finalSpan.style.color = "#2c3e50";
        finalSpan.textContent = displayFinal;
        const interimSpan = document.createElement("span");
        interimSpan.style.color = "#95a5a6";
        interimSpan.textContent = displayInterim;
        transcriptDisplay.appendChild(finalSpan);
        transcriptDisplay.appendChild(interimSpan);
    }

    function renderOpenInBrowserHint(linkId) {
        voiceStatus.textContent = "";
        voiceStatus.append("⚠️ 桌面版暂不支持云端语音识别。");
        voiceStatus.appendChild(document.createElement("br"));

        const link = document.createElement("a");
        link.id = linkId;
        link.href = "#";
        link.textContent = "在浏览器中打开";
        link.addEventListener("click", (event) => {
            event.preventDefault();
            try {
                window.electronShell.openPath(window.location.href);
            } catch (_error) {
                alert("无法打开浏览器，请手动复制文件路径到 Chrome/Edge 中打开。");
            }
        });
        voiceStatus.appendChild(link);
    }

    // Mode switching
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            isVoiceMode = e.target.value === 'voice';
            if (isPlaying) {
                // If mode changed while playing, reset
                stopGame();
            }
            updateUIForMode();
        });
    });

    function updateUIForMode() {
        if (isVoiceMode) {
            voiceStatus.style.display = 'block';
            voiceFeedback.classList.add('active');
            transcriptDisplay.textContent = "等待语音输入...";
            
            if (isElectron) {
                renderOpenInBrowserHint("open-browser-link");
                voiceStatus.className = "voice-status";
                voiceStatus.style.height = "auto";
                voiceStatus.style.color = "#e67e22";
            } else {
                voiceStatus.textContent = "请点击“开始”并允许麦克风权限";
                voiceStatus.className = "voice-status";
            }
        } else {
            voiceStatus.style.display = 'none';
            voiceFeedback.classList.remove('active');
        }
    }

    gridSizeInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 3) val = 3;
        if (val > 7) val = 7;
        e.target.value = val;
        
        if (!isPlaying) {
             generateGrid();
        }
    });

    // Initial generation
    generateGrid();
    updateUIForMode();

    startBtn.addEventListener('click', () => {
        if (isPlaying) {
            stopGame();
        } else {
            startGame();
        }
    });
    stopBtn.addEventListener('click', stopGame);

    function startGame() {
        if (!gridData.length) {
            generateGrid();
        }
        
        // Reset state
        currentIndex = 0;
        sessionInputMode = isVoiceMode ? "voice" : "manual";
        sessionSaved = false;
        sessionTrials = createSessionTrials(sessionInputMode);
        currentTrialStartedAt = 0;
        
        // Reset visual state of cells
        gridData.forEach(d => {
            d.element.classList.remove('active', 'correct', 'wrong');
        });

        startTimer();
        sessionStartedAt = new Date(startTime);
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        isPlaying = true;

        if (isVoiceMode) {
            // Only start recognition when user clicks Start
            // This is crucial for avoiding permission spam on page load or mode switch
            initSpeechRecognition();
            startAudioContext();
            highlightCell(0);
        }
    }

    function stopGame(endReason = "stopped") {
        const shouldSaveSession = isPlaying && sessionStartedAt && !sessionSaved;

        stopTimer();
        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        isPlaying = false;

        if (shouldSaveSession) {
            saveTrainingSession(endReason);
        }
        
        stopAudioContext();
        
        if (recognition) {
            recognition.stop();
            voiceStatus.textContent = "已停止";
            voiceStatus.className = "voice-status";
        }
        
        // Remove active highlights
        document.querySelectorAll('.stroop-cell.active').forEach(c => c.classList.remove('active'));
    }

    function generateGrid() {
        const n = parseInt(gridSizeInput.value) || 4;
        gridContainer.innerHTML = '';
        gridData = [];
        
        // Grid CSS
        gridContainer.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
        
        const totalCells = n * n;
        
        for (let i = 0; i < totalCells; i++) {
            const cell = document.createElement('div');
            cell.className = 'stroop-cell';
            
            // Random character
            const charObj = colors[Math.floor(Math.random() * colors.length)];
            const charText = charObj.name;
            
            // Random color, BUT NOT matching the character
            let colorObj;
            do {
                colorObj = colors[Math.floor(Math.random() * colors.length)];
            } while (colorObj.name === charText);
            
            cell.textContent = charText;
            cell.style.color = colorObj.hex;
            
            // Adjust font size based on N and viewport
            const sizeMap = {
                3: { font: '60px', height: '100px', width: '100px' },
                4: { font: '50px', height: '90px', width: '90px' },
                5: { font: '40px', height: '70px', width: '70px' },
                6: { font: '30px', height: '60px', width: '60px' },
                7: { font: '24px', height: '50px', width: '50px' }
            };
            const style = sizeMap[n] || sizeMap[4];
            
            // Responsive adjustments for mobile
            if (window.innerWidth <= 768) {
                const mobileSize = Math.floor((window.innerWidth - 40) / n) - 10;
                cell.style.fontSize = `${mobileSize * 0.5}px`;
                cell.style.height = `${mobileSize}px`;
                cell.style.width = `${mobileSize}px`;
            } else {
                cell.style.fontSize = style.font;
                cell.style.height = style.height;
                cell.style.width = style.width;
            }
            
            gridContainer.appendChild(cell);
            
            // Store data for logic
            gridData.push({
                element: cell,
                wordMeaning: charText,
                colorName: colorObj.name, // This is the CORRECT answer
                condition: charText === colorObj.name ? "congruent" : "incongruent",
                congruency: charText === colorObj.name ? "congruent" : "incongruent"
            });
        }
    }

    function startTimer() {
        startTime = Date.now();
        timerInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    // --- Voice Logic ---

    function initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器。");
            isVoiceMode = false;
            updateUIForMode();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            voiceStatus.textContent = "正在聆听... 请读出高亮字的颜色";
            voiceStatus.className = "voice-status listening";
        };

        recognition.onresult = (event) => {
            if (!isPlaying) return;
            
            let displayFinal = '';
            let displayInterim = '';

            // Loop for Display (All results)
            for (let i = 0; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    displayFinal += event.results[i][0].transcript;
                } else {
                    displayInterim += event.results[i][0].transcript;
                }
            }
            renderTranscript(displayFinal, displayInterim);

            // Loop for Game Logic (New results only)
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    handleVoiceInput(event.results[i][0].transcript.trim());
                }
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            if (event.error === 'not-allowed') {
                voiceStatus.textContent = "麦克风权限被拒绝，请允许后重试";
                voiceStatus.className = "voice-status";
                stopGame();
            } else if (event.error === 'service-not-allowed') {
                voiceStatus.textContent = "当前浏览器不支持语音服务，请使用 Chrome/Edge";
                voiceStatus.className = "voice-status";
                stopGame();
            } else if (event.error === 'network') {
                if (isElectron) {
                    voiceStatus.textContent = "";
                    voiceStatus.append("⚠️ 网络错误：桌面版缺少语音API密钥。");
                    voiceStatus.appendChild(document.createElement("br"));
                    const link = document.createElement("a");
                    link.href = "#";
                    link.textContent = "在浏览器中打开";
                    link.addEventListener("click", (e) => {
                        e.preventDefault();
                        try {
                            window.electronShell.openPath(window.location.href);
                        } catch (_err) {
                            // ignore
                        }
                    });
                    voiceStatus.appendChild(link);
                } else {
                    voiceStatus.textContent = "网络错误，无法连接语音服务";
                }
                voiceStatus.className = "voice-status";
                voiceStatus.style.height = "auto";
                stopGame();
            } else {
                // Ignore small errors, maybe just restart
                // voiceStatus.textContent = "识别出错: " + event.error;
            }
        };

        recognition.onend = () => {
            // Only restart if game is still playing
            if (isPlaying && isVoiceMode) {
                try {
                    recognition.start();
                } catch (e) {
                    console.log("Recognition restart suppressed:", e);
                }
            }
        };

        try {
            recognition.start();
        } catch (e) {
            console.error(e);
        }
    }

    function highlightCell(index) {
        // Clear previous
        gridData.forEach(d => d.element.classList.remove('active'));
        
        if (index < gridData.length) {
            const current = gridData[index];
            current.element.classList.add('active');
            markCurrentTrialStart(index);
            // Scroll into view if needed
            current.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Finished!
            voiceStatus.textContent = "挑战完成！";
            voiceStatus.className = "voice-status matched";
            stopGame("completed");
            alert(`恭喜！完成时间：${timerDisplay.textContent}`);
        }
    }

    function handleVoiceInput(text) {
        if (currentIndex >= gridData.length) return;

        const currentTarget = gridData[currentIndex].colorName; // e.g. "红"
        
        // Loose matching: "红色" matches "红"
        // Also handle "绿" vs "绿色"
        // Common colors: 红, 橙, 黄, 绿, 青, 蓝, 紫
        
        let matched = false;
        
        // Clean text: remove punctuation if any
        const cleanText = text.replace(/[.,?!。，？！]/g, '');
        
        console.log(`Expected: ${currentTarget}, Heard: ${cleanText}`);
        
        // Check if the spoken text CONTAINS the target color char
        if (cleanText.includes(currentTarget)) {
            matched = true;
        } else {
            // Special cases mapping if needed (e.g. 青 -> 青色/Cyan)
            // But since our target names are single chars, includes() is usually enough.
            // Be careful of homophones or similar sounds, but Web Speech is usually context aware.
        }

        recordVoiceResponse(cleanText, matched);

        const statusEl = voiceStatus;
        
        if (matched) {
            statusEl.textContent = `识别成功: ${cleanText} (正确)`;
            statusEl.className = "voice-status matched";
            
            // Mark cell visually
            gridData[currentIndex].element.classList.remove('active');
            gridData[currentIndex].element.classList.add('correct');
            
            currentIndex++;
            highlightCell(currentIndex);
        } else {
            statusEl.textContent = `识别: ${cleanText} (应读: ${currentTarget}色)`;
            statusEl.className = "voice-status listening"; // Keep red color or warning
            
            // Visual feedback on cell
            const cell = gridData[currentIndex].element;
            cell.classList.add('wrong');
            setTimeout(() => cell.classList.remove('wrong'), 500);
        }
    }

    function startAudioContext() {
        if (audioContext) return;
        
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                mediaStream = stream;
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const analyser = audioContext.createAnalyser();
                const microphone = audioContext.createMediaStreamSource(stream);
                const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

                analyser.smoothingTimeConstant = 0.8;
                analyser.fftSize = 1024;

                microphone.connect(analyser);
                analyser.connect(javascriptNode);
                javascriptNode.connect(audioContext.destination);

                javascriptNode.onaudioprocess = () => {
                    if (!isPlaying) return;
                    const array = new Uint8Array(analyser.frequencyBinCount);
                    analyser.getByteFrequencyData(array);
                    let values = 0;
                    const length = array.length;
                    for (let i = 0; i < length; i++) {
                        values += array[i];
                    }
                    const average = values / length;
                    let percent = Math.min(100, average * 2);
                    if (volumeBar) volumeBar.style.width = percent + "%";
                };
            })
            .catch(err => {
                console.error("Audio context error", err);
            });
    }

    function stopAudioContext() {
        if (audioContext) {
            audioContext.close().catch(e => console.error(e));
            audioContext = null;
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        if (volumeBar) volumeBar.style.width = "0%";
    }
});
