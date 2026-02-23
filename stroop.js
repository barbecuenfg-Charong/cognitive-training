document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const gridSizeInput = document.getElementById('grid-size');
    const gridContainer = document.getElementById('stroop-grid');
    const timerDisplay = document.getElementById('timer');
    const voiceStatus = document.getElementById('voice-status');
    const voiceFeedback = document.getElementById('voice-feedback');
    const volumeBar = document.getElementById('volume-bar');
    const transcriptDisplay = document.getElementById('transcript-display');
    const modeRadios = document.querySelectorAll('input[name="play-mode"]');
    
    let startTime = 0;
    let timerInterval = null;
    let isPlaying = false;
    let isVoiceMode = false;
    let recognition = null;
    let currentIndex = 0; // For voice mode
    let gridData = []; // To store cell data { char, colorName, element }
    
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
                voiceStatus.innerHTML = "⚠️ 桌面版暂不支持云端语音识别。<br>请点击 <a href='#' id='open-browser-link'>在浏览器中打开</a> 以使用语音功能。";
                voiceStatus.className = "voice-status";
                voiceStatus.style.height = "auto";
                voiceStatus.style.color = "#e67e22";
                
                setTimeout(() => {
                    const link = document.getElementById('open-browser-link');
                    if (link) {
                        link.onclick = (e) => {
                            e.preventDefault();
                            try {
                                const { shell } = require('electron');
                                shell.openPath(window.location.href);
                            } catch (err) {
                                alert("无法打开浏览器，请手动复制文件路径到 Chrome/Edge 中打开。");
                            }
                        };
                    }
                }, 100);
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

    function startGame() {
        if (!gridData.length) {
            generateGrid();
        }
        
        // Reset state
        currentIndex = 0;
        
        // Reset visual state of cells
        gridData.forEach(d => {
            d.element.classList.remove('active', 'correct', 'wrong');
        });

        startTimer();
        startBtn.textContent = "停止计时";
        startBtn.classList.remove('primary');
        startBtn.classList.add('secondary'); // Visual feedback
        isPlaying = true;

        if (isVoiceMode) {
            // Only start recognition when user clicks Start
            // This is crucial for avoiding permission spam on page load or mode switch
            initSpeechRecognition();
            startAudioContext();
            highlightCell(0);
        }
    }

    function stopGame() {
        stopTimer();
        startBtn.textContent = "生成并开始";
        startBtn.classList.remove('secondary');
        startBtn.classList.add('primary');
        isPlaying = false;
        
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
                colorName: colorObj.name // This is the CORRECT answer
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
            if (transcriptDisplay) {
                transcriptDisplay.innerHTML = `<span style="color:#2c3e50">${displayFinal}</span><span style="color:#95a5a6">${displayInterim}</span>`;
            }

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
                    voiceStatus.innerHTML = "⚠️ 网络错误：桌面版缺少语音API密钥。<br>请点击 <a href='#' id='open-browser-error-link'>在浏览器中打开</a> 使用。";
                    setTimeout(() => {
                         const link = document.getElementById('open-browser-error-link');
                         if (link) {
                             link.onclick = (e) => {
                                 e.preventDefault();
                                 try {
                                     const { shell } = require('electron');
                                     shell.openPath(window.location.href);
                                 } catch(err) {}
                             };
                         }
                    }, 100);
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
            // Scroll into view if needed
            current.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Finished!
            voiceStatus.textContent = "挑战完成！";
            voiceStatus.className = "voice-status matched";
            stopGame();
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